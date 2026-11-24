import { Bot, Check, Copy, Radio, RefreshCw, Settings2, X } from 'lucide-react';
import { useState } from 'react';
import type { RemoteAgentActivity, RemoteAgentStatus } from '../engine/remoteAgent';

interface RemoteAgentPopoverProps {
  open: boolean;
  status: RemoteAgentStatus;
  activities: RemoteAgentActivity[];
  onClose: () => void;
  onEnable: (customBrokerUrl?: string) => Promise<void>;
  onDisable: () => void;
  onOpenIntegrate: () => void;
}

export function RemoteAgentPopover({
  open,
  status,
  activities,
  onClose,
  onEnable,
  onDisable,
  onOpenIntegrate,
}: RemoteAgentPopoverProps) {
  const [customBrokerUrl, setCustomBrokerUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  if (!open) return null;

  const isEnabled = status.state !== 'off';

  const handleToggle = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      if (isEnabled) {
        onDisable();
      } else {
        await onEnable(customBrokerUrl.trim() || undefined);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopySessionId = async () => {
    if (!status.sessionId) return;
    await navigator.clipboard.writeText(status.sessionId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const statusMeta: Record<
    RemoteAgentStatus['state'],
    { label: string; dotClass: string; badgeClass: string }
  > = {
    off: {
      label: 'Off',
      dotClass: 'bg-[#64748B]',
      badgeClass: 'border-[#334155] bg-[#0F172A] text-[#94A3B8]',
    },
    connecting: {
      label: 'Connecting…',
      dotClass: 'bg-[#F59E0B] animate-pulse',
      badgeClass: 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]',
    },
    waiting: {
      label: 'Waiting for agent',
      dotClass: 'bg-[#38BDF8] animate-pulse',
      badgeClass: 'border-[#38BDF8]/40 bg-[#38BDF8]/10 text-[#7DD3FC]',
    },
    connected: {
      label: status.agentName ? `Connected: ${status.agentName}` : 'Agent connected',
      dotClass: 'bg-[#22C55E]',
      badgeClass: 'border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]',
    },
    disconnected: {
      label: 'Disconnected',
      dotClass: 'bg-[#F59E0B]',
      badgeClass: 'border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]',
    },
    error: {
      label: 'Error',
      dotClass: 'bg-[#EF4444]',
      badgeClass: 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#FCA5A5]',
    },
  };

  const meta = statusMeta[status.state];

  return (
    <div
      role="dialog"
      aria-label="Remote AI Copilot Access"
      className="fixed top-16 right-4 z-50 w-[min(92vw,390px)] rounded-xl border border-[#334155] bg-[#1B2336] p-4 shadow-2xl sm:right-6"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]">
            <Bot size={16} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-[#F8FAFC]">
              Remote AI Copilot
            </h2>
            <p className="text-[11px] text-[#94A3B8]">
              Connect Claude Code, Cursor, Codex, or Antigravity
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Remote AI Copilot panel"
          className="cursor-pointer rounded-md p-1 text-[#94A3B8] hover:bg-[#272F42] hover:text-[#F8FAFC]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-[#334155] bg-[#0F172A] px-3 py-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`}
        >
          <span className={`size-2 rounded-full ${meta.dotClass}`} aria-hidden="true" />
          {meta.label}
        </span>

        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleToggle()}
          className={`flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
            isEnabled
              ? 'border border-[#EF4444]/40 bg-[#EF4444]/15 text-[#FCA5A5] hover:bg-[#EF4444]/25'
              : 'bg-[#22C55E] text-[#0F172A] hover:bg-[#16A34A]'
          }`}
        >
          {isBusy ? (
            <RefreshCw size={13} className="animate-spin" />
          ) : (
            <Radio size={13} />
          )}
          <span>{isEnabled ? 'Disable' : 'Enable Access'}</span>
        </button>
      </div>

      {status.sessionId && (
        <div className="mb-3 rounded-lg border border-[#22C55E]/30 bg-[#0F172A] p-2.5">
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-[#94A3B8]">
            <span>Temporary Session ID</span>
            <span>v{status.version}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <code className="font-mono text-sm font-bold tracking-wide text-[#22C55E]">
              {status.sessionId}
            </code>
            <button
              type="button"
              onClick={() => void handleCopySessionId()}
              className="flex cursor-pointer items-center gap-1 rounded border border-[#334155] bg-[#1B2336] px-2 py-1 text-xs font-medium text-[#F8FAFC] hover:border-[#22C55E]/60"
            >
              {copied ? <Check size={12} className="text-[#22C55E]" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          {status.brokerUrl && (
            <p className="mt-1 truncate text-[10px] text-[#64748B]">
              Relay: {status.brokerUrl}
            </p>
          )}
        </div>
      )}

      {status.error && (
        <p className="mb-3 rounded-md border border-[#EF4444]/40 bg-[#EF4444]/10 px-2.5 py-1.5 text-xs text-[#FCA5A5]">
          {status.error}
        </p>
      )}

      <div className="mb-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-[#94A3B8] hover:text-[#F8FAFC]"
        >
          <Settings2 size={12} />
          <span>{showAdvanced ? 'Hide' : 'Show'} custom relay broker URL</span>
        </button>
        {showAdvanced && (
          <input
            type="text"
            value={customBrokerUrl}
            onChange={(e) => setCustomBrokerUrl(e.target.value)}
            placeholder="wss://broker.emqx.io:8084/mqtt"
            disabled={isEnabled}
            className="mt-1.5 w-full rounded-md border border-[#334155] bg-[#0F172A] px-2.5 py-1.5 font-mono text-xs text-[#F8FAFC] placeholder-[#64748B] focus:border-[#22C55E] focus:outline-none disabled:opacity-60"
          />
        )}
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[#94A3B8]">
          <span>Live Activity</span>
          <span>{activities.length} events</span>
        </div>
        <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[#334155] bg-[#0F172A] p-2 text-[11px]">
          {activities.length === 0 ? (
            <p className="text-[#64748B]">
              Enable Remote Access to generate a session ID and sync in real time.
            </p>
          ) : (
            activities.map((entry) => (
              <div key={entry.id} className="flex items-start gap-1.5">
                <span className="shrink-0 font-mono text-[10px] text-[#64748B]">
                  {entry.timestamp}
                </span>
                <span
                  className={
                    entry.source === 'error'
                      ? 'text-[#FCA5A5]'
                      : entry.source === 'agent'
                        ? 'text-[#22C55E]'
                        : 'text-[#CBD5E1]'
                  }
                >
                  {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-[#94A3B8]">Need MCP setup JSON?</span>
        <button
          type="button"
          onClick={() => {
            onOpenIntegrate();
            onClose();
          }}
          className="cursor-pointer font-semibold text-[#22C55E] hover:underline"
        >
          Open Integrate Guide →
        </button>
      </div>
    </div>
  );
}
