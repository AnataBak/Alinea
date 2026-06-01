'use client';

import { useEffect, useRef } from 'react';
import { BrowserAudioPlayer } from '@/lib/client/browser-audio-player';

/**
 * Returns `true` when the assistant UI indicates an active or connecting
 * session. Used to gate the visualiser loop so we don't hammer the DOM
 * (and the GPU) while the session is idle.
 */
function isSessionActive(): boolean {
  const el = document.querySelector<HTMLDivElement>('.assistant-screen');
  if (!el) return false;
  return el.classList.contains('assistant-screen--active') ||
         el.classList.contains('assistant-screen--connecting');
}

/** Number of frequency bands to visualise. Lower on mobile = lighter paint. */
function waveCount(): number {
  return window.innerWidth < 640 ? 4 : 8;
}

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
    /** Number of consecutive frames where we detected no active session.
     *  Used to detect the idle → active transition without a MutationObserver. */
    let idleFrames = 0;
    /** Timestamp of the last frame we actually did work on (for mobile throttle). */
    let lastWorkTimestamp = 0;

    const tick = (timestamp: number) => {
      const orbEl = document.querySelector<HTMLDivElement>('.voice-orb');
      const player = BrowserAudioPlayer.lastInstance;

      // ── Idle detection ───────────────────────────────────────────────
      // When there is no running session AND no audio is playing, skip all
      // DOM work. RAF keeps running so we can react instantly when the user
      // starts a session, but without the expensive style recalculations.
      const sessionOn = isSessionActive();
      const audioOn = Boolean(player?.hasActiveSources);

      if (!sessionOn && !audioOn) {
        idleFrames = Math.min(idleFrames + 1, 9999);
        rafId = requestAnimationFrame(tick);
        return;
      }
      idleFrames = 0;

      // ── Mobile frame throttle (≈30 fps) ──────────────────────────────
      if (window.innerWidth < 640) {
        if (timestamp - lastWorkTimestamp < 32) { // ~31.25ms ≈ 32fps
          rafId = requestAnimationFrame(tick);
          return;
        }
        lastWorkTimestamp = timestamp;
      }

      if (orbEl && player) {
        const count = waveCount();

        // Get frequency data. When silent the AnalyserNode naturally
        // returns near-zero values, so the waves gracefully fade away.
        // The `voice-orb--speaking` CSS class is managed by React (through
        // the isModelSpeaking state) — we leave it alone and only drive
        // the CSS custom properties that control wave scale/opacity.
        const raw = player.hasActiveSources ? player.getFrequencyBands(count) : new Float32Array(count);

        // Exponential smoothing for a liquid, organic feel
        let bands: Float32Array;
        if (!smoothedRef.current || smoothedRef.current.length !== count) {
          smoothedRef.current = new Float32Array(raw);
          bands = raw;
        } else {
          const s = smoothedRef.current;
          for (let i = 0; i < count; i++) {
            s[i] += (raw[i] - s[i]) * 0.28;
          }
          bands = s;
        }

        // Average volume for the core glow
        let avgVolume = 0;
        for (let i = 0; i < count; i++) {
          avgVolume += bands[i];
        }
        avgVolume /= count;

        // Write per-wave CSS custom properties
        for (let i = 0; i < count; i++) {
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
