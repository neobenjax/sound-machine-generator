/**
 * Minimal zero-dependency MQTT 3.1.1 over WebSocket client (plus plain JSON WS relay mode).
 * Works in Node.js 20+ (built-in global WebSocket) and modern browsers.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeUtf8(str) {
  const bytes = textEncoder.encode(str);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = (bytes.length >> 8) & 0xff;
  out[1] = bytes.length & 0xff;
  out.set(bytes, 2);
  return out;
}

function encodeRemainingLength(len) {
  const bytes = [];
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

function buildPacket(fixedHeaderByte, variableAndPayloadParts) {
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

export class MqttWsClient {
  constructor(url, options = {}) {
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
    this.ws = null;
    this.connected = false;
    this.packetId = 1;
    this.pingTimer = null;
    this.rxBuffer = new Uint8Array(0);
    this.listeners = new Map();
    this.pendingSubscriptions = new Set();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this.listeners.get(event)?.delete(fn);
  }

  emit(event, ...args) {
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

  connect() {
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
          } catch {}
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
          0x54,
          0x04,
          0x02,
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
                : textDecoder.decode(event.data);
            const msg = JSON.parse(raw);
            if (msg.type === 'message' && msg.topic) {
              this.emit('message', msg.topic, msg.payload ?? '');
            }
          } catch (err) {
            console.error('[MqttWsClient] WS parse error:', err);
          }
          return;
        }

        const chunk = new Uint8Array(event.data);
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

  _drainMqttBuffer(onConnack, onConnError) {
    while (this.rxBuffer.length >= 2) {
      const header = this.rxBuffer[0];
      let multiplier = 1;
      let remLen = 0;
      let pos = 1;
      let encodedByte;
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

  _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.connected && this.ws?.readyState === 1) {
        this.ws.send(new Uint8Array([0xc0, 0x00]));
      }
    }, Math.max(5000, (this.keepAliveSec - 5) * 1000));
  }

  _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  subscribe(topic) {
    this.pendingSubscriptions.add(topic);
    if (!this.connected || this.ws?.readyState !== 1) return;
    if (this.mode === 'ws') {
      this.ws.send(JSON.stringify({ type: 'subscribe', topic }));
    } else {
      this._sendMqttSubscribe(topic);
    }
  }

  _sendMqttSubscribe(topic) {
    const pid = (this.packetId++ & 0xffff) || 1;
    const varHeader = new Uint8Array([(pid >> 8) & 0xff, pid & 0xff]);
    const topicBytes = encodeUtf8(topic);
    const qosByte = new Uint8Array([0x00]);
    this.ws.send(buildPacket(0x82, [varHeader, topicBytes, qosByte]));
  }

  publish(topic, payloadStr) {
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

  close() {
    this._stopPing();
    this.connected = false;
    try {
      if (this.ws && this.ws.readyState === 1 && this.mode === 'mqtt') {
        this.ws.send(new Uint8Array([0xe0, 0x00]));
      }
      this.ws?.close();
    } catch {}
  }
}
