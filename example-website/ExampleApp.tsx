import {
  ArrowLeft,
  ArrowRight,
  AudioWaveform,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Play,
  Sliders,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { soundEngine } from '../src/engine/audioEngine';
import { generateToneJsCode } from '../src/engine/codeGenerator';
import { EXAMPLE_SHOWCASE_SOUNDS } from './sounds';

const SLIDESHOW_STEPS = [
  {
    step: 1,
    title: 'Connect an AI Agent via WebMCP (or Compose Manually)',
    summary:
      'Open Sound Machine Generator in Chrome with WebMCP enabled, or use the Studio Console directly. An AI agent can call compose_sound and export_current_sound to craft an explosion, siren, or UI snap on demand.',
    code: `// WebMCP Agent Workflow on https://neobenjax.github.io/sound-machine-generator/
// 1. Agent calls compose_sound({ name: "Explosion", layers: [...] })
// 2. Agent calls play_current_sound() to audition
// 3. Agent calls export_current_sound({ download: false })
//    -> Receives Tone.js code, Vanilla Web Audio code, and JSON!`,
  },
  {
    step: 2,
    title: 'Install Tone.js (or Choose Zero-Dependency Web Audio)',
    summary:
      'Install Tone.js in your web application for expressive musical scheduling, or copy the Vanilla Web Audio API tab if you want zero external dependencies.',
    code: `npm install tone`,
  },
  {
    step: 3,
    title: 'Unlock Browser Audio on First User Gesture',
    summary:
      'Modern browsers and Mobile Safari block audio until a user taps or clicks. Call await Tone.start() inside your button or pointer handler.',
    code: `import * as Tone from 'tone';

button.addEventListener('pointerdown', async () => {
  await Tone.start(); // Unlocks Web Audio on Desktop & iOS Safari
  playExplosion();
});`,
  },
  {
    step: 4,
    title: 'Drop In Your Generated Sound Function',
    summary:
      'Paste the exported function from Sound Machine Generator directly into your project. No .mp3 downloads, no audio sprite loading, and < 1 KB of code.',
    code: `export async function playExplosion() {
  await Tone.start();
  const master = new Tone.Gain(Tone.dbToGain(-1)).toDestination();
  const now = Tone.now() + 0.01;
  // Sub-bass boom + filtered brown noise blast
  const synth = new Tone.Synth({ oscillator: { type: 'sine' } }).connect(master);
  synth.triggerAttackRelease(120, 0.48, now);
  synth.frequency.exponentialRampToValueAtTime(28, now + 0.48);
}`,
  },
  {
    step: 5,
    title: 'Wire Triggers & Ship Anywhere',
    summary:
      'Attach your sound functions to clicks, card swipes, keyboard shortcuts, or programmatic game events (Win, Error, Level Up) across laptops, tablets, and phones.',
    code: `// Programmatic Game Event
if (hitTarget) {
  await playExplosion();
} else {
  await playFanfare();
}`,
  },
];

export function ExampleApp() {
  const [activeId, setActiveId] = useState<string>(EXAMPLE_SHOWCASE_SOUNDS[0].id);
  const [slideIndex, setSlideIndex] = useState(0);
  const [copiedSlide, setCopiedSlide] = useState(false);
  const [copiedSound, setCopiedSound] = useState(false);

  const activeItem =
    EXAMPLE_SHOWCASE_SOUNDS.find((s) => s.id === activeId) ?? EXAMPLE_SHOWCASE_SOUNDS[0];
  const activeCode = generateToneJsCode(activeItem.recipe);
  const currentSlide = SLIDESHOW_STEPS[slideIndex];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setSlideIndex((i) => Math.min(SLIDESHOW_STEPS.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setSlideIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handlePlay = async (item: (typeof EXAMPLE_SHOWCASE_SOUNDS)[number]) => {
    setActiveId(item.id);
    await soundEngine.playRecipe(item.recipe);
  };

  return (
    <div className="app-shell">
      <header className="global-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <AudioWaveform size={22} />
            </div>
            <div>
              <h1 className="brand-title">Sound Machine Showcase</h1>
              <p className="brand-subtitle">Live Code-Generated Web Audio Demo</p>
            </div>
          </div>

          <div className="header-actions">
            <a href="../" className="btn-secondary" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} />
              <span>Open Studio Console</span>
            </a>
          </div>
        </div>
      </header>

      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Hero */}
        <section className="hero-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span className="layer-badge">
              <Sparkles size={13} /> Zero Audio Files • 100% Procedural Code
            </span>
            <span className="layer-badge">
              <Cpu size={13} /> WebMCP Ready
            </span>
          </div>
          <h2 className="hero-title">Hear Code Come Alive in Real Time.</h2>
          <p style={{ margin: '0 0 18px 0', color: 'var(--color-text-secondary)', maxWidth: '72ch' }}>
            Every explosion, wind gust, siren, fanfare, trumpet, and piano sonata below is synthesized
            live in your browser using JavaScript and the Web Audio API—zero MP3s, zero WAV downloads,
            and instant latency on laptops, tablets, and phones.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a href="#effects-board" className="btn-pill" style={{ textDecoration: 'none' }}>
              <Volume2 size={16} />
              <span>Try Live Sound Effects</span>
            </a>
            <a href="#developer-slideshow" className="btn-secondary" style={{ textDecoration: 'none' }}>
              <Sliders size={16} />
              <span>5-Step Developer Guide</span>
            </a>
          </div>
        </section>

        {/* Live Sound Effects Board */}
        <section id="effects-board" aria-label="Live Sound Effects Showcase">
          <div className="section-header" style={{ marginBottom: '14px' }}>
            <h2 className="section-title">Live Procedural Soundboard</h2>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Click any effect to hear it &amp; inspect its generated code
            </span>
          </div>

          <div className="playground-grid">
            {EXAMPLE_SHOWCASE_SOUNDS.map((item) => {
              const isSelected = item.id === activeId;
              return (
                <article
                  key={item.id}
                  className="surface-card trigger-card"
                  style={
                    isSelected
                      ? {
                          borderColor: 'var(--color-accent)',
                          backgroundColor: 'var(--color-secondary-bg)',
                        }
                      : undefined
                  }
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '1.05rem' }}>{item.label}</strong>
                    <span className="layer-badge">{item.badge}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                    {item.subtitle}
                  </p>
                  <button
                    type="button"
                    className="btn-pill"
                    style={{ marginTop: 'auto' }}
                    onPointerDown={() => void handlePlay(item)}
                  >
                    <Play size={15} fill="currentColor" />
                    <span>Play {item.label}</span>
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {/* Active Effect Code Preview */}
        <section className="surface-card" style={{ overflow: 'hidden' }} aria-label="Active effect code">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: 'var(--color-code-surface)',
              color: 'var(--color-on-dark)',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code2 size={16} color="#54DDF2" />
              <strong>Generated Code: {activeItem.label}</strong>
            </div>
            <button
              type="button"
              className="code-tab active"
              onClick={async () => {
                await navigator.clipboard.writeText(activeCode);
                setCopiedSound(true);
                window.setTimeout(() => setCopiedSound(false), 1800);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {copiedSound ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedSound ? 'Copied!' : 'Copy Tone.js Code'}</span>
            </button>
          </div>
          <pre
            className="code-pre"
            style={{
              backgroundColor: 'var(--color-code-bg)',
              color: 'var(--color-code-text)',
              maxBlockSize: '280px',
            }}
          >
            <code>{activeCode}</code>
          </pre>
        </section>

        {/* Step-by-Step Developer Guide Slideshow */}
        <section id="developer-slideshow" className="surface-card" style={{ padding: 'var(--space-lg)' }} aria-label="Developer Step-by-Step Slideshow">
          <div className="section-header" style={{ marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <h2 className="section-title">Developer Quick-Start Slideshow</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Step {currentSlide.step} of {SLIDESHOW_STEPS.length} — Use Prev/Next or Arrow keys
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={slideIndex === 0}
                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={slideIndex === SLIDESHOW_STEPS.length - 1}
                onClick={() => setSlideIndex((i) => Math.min(SLIDESHOW_STEPS.length - 1, i + 1))}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div
            style={{
              padding: 'var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-secondary-bg)',
              border: '1px solid var(--border-accent)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <span className="layer-badge">STEP {currentSlide.step}</span>
              <button
                type="button"
                className="btn-secondary"
                style={{ minBlockSize: '32px', padding: '4px 10px', fontSize: 'var(--text-caption)' }}
                onClick={async () => {
                  await navigator.clipboard.writeText(currentSlide.code);
                  setCopiedSlide(true);
                  window.setTimeout(() => setCopiedSlide(false), 1800);
                }}
              >
                {copiedSlide ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedSlide ? 'Copied' : 'Copy Step Code'}</span>
              </button>
            </div>

            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>
              {currentSlide.title}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{currentSlide.summary}</p>

            <pre
              className="code-pre"
              style={{
                backgroundColor: 'var(--color-code-bg)',
                color: 'var(--color-code-text)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <code>{currentSlide.code}</code>
            </pre>
          </div>

          {/* Slide Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            {SLIDESHOW_STEPS.map((s, idx) => (
              <button
                key={s.step}
                type="button"
                className={`playlist-chip ${idx === slideIndex ? 'active' : ''}`}
                style={{ flex: '0 0 auto', padding: '6px 14px' }}
                onClick={() => setSlideIndex(idx)}
              >
                Step {s.step}
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        Built with Sound Machine Generator •{' '}
        <a href="../" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
          Launch Composer Studio <ArrowRight size={13} style={{ verticalAlign: 'middle' }} />
        </a>
      </footer>
    </div>
  );
}
