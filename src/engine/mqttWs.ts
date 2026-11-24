/**
 * Minimal zero-dependency MQTT 3.1.1 over WebSocket client (plus plain JSON WS relay mode).
 * Works identically in browsers (GitHub Pages) and Node.js 20+.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeUtf8(str: string): Uint8Array {
  const bytes = textEncoder.encode(str);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = (bytes.length >> 8) & 0xff;
  out[1] = bytes.length & 0xff;
  out.set(bytes, 2);
  return out;
}

function encodeRemainingLength(len: number): Uint8Array {
  const bytes: number[] = [];
  do {
    let encodedByte = len % 128;
    len = Math.floor(len / 128);
    if (len > 0) {
      encodedByte |= 128;
    }
    bytes.push(encodedByte);
  } while (len > 0);
  return new Uint8Array(bytes);
}

function buildPacket(fixedHeaderByte: number, variableAndPayloadParts: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const p of variableAndPayloadParts) {
    totalLen += p.length;
  }
  const remLenBytes = encodeRemainingLength(totalLen);
  const packet = new Uint8Array(1 + remLenBytes.length + totalLen);
  packet[0] = fixedHeaderByte;
  packet.set(remLenBytes, 1);
  let offset = 1 + remLenBytes.length;
  for (const p of variableAndPayloadParts) {
    packet.set(p, offset);
    offset += p.length;
  }
  return packet;
}

export interface MqttWsClientOptions {
  clientId?: string;
  keepAliveSec?: number;
  mode?: 'mqtt' | 'ws';
}

type ListenerFn = (...args: unknown[]) => void;

export class MqttWsClient {
  url: string;
  clientId: string;
  keepAliveSec: number;
  mode: 'mqtt' | 'ws';
  ws: WebSocket | null = null;
  connected = false;
  private packetId = 1;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private rxBuffer = new Uint8Array(0);
  private listeners = new Map<string, Set<ListenerFn>>();
  private pendingSubscriptions = new Set<string>();

  constructor(url: string, options: MqttWsClientOptions = {}) {
    this.url = url;
    this.clientId = options.clientId || `sm_${Math.random().toString(36).slice(2, 10)}`;
    this.keepAliveSec = options.keepAliveSec || 25;
    this.mode =
      options.mode ||
      (url.includes('mqtt') ||
      url.includes('emqx') ||
      url.includes('hivemq') ||
      url.includes('mosquitto')
        ? 'mqtt'
        : 'ws');
  }

  on(event: string, fn: ListenerFn): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  off(event: string, fn: ListenerFn): void {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const fn of set) {
        try {
          fn(...args);
        } catch (err) {
          console.error('[MqttWsClient] listener error:', err);
        }
      }
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const protocols = this.mode === 'mqtt' ? 'mqtt' : undefined;
      const ws = protocols ? new WebSocket(this.url, protocols) : new WebSocket(this.url);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            ws.close();
          } catch {
            // ignore close error
          }
          reject(new Error(`Connection timeout to ${this.url}`));
        }
      }, 10000);

      ws.onopen = () => {
        if (this.mode === 'ws') {
          clearTimeout(timeout);
          this.connected = true;
          settled = true;
          for (const topic of this.pendingSubscriptions) {
            ws.send(JSON.stringify({ type: 'subscribe', topic }));
          }
          this.emit('connect');
          resolve();
          return;
        }

        const varHeader = new Uint8Array([
          0x00,
          0x04,
          0x4d,
          0x51,
          0x54,
          0x54, // "MQTT"
          0x04, // Level 4 (3.1.1)
          0x02, // Clean Session
          (this.keepAliveSec >> 8) & 0xff,
          this.keepAliveSec & 0xff,
        ]);
        const payload = encodeUtf8(this.clientId);
        ws.send(buildPacket(0x10, [varHeader, payload]));
      };

      ws.onmessage = (event) => {
        if (this.mode === 'ws') {
          try {
            const raw =
              typeof event.data === 'string'
                ? event.data
                : textDecoder.decode(event.data as ArrayBuffer);
            const msg = JSON.parse(raw) as { type?: string; topic?: string; payload?: string };
            if (msg.type === 'message' && msg.topic) {
              this.emit('message', msg.topic, msg.payload ?? '');
            }
          } catch (err) {
            console.error('[MqttWsClient] WS parse error:', err);
          }
          return;
        }

        const chunk = new Uint8Array(event.data as ArrayBuffer);
        const merged = new Uint8Array(this.rxBuffer.length + chunk.length);
        merged.set(this.rxBuffer, 0);
        merged.set(chunk, this.rxBuffer.length);
        this.rxBuffer = merged;

        this._drainMqttBuffer(
          () => {
            if (!settled) {
              clearTimeout(timeout);
              settled = true;
              resolve();
            }
          },
          (err) => {
            if (!settled) {
              clearTimeout(timeout);
              settled = true;
              reject(err);
            }
          }
        );
      };

      ws.onerror = (err) => {
        if (!settled) {
          clearTimeout(timeout);
          settled = true;
          reject(new Error(`WebSocket error connecting to ${this.url}`));
        }
        this.emit('error', err);
      };

      ws.onclose = () => {
        const wasConnected = this.connected;
        this.connected = false;
        this._stopPing();
        if (!settled) {
          clearTimeout(timeout);
          settled = true;
          reject(new Error(`WebSocket closed before connecting to ${this.url}`));
        }
        if (wasConnected) {
          this.emit('close');
        }
      };
    });
  }

  private _drainMqttBuffer(
    onConnack?: () => void,
    onConnError?: (err: Error) => void
  ): void {
    while (this.rxBuffer.length >= 2) {
      const header = this.rxBuffer[0];
      let multiplier = 1;
      let remLen = 0;
      let pos = 1;
      let encodedByte: number;
      let completeHeader = false;

      while (pos < this.rxBuffer.length && pos <= 4) {
        encodedByte = this.rxBuffer[pos++];
        remLen += (encodedByte & 127) * multiplier;
        multiplier *= 128;
        if ((encodedByte & 128) === 0) {
          completeHeader = true;
          break;
        }
      }

      if (!completeHeader || this.rxBuffer.length < pos + remLen) {
        break;
      }

      const packetBody = this.rxBuffer.slice(pos, pos + remLen);
      this.rxBuffer = this.rxBuffer.slice(pos + remLen);

      const packetType = header >> 4;

      if (packetType === 2) {
        const returnCode = packetBody[1];
        if (returnCode === 0) {
          this.connected = true;
          this._startPing();
          for (const topic of this.pendingSubscriptions) {
            this._sendMqttSubscribe(topic);
          }
          this.emit('connect');
          onConnack?.();
        } else {
          onConnError?.(new Error(`MQTT CONNACK rejected with code ${returnCode}`));
        }
      } else if (packetType === 3) {
        const qos = (header >> 1) & 0x03;
        const topicLen = (packetBody[0] << 8) | packetBody[1];
        const topic = textDecoder.decode(packetBody.slice(2, 2 + topicLen));
        let payloadOffset = 2 + topicLen;
        if (qos > 0) {
          payloadOffset += 2;
        }
        const payload = textDecoder.decode(packetBody.slice(payloadOffset));
        this.emit('message', topic, payload);
      }
    }
  }

  private _startPing(): void {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.connected && this.ws?.readyState === 1) {
        this.ws.send(new Uint8Array([0xc0, 0x00]));
      }
    }, Math.max(5000, (this.keepAliveSec - 5) * 1000));
  }

  private _stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  subscribe(topic: string): void {
    this.pendingSubscriptions.add(topic);
    if (!this.connected || this.ws?.readyState !== 1) return;
    if (this.mode === 'ws') {
      this.ws.send(JSON.stringify({ type: 'subscribe', topic }));
    } else {
      this._sendMqttSubscribe(topic);
    }
  }

  private _sendMqttSubscribe(topic: string): void {
    const pid = (this.packetId++ & 0xffff) || 1;
    const varHeader = new Uint8Array([(pid >> 8) & 0xff, pid & 0xff]);
    const topicBytes = encodeUtf8(topic);
    const qosByte = new Uint8Array([0x00]);
    this.ws!.send(buildPacket(0x82, [varHeader, topicBytes, qosByte]));
  }

  publish(topic: string, payloadStr: string): void {
    if (!this.connected || this.ws?.readyState !== 1) {
      throw new Error('Not connected to relay');
    }
    if (this.mode === 'ws') {
      this.ws.send(JSON.stringify({ type: 'publish', topic, payload: payloadStr }));
      return;
    }
    const topicBytes = encodeUtf8(topic);
    const payloadBytes = textEncoder.encode(payloadStr);
    this.ws.send(buildPacket(0x30, [topicBytes, payloadBytes]));
  }

  close(): void {
    this._stopPing();
    this.connected = false;
    try {
      if (this.ws && this.ws.readyState === 1 && this.mode === 'mqtt') {
        this.ws.send(new Uint8Array([0xe0, 0x00]));
      }
      this.ws?.close();
    } catch {
      // ignore close error
    }
  }
}
