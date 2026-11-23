import type { EnvelopeConfig } from '../engine/types';

interface AdsrVisualizerProps {
  envelope: EnvelopeConfig;
}

export function AdsrVisualizer({ envelope }: AdsrVisualizerProps) {
  const { attack, decay, sustain, release } = envelope;
  const total = Math.max(0.05, attack + decay + 0.08 + release);
  const w = 240;
  const h = 52;
  const pad = 5;

  const xA = pad + (attack / total) * (w - pad * 2);
  const xD = xA + (decay / total) * (w - pad * 2);
  const xS = xD + (0.08 / total) * (w - pad * 2);
  const xR = w - pad;

  const yTop = pad;
  const yBottom = h - pad;
  const ySustain = yBottom - sustain * (h - pad * 2);

  const path = `M ${pad} ${yBottom} L ${xA.toFixed(1)} ${yTop} L ${xD.toFixed(1)} ${ySustain.toFixed(1)} L ${xS.toFixed(1)} ${ySustain.toFixed(1)} L ${xR.toFixed(1)} ${yBottom}`;
  const area = `${path} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="block h-13 w-full rounded-md border border-[#334155] bg-[#0F172A]"
      role="img"
      aria-label={`ADSR envelope curve: attack ${attack}s, decay ${decay}s, sustain ${sustain}, release ${release}s`}
    >
      <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="#1E293B" strokeWidth="1" />
      <path d={area} fill="rgba(34, 197, 94, 0.16)" />
      <path d={path} fill="none" stroke="#22C55E" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
