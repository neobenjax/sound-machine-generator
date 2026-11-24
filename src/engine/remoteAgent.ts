import { MqttWsClient } from './mqttWs';

export const DEFAULT_RELAY_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

export type RemoteAgentConnectionState =
  | 'off'
  | 'connecting'
  | 'waiting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface RemoteAgentStatus {
  state: RemoteAgentConnectionState;
  sessionId: string | null;
  brokerUrl?: string;
  agentName?: string;
  error?: string;
  version: number;
}

export interface RemoteAgentActivity {
  id: string;
  timestamp: string;
  source: 'system' | 'agent' | 'user' | 'error';
  message: string;
}

export interface RemoteToolExecutor {
  listTools: () => Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown> | unknown;
}

export function generateSessionId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `sm-${hex}`;
}

export class RemoteAgentSession {
  private toolExecutor: RemoteToolExecutor;
  private onStatus: (status: RemoteAgentStatus) => void;
  private onActivity: (entry: RemoteAgentActivity) => void;

  sessionId: string | null = null;
  brokerUrl: string = DEFAULT_RELAY_BROKERS[0];
  client: MqttWsClient | null = null;
  active = false;
  agentConnected = false;
  version = 0;
  private suppressNextChange = false;

  constructor(options: {
    toolExecutor: RemoteToolExecutor;
    onStatus?: (status: RemoteAgentStatus) => void;
    onActivity?: (entry: RemoteAgentActivity) => void;
  }) {
    this.toolExecutor = options.toolExecutor;
    this.onStatus = options.onStatus ?? (() => {});
    this.onActivity = options.onActivity ?? (() => {});
  }

  setToolExecutor(executor: RemoteToolExecutor): void {
    this.toolExecutor = executor;
  }

  private emitActivity(source: RemoteAgentActivity['source'], message: string): void {
    this.onActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      source,
      message,
    });
  }

  async enable(customBrokerUrl?: string): Promise<string> {
    if (this.active && this.sessionId) return this.sessionId;

    this.sessionId = generateSessionId();
    const candidates = customBrokerUrl?.trim()
      ? [customBrokerUrl.trim()]
      : DEFAULT_RELAY_BROKERS;

    this.onStatus({
      state: 'connecting',
      sessionId: this.sessionId,
      version: this.version,
    });

    let lastErr: Error | null = null;
    for (const url of candidates) {
      try {
        const client = new MqttWsClient(url, {
          clientId: `browser_${this.sessionId}_${Math.random().toString(36).slice(2, 6)}`,
        });
        await client.connect();
        this.client = client;
        this.brokerUrl = url;
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
      }
    }

    if (!this.client) {
      const errorMsg = lastErr?.message || 'Could not connect to relay broker';
      this.onStatus({
        state: 'error',
        sessionId: this.sessionId,
        error: errorMsg,
        version: this.version,
      });
      this.emitActivity('error', errorMsg);
      throw lastErr || new Error(errorMsg);
    }

    this.active = true;
    this.agentConnected = false;

    const cmdTopic = `sound-machine-mcp/session/${this.sessionId}/cmd`;
    this.client.subscribe(cmdTopic);

    this.client.on('message', (topic, payload) => {
      if (topic === cmdTopic && typeof payload === 'string') {
        void this._handleCommand(payload);
      }
    });

    this.client.on('close', () => {
      if (this.active) {
        this.onStatus({
          state: 'disconnected',
          sessionId: this.sessionId,
          brokerUrl: this.brokerUrl,
          version: this.version,
        });
        this.emitActivity('system', 'Relay connection closed.');
      }
    });

    this.onStatus({
      state: 'waiting',
      sessionId: this.sessionId,
      brokerUrl: this.brokerUrl,
      version: this.version,
    });
    this.emitActivity('system', `Session ${this.sessionId} started via ${this.brokerUrl}`);
    return this.sessionId;
  }

  disable(): void {
    this.active = false;
    this.agentConnected = false;
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    this.sessionId = null;
    this.onStatus({ state: 'off', sessionId: null, version: this.version });
    this.emitActivity('system', 'Remote agent access disabled.');
  }

  notifyUserChange(reason: string): void {
    if (!this.active || !this.client?.connected || this.suppressNextChange || !this.sessionId) {
      return;
    }
    this.version += 1;
    const eventTopic = `sound-machine-mcp/session/${this.sessionId}/events`;
    try {
      this.client.publish(
        eventTopic,
        JSON.stringify({
          type: 'state_changed',
          reason,
          version: this.version,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      // ignore transient publish errors
    }
  }

  private async _handleCommand(rawPayload: string): Promise<void> {
    let msg: {
      requestId?: string;
      action?: string;
      params?: { name?: string; args?: Record<string, unknown> };
      agentName?: string;
    };
    try {
      msg = JSON.parse(rawPayload);
    } catch {
      return;
    }

    const { requestId, action, params, agentName } = msg;
    if (!requestId || !this.sessionId || !this.client) return;

    if (!this.agentConnected) {
      this.agentConnected = true;
      this.onStatus({
        state: 'connected',
        sessionId: this.sessionId,
        brokerUrl: this.brokerUrl,
        agentName: agentName || 'AI Agent',
        version: this.version,
      });
      this.emitActivity('agent', `${agentName || 'AI Agent'} connected to session.`);
    }

    const resTopic = `sound-machine-mcp/session/${this.sessionId}/res`;

    try {
      let result: unknown;
      if (action === 'ping') {
        result = { pong: true, sessionId: this.sessionId, version: this.version };
      } else if (action === 'list_tools') {
        result = { tools: this.toolExecutor.listTools() };
      } else if (action === 'call_tool') {
        const toolName = params?.name || '';
        const toolArgs = params?.args || {};
        this.suppressNextChange = true;
        try {
          result = await this.toolExecutor.executeTool(toolName, toolArgs);
        } finally {
          this.suppressNextChange = false;
        }
        this.version += 1;
        this.onStatus({
          state: 'connected',
          sessionId: this.sessionId,
          brokerUrl: this.brokerUrl,
          agentName: agentName || 'AI Agent',
          version: this.version,
        });
        this.emitActivity('agent', `Executed ${toolName}`);
      } else {
        throw new Error(`Unknown action: ${action}`);
      }

      this.client.publish(
        resTopic,
        JSON.stringify({
          requestId,
          ok: true,
          version: this.version,
          result,
        })
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.emitActivity('error', `Agent command failed: ${errorMsg}`);
      this.client.publish(
        resTopic,
        JSON.stringify({
          requestId,
          ok: false,
          error: errorMsg,
        })
      );
    }
  }
}
