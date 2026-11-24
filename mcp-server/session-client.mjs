import { MqttWsClient } from './mqtt-ws.mjs';

const DEFAULT_BROKERS = [
  process.env.SOUND_MACHINE_RELAY_URL,
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
].filter(Boolean);

const connections = new Map();

export async function getSessionConnection(sessionId, customBrokerUrl) {
  const key = `${sessionId}::${customBrokerUrl || 'default'}`;
  const existing = connections.get(key);
  if (existing && existing.client.connected) {
    return existing;
  }

  const candidates = customBrokerUrl ? [customBrokerUrl] : DEFAULT_BROKERS;
  let client = null;
  let lastErr = null;

  for (const url of candidates) {
    try {
      const c = new MqttWsClient(url, {
        clientId: `agent_${sessionId}_${Math.random().toString(36).slice(2, 6)}`,
      });
      await c.connect();
      client = c;
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!client) {
    throw lastErr || new Error('Could not connect to relay broker');
  }

  const resTopic = `sound-machine-mcp/session/${sessionId}/res`;
  const pending = new Map();

  client.subscribe(resTopic);
  client.on('message', (topic, payload) => {
    if (topic !== resTopic) return;
    let msg;
    try {
      msg = JSON.parse(payload);
    } catch {
      return;
    }
    const waiter = pending.get(msg.requestId);
    if (waiter) {
      pending.delete(msg.requestId);
      clearTimeout(waiter.timer);
      if (msg.ok) {
        waiter.resolve(msg.result);
      } else {
        waiter.reject(new Error(msg.error || 'Remote tool execution failed'));
      }
    }
  });

  const conn = { client, pending, sessionId };
  connections.set(key, conn);
  return conn;
}

export async function sendSessionCommand(sessionId, action, params = {}, options = {}) {
  const conn = await getSessionConnection(sessionId, options.brokerUrl);
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cmdTopic = `sound-machine-mcp/session/${sessionId}/cmd`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      conn.pending.delete(requestId);
      reject(
        new Error(
          `Timeout waiting for browser session "${sessionId}" to respond. Make sure the browser tab is open with AI Copilot Remote Access enabled.`
        )
      );
    }, options.timeoutMs || 15000);

    conn.pending.set(requestId, { resolve, reject, timer });

    conn.client.publish(
      cmdTopic,
      JSON.stringify({
        requestId,
        action,
        params,
        agentName: options.agentName || 'MCP Copilot Agent',
      })
    );
  });
}

export function closeAllConnections() {
  for (const conn of connections.values()) {
    conn.client.close();
  }
  connections.clear();
}
