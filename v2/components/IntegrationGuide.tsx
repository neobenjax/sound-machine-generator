import {
  Bot,
  Check,
  Copy,
  Cpu,
  ExternalLink,
  Hand,
  MousePointerClick,
  Terminal,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { soundEngine } from '../../src/engine/audioEngine';
import type { SoundRecipe } from '../../src/engine/types';
import type { WebMCPStatus } from '../../src/engine/webmcp';

interface IntegrationGuideProps {
  activeRecipe: SoundRecipe;
  allSounds: SoundRecipe[];
  webMcpStatus: WebMCPStatus | null;
}

type SnippetTab = 'programmatic' | 'click' | 'swipe' | 'ai-agent';

export function IntegrationGuide({
  activeRecipe,
  allSounds,
  webMcpStatus,
}: IntegrationGuideProps) {
  const [activeTab, setActiveTab] = useState<SnippetTab>('programmatic');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [swipeStatus, setSwipeStatus] = useState('Swipe or drag this card left/right');
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef<number | null>(null);
  const slidePlayedRef = useRef(false);

  const findSample = (id: string) => allSounds.find((s) => s.id === id) ?? activeRecipe;

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1800);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartX.current = e.clientX;
    slidePlayedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    setDragOffset(Math.max(-90, Math.min(90, dx)));
    if (Math.abs(dx) > 22 && !slidePlayedRef.current) {
      slidePlayedRef.current = true;
      void soundEngine.playRecipe(findSample('card-slide-felt'));
      setSwipeStatus('Sliding card…');
    }
  };

  const handlePointerUp = () => {
    if (dragStartX.current === null) return;
    const moved = Math.abs(dragOffset);
    dragStartX.current = null;
    setDragOffset(0);
    if (moved > 35) {
      void soundEngine.playRecipe(findSample('card-snap-place'));
      setSwipeStatus('Card snapped into place!');
    } else {
      void soundEngine.playRecipe(findSample('card-flip'));
      setSwipeStatus('Card flipped!');
    }
  };

  const snippets: Record<SnippetTab, string> = {
    programmatic: `import * as Tone from 'tone';
import { playCardSnapPlacement } from './sounds/cardSnap';

// Programmatic trigger inside game logic
export async function onMoveValidated(isValidMove: boolean) {
  await Tone.start(); // Safe no-op if already unlocked

  if (isValidMove) {
    await playCardSnapPlacement();
  } else {
    await playErrorInvalidMove();
  }
}`,
    click: `// Attach to any button, card, or UI control
const dealButton = document.querySelector('#deal-btn');

dealButton.addEventListener('pointerdown', async () => {
  await playCardFlip();
});

// React example
export function DealCardButton() {
  return (
    <button
      onPointerDown={() => playCardFlip()}
      onClick={() => dealNextCard()}
    >
      Deal Card
    </button>
  );
}`,
    swipe: `// Touch + Mouse swipe gesture for Solitaire / Card games
let startX = null;
let playedSlide = false;

cardEl.addEventListener('pointerdown', (e) => {
  startX = e.clientX;
  playedSlide = false;
});

cardEl.addEventListener('pointermove', (e) => {
  if (startX === null) return;
  if (Math.abs(e.clientX - startX) > 20 && !playedSlide) {
    playedSlide = true;
    playCardSlide();
  }
});

cardEl.addEventListener('pointerup', () => {
  startX = null;
  playCardSnapPlacement();
});`,
    'ai-agent': `// WebMCP Agent Prompt Example:
// "Using the Sound Machine WebMCP tools on this page:
//  1. Call compose_sound to create a crisp sci-fi shield recharge sound
//  2. Call play_current_sound so I can hear it
//  3. Call export_current_sound to get the Tone.js & Web Audio code"

// Registered WebMCP Tools on this Console:
// - list_sound_presets
// - load_sound_preset
// - compose_sound
// - tune_sound_layer
// - play_current_sound
// - export_current_sound
// - save_current_sound`,
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Hero Banner */}
      <section className="rounded-xl border border-[#334155] bg-[#1B2336] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-display text-xl font-bold text-[#F8FAFC] sm:text-2xl">
              Integrate Procedural Sound &amp; WebMCP Agents
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
              Every sound you craft in Sound Machine v2 compiles to zero-dependency Vanilla Web
              Audio API or Tone.js code. Browser AI agents can also connect directly via WebMCP to
              compose, audition, tune, and export sounds live.
            </p>
          </div>
          <a
            href="./website-example/"
            className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-[#0F172A] transition-opacity duration-150 hover:opacity-90"
          >
            <span>Open Arcade Showcase</span>
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Interactive Gesture Lab */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#334155] bg-[#1B2336] p-5">
          <div className="flex items-center gap-2">
            <MousePointerClick size={18} className="text-[#22C55E]" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-[#F8FAFC]">
              1. Click &amp; Tap Triggers
            </h3>
          </div>
          <p className="mt-1.5 text-sm text-[#CBD5E1]">
            Test zero-latency <code className="font-display text-xs text-[#22C55E]">pointerdown</code>{' '}
            feedback with real procedural recipes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onPointerDown={() => void soundEngine.playRecipe(findSample('card-deal'))}
              className="min-h-10 cursor-pointer rounded-lg border border-[#475569] bg-[#272F42] px-3.5 py-2 text-sm font-medium text-[#F8FAFC] transition-colors duration-150 hover:border-[#22C55E] hover:text-[#22C55E]"
            >
              Deal Card
            </button>
            <button
              type="button"
              onPointerDown={() => void soundEngine.playRecipe(findSample('ui-success-chime'))}
              className="min-h-10 cursor-pointer rounded-lg bg-[#22C55E] px-3.5 py-2 text-sm font-semibold text-[#0F172A] transition-opacity duration-150 hover:opacity-90"
            >
              Confirm Chime
            </button>
            <button
              type="button"
              onPointerDown={() => void soundEngine.playRecipe(findSample('game-coin'))}
              className="min-h-10 cursor-pointer rounded-lg border border-[#475569] bg-[#272F42] px-3.5 py-2 text-sm font-medium text-[#F8FAFC] transition-colors duration-150 hover:border-[#22C55E] hover:text-[#22C55E]"
            >
              Collect Coin
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[#334155] bg-[#1B2336] p-5">
          <div className="flex items-center gap-2">
            <Hand size={18} className="text-[#22C55E]" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-[#F8FAFC]">
              2. Drag &amp; Swipe Gesture
            </h3>
          </div>
          <p className="mt-1.5 text-sm text-[#CBD5E1]">
            Drag horizontally to trigger felt slide, or tap to flip.
          </p>
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ transform: `translateX(${dragOffset}px)` }}
            className="mt-4 flex min-h-16 cursor-grab touch-none items-center justify-center rounded-lg border border-dashed border-[#22C55E]/60 bg-[#0F172A] px-4 py-3 text-center text-sm font-medium text-[#F8FAFC] select-none active:cursor-grabbing"
          >
            {swipeStatus}
          </div>
        </div>
      </section>

      {/* Code Pattern Tabs */}
      <section className="overflow-hidden rounded-xl border border-[#334155] bg-[#1B2336]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#334155] px-4 py-3">
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Snippet patterns">
            {(
              [
                { id: 'programmatic', label: 'Programmatic' },
                { id: 'click', label: 'Click / Tap' },
                { id: 'swipe', label: 'Swipe / Drag' },
                { id: 'ai-agent', label: 'WebMCP Agent' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-8 cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 sm:text-sm ${
                  activeTab === tab.id
                    ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                    : 'text-[#CBD5E1] hover:bg-[#272F42] hover:text-[#F8FAFC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void copyText(activeTab, snippets[activeTab])}
            className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#475569] bg-[#272F42] px-3 py-1 text-xs font-semibold text-[#F8FAFC] transition-colors duration-150 hover:border-[#22C55E] hover:text-[#22C55E]"
          >
            {copiedKey === activeTab ? (
              <Check size={14} aria-hidden="true" />
            ) : (
              <Copy size={14} aria-hidden="true" />
            )}
            <span>{copiedKey === activeTab ? 'Copied' : 'Copy Snippet'}</span>
          </button>
        </div>

        <pre className="overflow-x-auto bg-[#0F172A] p-4 font-display text-xs leading-relaxed text-[#E2E8F0]">
          <code>{snippets[activeTab]}</code>
        </pre>
      </section>

      {/* WebMCP Status & Registered Tools */}
      <section className="rounded-xl border border-[#334155] bg-[#1B2336] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Bot size={20} className="text-[#22C55E]" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-[#F8FAFC]">
              WebMCP Browser Agent Status
            </h3>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-display text-xs font-semibold ${
              webMcpStatus?.supported
                ? 'border-[#22C55E]/50 bg-[#22C55E]/15 text-[#22C55E]'
                : 'border-[#475569] bg-[#272F42] text-[#CBD5E1]'
            }`}
          >
            <Cpu size={13} aria-hidden="true" />
            <span>
              {webMcpStatus?.supported
                ? `Active (${webMcpStatus.apiSurface})`
                : 'Bridge Ready (window.__soundMachineWebMCP)'}
            </span>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {(webMcpStatus?.tools ?? []).map((tool) => (
            <div
              key={tool.name}
              className="rounded-lg border border-[#334155] bg-[#0F172A] p-3"
            >
              <div className="flex items-center gap-2 font-display text-xs font-semibold text-[#22C55E]">
                <Terminal size={13} aria-hidden="true" />
                <span>{tool.name}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#CBD5E1]">{tool.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
