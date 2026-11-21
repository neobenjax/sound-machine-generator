import type { EnvelopeConfig } from '../engine/types';

interface AdsrVisualizerProps {
  envelope: EnvelopeConfig;
}

export function AdsrVisualizer({ envelope }: AdsrVisualizerProps) {
  const { attack, decay, sustain, release } = envelope;
  const total = Math.max(0.05, attack + decay + 0.08 + release);
  const w = 220;
  const h = 48;
  const pad = 4;

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
      width="100%"
      height="48"
      aria-label="ADSR Envelope Curve"
      style={{
        backgroundColor: 'var(--color-secondary-bg)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
        display: 'block',
      }}
    >
      <path d={area} fill="var(--border-accent)" />
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
