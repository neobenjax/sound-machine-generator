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
  Gamepad2,
  Play,
  Sliders,
  Square,
  Terminal,
  Trophy,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  EXAMPLE_SHOWCASE_SOUNDS,
  MCP_VIDEOGAME_QUEST_SOUNDS,
  TREASURE_CHEST_SOUND,
} from '../../example-website/sounds';
import { soundEngine } from '../../src/engine/audioEngine';
import { generateToneJsCode, generateVanillaWebAudioCode } from '../../src/engine/codeGenerator';

type CodeFormat = 'webaudio' | 'tone';

const SLIDESHOW_STEPS = [
  {
    step: 1,
    title: 'Connect an AI Agent via WebMCP (or Compose Manually)',
    summary:
      'Open Sound Machine v2 in Chrome with WebMCP enabled, or use the Studio Console directly. An AI agent can call compose_sound (with unisonVoices, fmDecayMs, and reverbMix) and export_current_sound on demand.',
    code: `// WebMCP Agent Workflow on Sound Machine v2
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
      'Paste the exported function from Sound Machine v2 directly into your game or app. No .mp3 downloads, no audio sprite loading, and instant zero-latency playback.',
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
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
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
    <div className="flex min-h-dvh flex-col bg-[#0F172A] text-[#F8FAFC]">
      {/* Global Header */}
      <header className="sticky top-0 z-40 border-b border-[#334155] bg-[#0F172A]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]"
              aria-hidden="true"
            >
              <Gamepad2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base font-bold tracking-tight text-[#F8FAFC] sm:text-lg">
                  Sound Machine Arcade
                </h1>
                <span className="rounded border border-[#22C55E]/40 bg-[#22C55E]/15 px-1.5 py-0.5 font-display text-[11px] font-semibold text-[#22C55E]">
                  v2
                </span>
              </div>
              <p className="text-xs text-[#94A3B8]">Procedural Game Audio &amp; WebMCP Showcase</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="inline-flex items-center gap-2 rounded-full border border-[#334155] bg-[#1B2336] px-3 py-1.5 font-display text-xs font-medium text-[#22C55E]"
              title="Last triggered sound"
            >
              <AudioWaveform size={14} aria-hidden="true" />
              <span className="max-w-[180px] truncate">{lastPlayedLabel}</span>
            </span>
            <a
              href="../"
              className="flex min-h-9 items-center gap-1.5 rounded-lg bg-[#22C55E] px-3.5 py-1.5 text-sm font-semibold text-[#0F172A] transition-opacity duration-150 hover:opacity-90"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              <span>Open Studio Console</span>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 sm:px-6">
        {/* Split Hero */}
        <section className="grid grid-cols-1 items-center gap-6 rounded-2xl border border-[#334155] bg-[#1B2336] p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-balance text-[#F8FAFC] sm:text-4xl">
              Level Up Your App With Pure Code Audio.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-pretty text-[#CBD5E1]">
              Synthesize UI chimes, arcade lasers, explosions, and RPG fanfares in real time.
              Powered by procedural FM synthesis, unison detune, and stereo reverb with zero MP3 or
              WAV files.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#effects-board"
                className="flex min-h-10 items-center gap-2 rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-[#0F172A] transition-opacity duration-150 hover:opacity-90"
              >
                <Volume2 size={16} aria-hidden="true" />
                <span>Play Sound Deck</span>
              </a>
              <a
                href="#agent-mcp-quests"
                className="flex min-h-10 items-center gap-2 rounded-lg border border-[#475569] bg-[#272F42] px-4 py-2 text-sm font-medium text-[#F8FAFC] transition-colors duration-150 hover:border-[#22C55E] hover:text-[#22C55E]"
              >
                <Bot size={16} aria-hidden="true" />
                <span>Agent MCP Quests</span>
              </a>
              <a
                href="#developer-slideshow"
                className="flex min-h-10 items-center gap-2 rounded-lg border border-[#475569] bg-[#0F172A] px-4 py-2 text-sm font-medium text-[#CBD5E1] transition-colors duration-150 hover:border-[#64748B] hover:text-[#F8FAFC]"
              >
                <Sliders size={16} aria-hidden="true" />
                <span>5-Step Guide</span>
              </a>
            </div>
          </div>

          {/* Interactive Engine Telemetry Card */}
          <div className="rounded-xl border border-[#475569] bg-[#0F172A] p-5">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <span className="font-display text-xs font-semibold text-[#22C55E]">
                SYNTH ENGINE TELEMETRY
              </span>
              <span className="font-display text-xs text-[#94A3B8]">v2.0 HYBRID</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#334155] bg-[#1B2336] p-3">
                <div className="text-xs text-[#94A3B8]">Polyphony</div>
                <div className="mt-1 font-display text-sm font-bold tabular-nums text-[#F8FAFC]">
                  3x Unison
                </div>
              </div>
              <div className="rounded-lg border border-[#334155] bg-[#1B2336] p-3">
                <div className="text-xs text-[#94A3B8]">Asset Weight</div>
                <div className="mt-1 font-display text-sm font-bold tabular-nums text-[#22C55E]">
                  0 KB Audio
                </div>
              </div>
              <div className="rounded-lg border border-[#334155] bg-[#1B2336] p-3">
                <div className="text-xs text-[#94A3B8]">FM Synthesis</div>
                <div className="mt-1 font-display text-sm font-bold text-[#F8FAFC]">
                  Native Carrier
                </div>
              </div>
              <div className="rounded-lg border border-[#334155] bg-[#1B2336] p-3">
                <div className="text-xs text-[#94A3B8]">Spatial FX</div>
                <div className="mt-1 font-display text-sm font-bold text-[#F8FAFC]">
                  Stereo Reverb
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handlePlayShowcase(EXAMPLE_SHOWCASE_SOUNDS[0])}
              className="mt-4 flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#22C55E]/50 bg-[#22C55E]/15 px-4 py-2 text-sm font-semibold text-[#22C55E] transition-colors duration-150 hover:bg-[#22C55E] hover:text-[#0F172A]"
            >
              <Play size={15} aria-hidden="true" />
              <span>Test Sub-Bass Explosion</span>
            </button>
          </div>
        </section>

        {/* Sound Deck + Live Code Inspector */}
        <section id="effects-board" className="scroll-mt-20">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[#F8FAFC]">
                Interactive Sound Deck
              </h2>
              <p className="mt-1 text-sm text-[#CBD5E1]">
                Tap any pad to audition its synthesis layers and inspect the generated code.
              </p>
            </div>
            <button
              type="button"
              onClick={() => soundEngine.stopAll()}
              className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#1B2336] px-3 py-1.5 text-xs font-semibold text-[#F8FAFC] transition-colors duration-150 hover:border-[#EF4444] hover:text-[#EF4444]"
            >
              <Square size={13} aria-hidden="true" />
              <span>Stop All</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EXAMPLE_SHOWCASE_SOUNDS.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void handlePlayShowcase(item)}
                    className={`flex cursor-pointer flex-col justify-between rounded-xl border p-4 text-left transition-colors duration-150 ${
                      isActive
                        ? 'border-[#22C55E] bg-[#22C55E]/10'
                        : 'border-[#334155] bg-[#1B2336] hover:border-[#475569] hover:bg-[#272F42]/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-sm font-bold text-[#F8FAFC]">
                        {item.label}
                      </span>
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                          isActive
                            ? 'bg-[#22C55E] text-[#0F172A]'
                            : 'bg-[#272F42] text-[#22C55E]'
                        }`}
                        aria-hidden="true"
                      >
                        <Play size={14} />
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[#CBD5E1]">{item.subtitle}</p>
                    <span className="mt-3 inline-block font-display text-[11px] font-medium text-[#94A3B8]">
                      {item.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-[#334155] bg-[#1B2336]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#334155] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Code2 size={16} className="text-[#22C55E]" aria-hidden="true" />
                  <span className="font-display text-sm font-semibold text-[#F8FAFC]">
                    {activeItem.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex rounded-md border border-[#334155] bg-[#0F172A] p-0.5">
                    <button
                      type="button"
                      onClick={() => setActiveCodeMode('webaudio')}
                      className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium ${
                        activeCodeMode === 'webaudio'
                          ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                          : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                      }`}
                    >
                      Web Audio
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCodeMode('tone')}
                      className={`cursor-pointer rounded px-2.5 py-1 text-xs font-medium ${
                        activeCodeMode === 'tone'
                          ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                          : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                      }`}
                    >
                      Tone.js
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(activeCode);
                      setCopiedSound(true);
                      window.setTimeout(() => setCopiedSound(false), 1600);
                    }}
                    className="flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-[#475569] bg-[#272F42] px-2.5 py-1 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E] hover:text-[#22C55E]"
                  >
                    {copiedSound ? (
                      <Check size={13} aria-hidden="true" />
                    ) : (
                      <Copy size={13} aria-hidden="true" />
                    )}
                    <span>{copiedSound ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <pre className="max-h-[420px] flex-1 overflow-auto bg-[#0F172A] p-4 font-display text-xs leading-relaxed text-[#E2E8F0]">
                <code>{activeCode}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Agent WebMCP Quests */}
        <section id="agent-mcp-quests" className="scroll-mt-20">
          <div className="mb-4">
            <h2 className="font-display text-xl font-bold text-[#F8FAFC]">
              WebMCP Agent Quests
            </h2>
            <p className="mt-1 text-sm text-[#CBD5E1]">
              Example prompts an AI agent can run against the Studio Console&apos;s{' '}
              <code className="font-display text-xs text-[#22C55E]">compose_sound</code> tool.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="flex flex-col gap-3">
              {MCP_VIDEOGAME_QUEST_SOUNDS.map((quest) => {
                const selected = quest.id === questId;
                return (
                  <div
                    key={quest.id}
                    className={`rounded-xl border p-4 transition-colors duration-150 ${
                      selected
                        ? 'border-[#22C55E] bg-[#22C55E]/10'
                        : 'border-[#334155] bg-[#1B2336]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-display text-xs font-semibold text-[#22C55E]">
                          {quest.questTag}
                        </span>
                        <h3 className="font-display text-base font-bold text-[#F8FAFC]">
                          {quest.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handlePlayQuest(quest)}
                        className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#22C55E] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:opacity-90"
                      >
                        <Play size={13} aria-hidden="true" />
                        <span>Play</span>
                      </button>
                    </div>

                    <p className="mt-2 rounded-lg border border-[#334155] bg-[#0F172A] p-2.5 text-xs leading-relaxed text-[#CBD5E1]">
                      &ldquo;{quest.prompt}&rdquo;
                    </p>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-[#94A3B8]">
                        {quest.recipe.layers.length} layers • Reverb{' '}
                        {Math.round((quest.recipe.reverbMix ?? 0) * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(quest.prompt);
                          setCopiedPromptId(quest.id);
                          window.setTimeout(() => setCopiedPromptId(null), 1600);
                        }}
                        className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#CBD5E1] hover:text-[#22C55E]"
                      >
                        {copiedPromptId === quest.id ? (
                          <Check size={13} aria-hidden="true" />
                        ) : (
                          <Copy size={13} aria-hidden="true" />
                        )}
                        <span>{copiedPromptId === quest.id ? 'Prompt Copied' : 'Copy Prompt'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-[#334155] bg-[#1B2336]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#334155] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-[#22C55E]" aria-hidden="true" />
                  <span className="font-display text-sm font-semibold text-[#F8FAFC]">
                    {activeQuest.title}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex rounded-md border border-[#334155] bg-[#0F172A] p-0.5">
                    {(
                      [
                        { id: 'webaudio', label: 'Web Audio' },
                        { id: 'tone', label: 'Tone.js' },
                        { id: 'mcp', label: 'MCP Tool' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setQuestView(tab.id)}
                        className={`cursor-pointer rounded px-2 py-1 text-xs font-medium ${
                          questView === tab.id
                            ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                            : 'text-[#CBD5E1] hover:text-[#F8FAFC]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(activeQuestCode);
                      setCopiedQuestCode(true);
                      window.setTimeout(() => setCopiedQuestCode(false), 1600);
                    }}
                    className="flex min-h-8 cursor-pointer items-center gap-1 rounded-md border border-[#475569] bg-[#272F42] px-2.5 py-1 text-xs font-semibold text-[#F8FAFC] hover:border-[#22C55E] hover:text-[#22C55E]"
                  >
                    {copiedQuestCode ? (
                      <Check size={13} aria-hidden="true" />
                    ) : (
                      <Copy size={13} aria-hidden="true" />
                    )}
                    <span>{copiedQuestCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <pre className="max-h-[480px] flex-1 overflow-auto bg-[#0F172A] p-4 font-display text-xs leading-relaxed text-[#E2E8F0]">
                <code>{activeQuestCode}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* 5-Step Developer Slideshow */}
        <section
          id="developer-slideshow"
          className="scroll-mt-20 rounded-2xl border border-[#334155] bg-[#1B2336] p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#334155] pb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-[#F8FAFC]">
                5-Step Integration Walkthrough
              </h2>
              <p className="mt-1 text-sm text-[#CBD5E1]">
                Use Left/Right arrow keys or the stepper buttons to walk through shipping audio.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                disabled={slideIndex === 0}
                aria-label="Previous step"
                className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[#475569] bg-[#272F42] text-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span className="font-display text-xs font-semibold tabular-nums text-[#CBD5E1]">
                Step {currentSlide.step} / {SLIDESHOW_STEPS.length}
              </span>
              <button
                type="button"
                onClick={() => setSlideIndex((i) => Math.min(SLIDESHOW_STEPS.length - 1, i + 1))}
                disabled={slideIndex === SLIDESHOW_STEPS.length - 1}
                aria-label="Next step"
                className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-[#475569] bg-[#272F42] text-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="font-display text-lg font-bold text-[#22C55E]">
              {currentSlide.step}. {currentSlide.title}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#CBD5E1]">
              {currentSlide.summary}
            </p>

            <div className="mt-4 overflow-hidden rounded-xl border border-[#334155] bg-[#0F172A]">
              <div className="flex items-center justify-between border-b border-[#334155] px-4 py-2">
                <span className="font-display text-xs text-[#94A3B8]">Snippet</span>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(currentSlide.code);
                    setCopiedSlide(true);
                    window.setTimeout(() => setCopiedSlide(false), 1600);
                  }}
                  className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#CBD5E1] hover:text-[#22C55E]"
                >
                  {copiedSlide ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  <span>{copiedSlide ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="overflow-x-auto p-4 font-display text-xs leading-relaxed text-[#E2E8F0]">
                <code>{currentSlide.code}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Live RPG Treasure Chest Demo */}
        <section className="rounded-2xl border border-[#22C55E]/40 bg-[#1B2336] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]">
                <Trophy size={22} aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-[#F8FAFC]">
                  Live In-Game Event: Treasure Chest Unlocked
                </h2>
                <p className="mt-1 text-sm text-[#CBD5E1]">
                  Multi-layered FM fanfare + sparkle arpeggio + stereo reverb synthesized on click.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLastPlayedLabel('Treasure Chest Fanfare');
                  void soundEngine.playRecipe(TREASURE_CHEST_SOUND);
                }}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#22C55E] px-4 py-2 text-sm font-semibold text-[#0F172A] hover:opacity-90"
              >
                <Play size={15} aria-hidden="true" />
                <span>Open Treasure Chest</span>
              </button>

              <button
                type="button"
                onClick={() => setShowChestCode((v) => !v)}
                className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-[#475569] bg-[#272F42] px-3.5 py-2 text-sm font-medium text-[#F8FAFC] hover:border-[#22C55E]"
              >
                <Code2 size={15} aria-hidden="true" />
                <span>{showChestCode ? 'Hide Code' : 'View Code'}</span>
              </button>
            </div>
          </div>

          {showChestCode && (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#334155] bg-[#0F172A]">
              <div className="flex items-center justify-between border-b border-[#334155] px-4 py-2">
                <span className="font-display text-xs text-[#94A3B8]">Tone.js Function</span>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(chestCode);
                    setCopiedChest(true);
                    window.setTimeout(() => setCopiedChest(false), 1600);
                  }}
                  className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#CBD5E1] hover:text-[#22C55E]"
                >
                  {copiedChest ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  <span>{copiedChest ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="max-h-72 overflow-auto p-4 font-display text-xs leading-relaxed text-[#E2E8F0]">
                <code>{chestCode}</code>
              </pre>
            </div>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#334155] pt-6 text-xs text-[#94A3B8]">
          <span>Sound Machine v2 — Procedural Web Audio &amp; WebMCP</span>
          <a
            href="../"
            className="inline-flex items-center gap-1 font-semibold text-[#22C55E] hover:underline"
          >
            <span>Launch Composer Studio</span>
            <ArrowRight size={13} aria-hidden="true" />
          </a>
        </footer>
      </main>
    </div>
  );
}
