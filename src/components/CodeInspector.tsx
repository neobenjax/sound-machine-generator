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
  const [mode, setMode] = useState<CodeMode>('tone');
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
    <aside className={`code-panel ${className}`} aria-label="Generated sound code">
      <div className="code-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Code2 size={16} color="#54DDF2" />
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Generated Code</span>
        </div>

        <div className="code-tabs" role="tablist" aria-label="Code output format">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'tone'}
            className={`code-tab ${mode === 'tone' ? 'active' : ''}`}
            onClick={() => setMode('tone')}
          >
            Tone.js
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'webaudio'}
            className={`code-tab ${mode === 'webaudio' ? 'active' : ''}`}
            onClick={() => setMode('webaudio')}
          >
            Web Audio API
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'json'}
            className={`code-tab ${mode === 'json' ? 'active' : ''}`}
            onClick={() => setMode('json')}
          >
            JSON
          </button>
        </div>

        <button
          type="button"
          className="code-tab active"
          onClick={handleCopy}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <pre className="code-pre">
        <code>{codeText}</code>
      </pre>
    </aside>
  );
}
