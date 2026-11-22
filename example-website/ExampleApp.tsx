import {
  ArrowLeft,
  ArrowRight,
  AudioWaveform,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Gamepad2,
  Play,
  Sliders,
  Sparkles,
  Square,
  Terminal,
  Trophy,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { soundEngine } from '../src/engine/audioEngine';
import { generateToneJsCode, generateVanillaWebAudioCode } from '../src/engine/codeGenerator';
import {
  EXAMPLE_SHOWCASE_SOUNDS,
  MCP_VIDEOGAME_QUEST_SOUNDS,
  TREASURE_CHEST_SOUND,
} from './sounds';

type CodeFormat = 'webaudio' | 'tone';

const SLIDESHOW_STEPS = [
  {
    step: 1,
    title: 'Connect an AI Agent via WebMCP (or Compose Manually)',
    summary:
      'Open Sound Machine Generator in Chrome with WebMCP enabled, or use the Studio Console directly. An AI agent can call compose_sound (with unisonVoices, fmDecayMs, and reverbMix) and export_current_sound on demand.',
    code: `// WebMCP Agent Workflow on Sound Machine Generator
// 1. Agent calls compose_sound({ name: "Power-Up Orb", reverbMix: 0.32, layers: [...] })
// 2. Agent calls play_current_sound() to audition in the browser
// 3. Agent calls export_current_sound({ download: false })
//    -> Receives Tone.js code, 1:1 Vanilla Web Audio API code, and JSON!`,
  },
  {
    step: 2,
    title: 'Choose Zero-Dependency Web Audio API or Tone.js',
    summary:
      'Copy the Vanilla Web Audio API tab for zero external dependencies (includes native FM synthesis, pink/brown noise, unison detune, compressor, and procedural ConvolverNode reverb), or install Tone.js for musical scheduling.',
    code: `# Optional: only needed if you choose the Tone.js output tab
npm install tone`,
  },
  {
    step: 3,
    title: 'Unlock Browser Audio on First User Gesture',
    summary:
      'Modern browsers and Mobile Safari block audio until a user taps or clicks. Call await audioCtx.resume() (or await Tone.start()) inside your button or pointer handler.',
    code: `button.addEventListener('pointerdown', async () => {
  await playLegendaryPowerUpOrb(); // Resumes AudioContext & plays immediately
});`,
  },
  {
    step: 4,
    title: 'Drop In Your Generated Sound Function',
    summary:
      'Paste the exported function from Sound Machine Generator directly into your game or app. No .mp3 downloads, no audio sprite loading, and instant zero-latency playback.',
    code: `export async function playCorrectAnswerChime() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  // Native FM chime + 2x unison detune + procedural ConvolverNode reverb
}`,
  },
  {
    step: 5,
    title: 'Wire Triggers & Ship Anywhere',
    summary:
      'Attach your sound functions to clicks, pickups, boss lasers, level-ups, or UI chimes across desktop, tablet, and mobile browsers.',
    code: `// Programmatic Game Event
if (playerCollectedOrb) {
  await playLegendaryPowerUpOrb();
} else if (bossFiredLaser) {
  await playRetroBossLaserBlast();
}`,
  },
];

export function ExampleApp() {
  const [activeId, setActiveId] = useState<string>(EXAMPLE_SHOWCASE_SOUNDS[0].id);
  const [activeCodeMode, setActiveCodeMode] = useState<CodeFormat>('webaudio');
  const [questId, setQuestId] = useState<string>(MCP_VIDEOGAME_QUEST_SOUNDS[0].id);
  const [questView, setQuestView] = useState<'webaudio' | 'tone' | 'mcp'>('webaudio');
  const [slideIndex, setSlideIndex] = useState(0);
  const [copiedSlide, setCopiedSlide] = useState(false);
  const [copiedSound, setCopiedSound] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [copiedQuestCode, setCopiedQuestCode] = useState(false);
  const [copiedChest, setCopiedChest] = useState(false);
  const [showChestCode, setShowChestCode] = useState(false);
  const [lastPlayedLabel, setLastPlayedLabel] = useState<string>('Ready to Play');

  const activeItem =
    EXAMPLE_SHOWCASE_SOUNDS.find((s) => s.id === activeId) ?? EXAMPLE_SHOWCASE_SOUNDS[0];
  const activeCode =
    activeCodeMode === 'webaudio'
      ? generateVanillaWebAudioCode(activeItem.recipe)
      : generateToneJsCode(activeItem.recipe);

  const activeQuest =
    MCP_VIDEOGAME_QUEST_SOUNDS.find((q) => q.id === questId) ?? MCP_VIDEOGAME_QUEST_SOUNDS[0];
  const activeQuestCode =
    questView === 'mcp'
      ? JSON.stringify(
          {
            tool: 'compose_sound',
            arguments: {
              name: activeQuest.recipe.name,
              description: activeQuest.recipe.description,
              masterVolumeDb: activeQuest.recipe.masterVolumeDb,
              reverbMix: activeQuest.recipe.reverbMix,
              reverbDecaySec: activeQuest.recipe.reverbDecaySec,
              layers: activeQuest.recipe.layers,
            },
          },
          null,
          2
        )
      : questView === 'webaudio'
        ? generateVanillaWebAudioCode(activeQuest.recipe)
        : generateToneJsCode(activeQuest.recipe);

  const chestCode = generateToneJsCode(TREASURE_CHEST_SOUND);
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

  const handlePlayShowcase = async (item: (typeof EXAMPLE_SHOWCASE_SOUNDS)[number]) => {
    setActiveId(item.id);
    setLastPlayedLabel(item.label);
    await soundEngine.playRecipe(item.recipe);
  };

  const handlePlayQuest = async (quest: (typeof MCP_VIDEOGAME_QUEST_SOUNDS)[number]) => {
    setQuestId(quest.id);
    setLastPlayedLabel(quest.title);
    await soundEngine.playRecipe(quest.recipe);
  };

  return (
    <div className="app-shell">
      <header className="global-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <Gamepad2 size={22} />
            </div>
            <div>
              <h1 className="brand-title">Sound Machine Arcade</h1>
              <p className="brand-subtitle">Procedural Game Audio &amp; WebMCP Showcase</p>
            </div>
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="status-pill ready" title="Last triggered sound">
              <AudioWaveform size={14} />
              <span>{lastPlayedLabel}</span>
            </span>
            <a href="../" className="btn-primary" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} />
              <span>Open Studio Console</span>
            </a>
          </div>
        </div>
      </header>

      <main className="main-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Videogame HUD Hero */}
        <section className="hero-banner" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <span className="layer-badge">
              <Sparkles size={13} /> 0 AUDIO FILES • 100% CODE
            </span>
            <span className="layer-badge">
              <Cpu size={13} /> NATIVE WEB AUDIO + TONE.JS
            </span>
            <span className="layer-badge">
              <Bot size={13} /> WEBMCP AGENT READY
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', alignItems: 'center' }}>
            <div>
              <h2 className="hero-title" style={{ marginBottom: '10px' }}>
                Level Up Your App With Pure Code Audio.
              </h2>
              <p style={{ margin: '0 0 18px 0', color: 'var(--color-text-secondary)', maxWidth: '64ch' }}>
                Synthesize Duolingo-style chimes, arcade lasers, explosions, and RPG fanfares in real
                time—powered by procedural FM synthesis, unison detune, and stereo reverb with zero
                MP3 or WAV assets.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a href="#effects-board" className="btn-pill" style={{ textDecoration: 'none' }}>
                  <Volume2 size={16} />
                  <span>Play Sound Deck</span>
                </a>
                <a href="#agent-mcp-quests" className="btn-secondary" style={{ textDecoration: 'none' }}>
                  <Bot size={16} />
                  <span>Agent MCP Quests</span>
                </a>
                <a href="#developer-slideshow" className="btn-secondary" style={{ textDecoration: 'none' }}>
                  <Sliders size={16} />
                  <span>5-Step Guide</span>
                </a>
              </div>
            </div>

            {/* HUD Stat Card */}
            <div
              className="surface-card"
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-code-bg)',
                color: 'var(--color-on-dark)',
                borderColor: 'var(--border-accent)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', color: '#54DDF2', fontWeight: 700 }}>
                  SYNTH ENGINE HUD
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)', color: '#94A3B8' }}>
                  v2.0 HYBRID
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-caption)' }}>
                <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-code-surface)' }}>
                  <div style={{ color: '#94A3B8' }}>POLYPHONY</div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#FFFFFF' }}>Up to 3x Unison</div>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-code-surface)' }}>
                  <div style={{ color: '#94A3B8' }}>SPACE</div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#FFFFFF' }}>Procedural Reverb</div>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-code-surface)' }}>
                  <div style={{ color: '#94A3B8' }}>TRANSIENTS</div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#FFFFFF' }}>Dynamic FM Decay</div>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-code-surface)' }}>
                  <div style={{ color: '#94A3B8' }}>EXPORT</div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#54DDF2' }}>1:1 Web Audio API</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Live Sound Effects Board */}
        <section id="effects-board" aria-label="Live Sound Effects Showcase">
          <div className="section-header" style={{ marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Gamepad2 size={20} color="#0C8DA1" />
                <span>Arcade Sound Deck</span>
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Trigger any procedural sound effect below to hear it live and inspect its zero-asset code.
              </p>
            </div>
            <a href="../" className="btn-secondary" style={{ textDecoration: 'none', fontSize: 'var(--text-caption)' }}>
              <span>Customize in Studio</span>
              <ArrowRight size={14} />
            </a>
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
                          boxShadow: 'var(--shadow-elevated)',
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
                    onPointerDown={() => void handlePlayShowcase(item)}
                  >
                    <Play size={15} fill="currentColor" />
                    <span>Trigger {item.label}</span>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="code-tabs" role="tablist" aria-label="Showcase code format">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCodeMode === 'webaudio'}
                  className={`code-tab ${activeCodeMode === 'webaudio' ? 'active' : ''}`}
                  onClick={() => setActiveCodeMode('webaudio')}
                >
                  Web Audio API
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCodeMode === 'tone'}
                  className={`code-tab ${activeCodeMode === 'tone' ? 'active' : ''}`}
                  onClick={() => setActiveCodeMode('tone')}
                >
                  Tone.js
                </button>
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
                <span>{copiedSound ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
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

        {/* Use with Agents through WebMCP: 3 Videogame Prompt Quests */}
        <section
          id="agent-mcp-quests"
          className="surface-card"
          style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: '20px' }}
          aria-label="Use with AI Agents through WebMCP"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="layer-badge">
                  <Bot size={13} /> USE WITH AGENTS THROUGH WEBMCP
                </span>
                <span className="layer-badge">3 VIDEOGAME PROMPT QUESTS</span>
              </div>
              <h2 className="section-title">Prompt an AI Agent, Audition &amp; Export Real Game Audio</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', maxWidth: '76ch' }}>
                Connect any WebMCP-compatible AI agent to the Sound Machine Studio tab. The agent calls{' '}
                <code>compose_sound</code> with unison detune, FM decay, and procedural reverb, auditions it with{' '}
                <code>play_current_sound</code>, and returns production code via <code>export_current_sound</code>.
              </p>
            </div>
          </div>

          <div className="playground-grid">
            {MCP_VIDEOGAME_QUEST_SOUNDS.map((quest) => {
              const isSelected = quest.id === questId;
              return (
                <article
                  key={quest.id}
                  className="surface-card"
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    borderColor: isSelected ? 'var(--color-accent)' : 'var(--border-subtle)',
                    backgroundColor: isSelected ? 'var(--color-secondary-bg)' : 'var(--color-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="layer-badge">{quest.questTag}</span>
                  </div>

                  <strong style={{ fontSize: '1.05rem' }}>{quest.title}</strong>

                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--color-code-bg)',
                      color: 'var(--color-code-text)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ color: '#54DDF2', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Terminal size={12} /> AGENT PROMPT
                    </div>
                    “{quest.prompt}”
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {quest.highlights.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 'var(--text-caption)',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--color-primary-bg)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-pill"
                      style={{ flex: '1 1 auto' }}
                      onPointerDown={() => void handlePlayQuest(quest)}
                    >
                      <Play size={14} fill="currentColor" />
                      <span>Play Sample Output</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={async () => {
                        await navigator.clipboard.writeText(quest.prompt);
                        setCopiedPromptId(quest.id);
                        window.setTimeout(() => setCopiedPromptId(null), 1800);
                      }}
                      title="Copy prompt for your AI agent"
                    >
                      {copiedPromptId === quest.id ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedPromptId === quest.id ? 'Copied' : 'Copy Prompt'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Selected Agent Quest Output Inspector */}
          <div className="surface-card" style={{ overflow: 'hidden' }}>
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
                <Bot size={16} color="#54DDF2" />
                <strong>Agent Output: {activeQuest.title}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div className="code-tabs" role="tablist" aria-label="Agent quest output format">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={questView === 'webaudio'}
                    className={`code-tab ${questView === 'webaudio' ? 'active' : ''}`}
                    onClick={() => setQuestView('webaudio')}
                  >
                    Web Audio API
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={questView === 'tone'}
                    className={`code-tab ${questView === 'tone' ? 'active' : ''}`}
                    onClick={() => setQuestView('tone')}
                  >
                    Tone.js
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={questView === 'mcp'}
                    className={`code-tab ${questView === 'mcp' ? 'active' : ''}`}
                    onClick={() => setQuestView('mcp')}
                  >
                    WebMCP Tool Call
                  </button>
                </div>

                <button
                  type="button"
                  className="code-tab active"
                  onClick={async () => {
                    await navigator.clipboard.writeText(activeQuestCode);
                    setCopiedQuestCode(true);
                    window.setTimeout(() => setCopiedQuestCode(false), 1800);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {copiedQuestCode ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedQuestCode ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
            <pre
              className="code-pre"
              style={{
                backgroundColor: 'var(--color-code-bg)',
                color: 'var(--color-code-text)',
                maxBlockSize: '280px',
              }}
            >
              <code>{activeQuestCode}</code>
            </pre>
          </div>
        </section>

        {/* Step-by-Step Developer Guide Slideshow */}
        <section id="developer-slideshow" className="surface-card" style={{ padding: 'var(--space-lg)' }} aria-label="Developer Step-by-Step Slideshow">
          <div className="section-header" style={{ marginBottom: '16px', flexWrap: 'wrap' }}>
            <div>
              <h2 className="section-title">Mission Briefing: 5-Step Developer Guide</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                Mission {currentSlide.step} of {SLIDESHOW_STEPS.length} — Use Prev/Next or Arrow keys
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
              <span className="layer-badge">MISSION 0{currentSlide.step}</span>
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
                Mission {s.step}
              </button>
            ))}
          </div>
        </section>

        {/* Grand Finale: Complex Multi-Stage Agent-Composed Example */}
        <section
          id="grand-finale"
          className="surface-card"
          style={{
            padding: 'var(--space-lg)',
            borderColor: 'var(--color-accent)',
            backgroundColor: 'var(--color-secondary-bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
          aria-label="Grand Finale Complex Sound Example"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="layer-badge">
                <Trophy size={13} /> BOSS LOOT • 19 LAYERS
              </span>
              <span className="layer-badge">3.5s PROCEDURAL SEQUENCE</span>
            </div>
            <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
              WebMCP Grand Finale
            </span>
          </div>

          <div>
            <h2 style={{ margin: '0 0 6px 0', fontFamily: 'var(--font-display)', fontSize: 'var(--text-display-md)' }}>
              Treasure Chest Opening &amp; Getting Item
            </h2>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', maxWidth: '76ch' }}>
              A multi-stage RPG sequence composed with Sound Machine Generator: a brass latch click
              &amp; wooden lid creak, followed by a 12-step rising chromatic suspense swell, culminating
              in a 4-note triumphant brass &amp; FM-bell item fanfare—all in pure JavaScript.
            </p>
          </div>

          <div className="playground-grid">
            <div className="surface-card" style={{ padding: '14px' }}>
              <strong style={{ fontSize: 'var(--text-sm)' }}>1. Latch &amp; Wooden Creak (0–360 ms)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}>
                FM metallic transient + rising sawtooth bandpass glide.
              </p>
            </div>
            <div className="surface-card" style={{ padding: '14px' }}>
              <strong style={{ fontSize: 'var(--text-sm)' }}>2. Rising Suspense Swell (380–2030 ms)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}>
                12 staggered chromatic triangle pulses opening a lowpass filter.
              </p>
            </div>
            <div className="surface-card" style={{ padding: '14px' }}>
              <strong style={{ fontSize: 'var(--text-sm)' }}>3. Item Fanfare &amp; Sparkle (2120–3500 ms)</strong>
              <p style={{ margin: '4px 0 0 0', fontSize: 'var(--text-caption)', color: 'var(--color-text-secondary)' }}>
                4-note ascending brass climax + C6 FM bell shimmer.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-pill"
              onPointerDown={() => {
                setLastPlayedLabel('Treasure Chest Sequence');
                void soundEngine.playRecipe(TREASURE_CHEST_SOUND);
              }}
            >
              <Play size={16} fill="currentColor" />
              <span>Open Treasure Chest</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => soundEngine.stopAll()}
            >
              <Square size={14} />
              <span>Stop</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowChestCode((v) => !v)}
            >
              <Code2 size={15} />
              <span>{showChestCode ? 'Hide 19-Layer Code' : 'Inspect 19-Layer Code'}</span>
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={async () => {
                await navigator.clipboard.writeText(chestCode);
                setCopiedChest(true);
                window.setTimeout(() => setCopiedChest(false), 1800);
              }}
            >
              {copiedChest ? <Check size={15} /> : <Copy size={15} />}
              <span>{copiedChest ? 'Copied Full Code!' : 'Copy Full Tone.js Code'}</span>
            </button>
          </div>

          {showChestCode && (
            <pre
              className="code-pre"
              style={{
                backgroundColor: 'var(--color-code-bg)',
                color: 'var(--color-code-text)',
                borderRadius: 'var(--radius-sm)',
                maxBlockSize: '360px',
              }}
            >
              <code>{chestCode}</code>
            </pre>
          )}
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
