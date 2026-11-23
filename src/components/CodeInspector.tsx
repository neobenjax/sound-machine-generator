import { Check, Code2, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { generateToneJsCode, generateVanillaWebAudioCode } from '../engine/codeGenerator';
import type { SoundRecipe } from '../engine/types';

interface CodeInspectorProps {
  recipe: SoundRecipe;
  className?: string;
}

type CodeMode = 'tone' | 'webaudio' | 'json';

export function CodeInspector({ recipe, className = '' }: CodeInspectorProps) {
  const [mode, setMode] = useState<CodeMode>('webaudio');
  const [copied, setCopied] = useState(false);

  const codeText = useMemo(() => {
    if (mode === 'tone') return generateToneJsCode(recipe);
    if (mode === 'webaudio') return generateVanillaWebAudioCode(recipe);
    return JSON.stringify(recipe, null, 2);
  }, [mode, recipe]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside
      className={`flex flex-col overflow-hidden rounded-xl border border-[#334155] bg-[#1B2336] ${className}`}
      aria-label="Generated sound code"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#334155] bg-[#0F172A]/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <Code2 size={16} className="text-[#22C55E]" aria-hidden="true" />
          <span className="font-display text-sm font-semibold text-[#F8FAFC]">
            Generated Code
          </span>
        </div>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#475569] bg-[#272F42] px-2.5 py-1 text-xs font-semibold text-[#F8FAFC] transition-colors duration-150 hover:border-[#22C55E] hover:text-[#22C55E]"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div
        className="flex items-center gap-1 border-b border-[#334155] bg-[#1B2336] px-3 py-2"
        role="tablist"
        aria-label="Code output format"
      >
        {(
          [
            { id: 'webaudio', label: 'Web Audio API' },
            { id: 'tone', label: 'Tone.js' },
            { id: 'json', label: 'JSON' },
          ] as const
        ).map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(tab.id)}
              className={`min-h-8 flex-1 cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 ${
                active
                  ? 'bg-[#22C55E] font-semibold text-[#0F172A]'
                  : 'text-[#CBD5E1] hover:bg-[#272F42] hover:text-[#F8FAFC]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <pre className="max-h-[640px] flex-1 overflow-auto bg-[#0F172A] p-4 font-display text-xs leading-relaxed text-[#E2E8F0]">
        <code>{codeText}</code>
      </pre>
    </aside>
  );
}
