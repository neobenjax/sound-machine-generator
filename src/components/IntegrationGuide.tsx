import { Bot, Check, Copy, Hand, MousePointerClick, Sparkles, Terminal } from 'lucide-react';
import { useRef, useState } from 'react';
import { soundEngine } from '../engine/audioEngine';
import type { SoundRecipe } from '../engine/types';

interface IntegrationGuideProps {
  activeRecipe: SoundRecipe;
  allSounds: SoundRecipe[];
}

type SnippetTab = 'programmatic' | 'click' | 'swipe' | 'ai-agent';

export function IntegrationGuide({ activeRecipe, allSounds }: IntegrationGuideProps) {
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
      setSwipeStatus('Sliding card...');
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

// Programmatic trigger inside game logic (e.g., Solitaire foundation check)
export async function onMoveValidated(isValidMove: boolean) {
  await Tone.start(); // Safe no-op if already unlocked by an earlier user gesture

  if (isValidMove) {
    await playCardSnapPlacement();
  } else {
    await playErrorInvalidMove();
  }
}`,
    click: `// Attach to any button, card, or UI control
const dealButton = document.querySelector('#deal-btn');

dealButton.addEventListener('pointerdown', async () => {
  // Using pointerdown gives 0ms perceived latency on both mouse & mobile touch
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
  cardEl.setPointerCapture(e.pointerId);
});

cardEl.addEventListener('pointermove', (e) => {
  if (startX === null) return;
  if (Math.abs(e.clientX - startX) > 20 && !playedSlide) {
    playedSlide = true;
    playCardSlideFelt(); // Plays once when drag begins
  }
});

cardEl.addEventListener('pointerup', () => {
  if (startX === null) return;
  startX = null;
  playCardSnapPlacement(); // Plays on release
});`,
    'ai-agent': `# AI Agent & Developer Implementation Guide

## 1. Install Tone.js (or use the Zero-Dependency Web Audio tab)
\`\`\`bash
npm install tone
\`\`\`

## 2. Create a Sound Registry (\`src/audio/soundRegistry.ts\`)
- Export your sound functions from Sound Machine Generator (Tone.js tab or Vanilla Web Audio tab),
  OR import your exported \`sound-machine-library.json\` and pass recipes to \`soundEngine.playRecipe(recipe)\`.

## 3. Respect Browser & Mobile Safari Autoplay Policy
- NEVER instantiate or play audio on page load.
- Always call \`await Tone.start()\` (or \`await audioCtx.resume()\`) inside a direct user gesture
  (\`pointerdown\`, \`click\`, or \`keydown\`).

## 4. Wire Triggers
- **Immediate tactile UI**: bind to \`onPointerDown\` (faster than \`onClick\` on touchscreens).
- **Card drag & drop**: trigger \`card-slide-felt\` once on drag threshold (>20px) and \`card-snap-place\` on \`pointerup\`.
- **Game state events**: call \`playWinningFanfare()\` or \`playErrorInvalidMove()\` from state transitions.`,
  };

  return (
    <div className="integration-layout">
      <section className="hero-banner">
        <h2 className="hero-title">Integrate &amp; Ship Procedural Audio</h2>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', maxWidth: '72ch' }}>
          Test how your code-generated sounds behave on real UI interactions—clicking, swiping cards,
          and programmatic game events—then copy ready-to-use snippets or AI agent instructions for your app.
        </p>
      </section>

      <section aria-label="Interactive trigger playground">
        <h3 className="section-title" style={{ marginBottom: '12px' }}>
          Interactive Trigger Playground
        </h3>
        <div className="playground-grid">
          <article className="surface-card trigger-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MousePointerClick size={18} color="var(--color-accent)" />
              <strong>Click / Pointer Trigger</strong>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Fires your currently loaded studio sound (<strong>{activeRecipe.name}</strong>) on{' '}
              <code>onPointerDown</code> for instant tactile response.
            </p>
            <button
              type="button"
              className="btn-pill"
              onPointerDown={() => {
                void soundEngine.playRecipe(activeRecipe);
              }}
            >
              Tap / Click to Trigger
            </button>
          </article>

          <article className="surface-card trigger-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Hand size={18} color="var(--color-accent)" />
              <strong>Swipe / Drag Card Trigger</strong>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Drag horizontally to trigger <em>Card Slide</em>, release to trigger <em>Card Snap</em>, or tap to <em>Flip</em>.
            </p>
            <div
              className="swipe-zone"
              style={{ transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.06}deg)` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  void soundEngine.playRecipe(findSample('card-snap-place'));
                }
              }}
            >
              <strong>{swipeStatus}</strong>
            </div>
          </article>

          <article className="surface-card trigger-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--color-accent)" />
              <strong>Programmatic Game Events</strong>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Simulate application state transitions calling sound functions programmatically.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void soundEngine.playRecipe(findSample('game-winning'))}
              >
                Win Event
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void soundEngine.playRecipe(findSample('game-sparkles'))}
              >
                Sparkles
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void soundEngine.playRecipe(findSample('game-error'))}
              >
                Invalid Move
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="surface-card" style={{ overflow: 'hidden' }} aria-label="Implementation code and AI agent guide">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 16px',
            backgroundColor: 'var(--color-secondary-bg)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={18} color="var(--color-accent)" />
            <strong>Developer &amp; AI Agent Integration Snippets</strong>
          </div>

          <div className="playlist-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'programmatic'}
              className={`playlist-chip ${activeTab === 'programmatic' ? 'active' : ''}`}
              onClick={() => setActiveTab('programmatic')}
            >
              Programmatic
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'click'}
              className={`playlist-chip ${activeTab === 'click' ? 'active' : ''}`}
              onClick={() => setActiveTab('click')}
            >
              Click / Pointer
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'swipe'}
              className={`playlist-chip ${activeTab === 'swipe' ? 'active' : ''}`}
              onClick={() => setActiveTab('swipe')}
            >
              Swipe / Drag
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ai-agent'}
              className={`playlist-chip ${activeTab === 'ai-agent' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai-agent')}
            >
              <Bot size={14} />
              <span>AI Agent Runbook</span>
            </button>
          </div>

          <button
            type="button"
            className="btn-primary"
            style={{ minBlockSize: '34px', padding: '6px 14px' }}
            onClick={() => void copyText(activeTab, snippets[activeTab])}
          >
            {copiedKey === activeTab ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedKey === activeTab ? 'Copied!' : 'Copy Snippet'}</span>
          </button>
        </div>

        <pre
          className="code-pre"
          style={{
            backgroundColor: 'var(--color-code-bg)',
            color: 'var(--color-code-text)',
            maxBlockSize: '420px',
          }}
        >
          <code>{snippets[activeTab]}</code>
        </pre>
      </section>
    </div>
  );
}
