'use client';

import { useEffect, useRef } from 'react';
import { BrowserAudioPlayer } from '@/lib/client/browser-audio-player';

/**
 * Standalone component that drives the `.voice-orb` CSS custom properties
 * with real-time frequency data from the audio player's AnalyserNode.
 *
 * It works without any props — it finds the `.voice-orb` element by CSS
 * class and reads the player from `BrowserAudioPlayer.lastInstance`.
 * Mount it anywhere inside the document body (e.g. in the root layout or
 * as a portal) and it will automatically connect when a session starts.
 */
export function VoiceOrbVisualizer() {
  const smoothedRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      const orbEl = document.querySelector<HTMLDivElement>('.voice-orb');
      const player = BrowserAudioPlayer.lastInstance;

      if (orbEl && player) {
        // Get 8 frequency bands. When silent the AnalyserNode naturally
        // returns near-zero values, so the waves gracefully fade away.
        // The `voice-orb--speaking` CSS class is managed by React (through
        // the isModelSpeaking state) — we leave it alone and only drive
        // the CSS custom properties that control wave scale/opacity.
        const raw = player.hasActiveSources ? player.getFrequencyBands(8) : new Float32Array(8);

        // Exponential smoothing for a liquid, organic feel
        let bands: Float32Array;
        if (!smoothedRef.current || smoothedRef.current.length !== 8) {
          smoothedRef.current = new Float32Array(raw);
          bands = raw;
        } else {
          const s = smoothedRef.current;
          for (let i = 0; i < 8; i++) {
            s[i] += (raw[i] - s[i]) * 0.28;
          }
          bands = s;
        }

        // Average volume for the core glow
        let avgVolume = 0;
        for (let i = 0; i < 8; i++) {
          avgVolume += bands[i];
        }
        avgVolume /= 8;

        // Write per-wave CSS custom properties
        for (let i = 0; i < 8; i++) {
          const v = Math.min(1, Math.max(0, bands[i]));

          // Natural radius progression — higher index = wave sits further out,
          // modulated by the frequency band energy.
          const baseScale = 0.12 + i * 0.14;
          const scale = baseScale + v * 5.0;
          const opacity = Math.min(0.92, v * 1.1 + 0.05);

          orbEl.style.setProperty(`--wave-${i}-scale`, String(scale));
          orbEl.style.setProperty(`--wave-${i}-opacity`, String(opacity));
        }

        // Core glow driven by overall volume
        orbEl.style.setProperty('--core-glow', String(avgVolume));
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, []);

  // This component renders nothing — all the work is done via RAF + DOM.
  return null;
}
