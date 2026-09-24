import { useEffect, useRef } from 'react';

/**
 * Drives the orb from the live microphone level. The level is written straight to a CSS
 * variable each frame instead of going through React state, so it never re-renders. If the
 * mic can't be opened a second time (some mobile browsers hold it exclusively for speech
 * recognition), the orb falls back to a gentle idle breathing.
 */
function useMicLevel(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let ctx: AudioContext | undefined;
    let analyser: AnalyserNode | undefined;
    let samples: Uint8Array | undefined;
    let level = 0;

    const tick = (now: number) => {
      let target = 0.12 + 0.08 * Math.sin(now / 350);
      if (analyser && samples) {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          const v = (samples[i] - 128) / 128;
          sum += v * v;
        }
        target = Math.min(1, Math.sqrt(sum / samples.length) * 5);
      }
      level += (target - level) * (target > level ? 0.35 : 0.08);
      ref.current?.style.setProperty('--lvl', level.toFixed(3));
      raf = requestAnimationFrame(tick);
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
        ctx = new AudioCtx();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        samples = new Uint8Array(analyser.fftSize);
      } catch {
        analyser = undefined;
      }
    };

    start();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => undefined);
    };
  }, [ref]);
}

/** Soft green-white cloudy orb that swells and brightens with the speaker's voice. */
export default function VoiceOrb() {
  const ref = useRef<HTMLSpanElement>(null);
  useMicLevel(ref);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="voice-orb pointer-events-none absolute inset-0 rounded-full"
      style={{ '--lvl': 0 } as React.CSSProperties}
    >
      <style>{`
        .voice-orb {
          transform: scale(calc(1 + var(--lvl) * 0.14));
          box-shadow: 0 0 calc(10px + var(--lvl) * 30px) calc(var(--lvl) * 6px)
            rgba(74, 222, 128, calc(0.3 + var(--lvl) * 0.4));
        }
        .voice-orb-body {
          background: radial-gradient(circle at 50% 28%, #4ade80 0%, #22c55e 55%, #16a34a 100%);
          box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.55),
            inset 0 -6px 14px rgba(255, 255, 255, 0.35);
        }
        .voice-orb-cloud {
          position: absolute;
          border-radius: 9999px;
          filter: blur(9px);
          will-change: transform;
        }
        @keyframes voice-orb-drift-a {
          0%, 100% { transform: translateX(-10%) rotate(-4deg); }
          50% { transform: translateX(10%) rotate(4deg); }
        }
        @keyframes voice-orb-drift-b {
          0%, 100% { transform: translate(8%, 4%) scale(1); }
          50% { transform: translate(-10%, -6%) scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .voice-orb-cloud { animation: none !important; }
        }
      `}</style>
      <span className="voice-orb-body absolute inset-0 overflow-hidden rounded-full">
        <span
          className="voice-orb-cloud bg-white"
          style={{
            left: '-15%',
            top: '58%',
            width: '130%',
            height: '55%',
            opacity: 'calc(0.55 + var(--lvl) * 0.45)',
            translate: '0 calc(var(--lvl) * -18%)',
            animation: 'voice-orb-drift-a 6s ease-in-out infinite',
          }}
        />
        <span
          className="voice-orb-cloud"
          style={{
            left: '8%',
            top: '18%',
            width: '62%',
            height: '48%',
            background: '#d1fae5',
            opacity: 'calc(0.25 + var(--lvl) * 0.55)',
            scale: 'calc(0.9 + var(--lvl) * 0.5)',
            animation: 'voice-orb-drift-b 7.5s ease-in-out infinite',
          }}
        />
        <span
          className="voice-orb-cloud bg-white"
          style={{
            right: '-6%',
            top: '4%',
            width: '42%',
            height: '36%',
            opacity: 'calc(0.1 + var(--lvl) * 0.6)',
            scale: 'calc(0.8 + var(--lvl) * 0.6)',
            animation: 'voice-orb-drift-b 9s ease-in-out -3s infinite',
          }}
        />
      </span>
    </span>
  );
}
