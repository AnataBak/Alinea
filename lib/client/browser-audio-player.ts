import { AUDIO_OUTPUT_SAMPLE_RATE } from '@/lib/live-session-config';
import { pcm16Base64ToFloat32 } from '@/lib/client/audio-utils';

export class BrowserAudioPlayer {
  /** Last created instance, used by visualiser components outside React tree. */
  static lastInstance: BrowserAudioPlayer | null = null;

  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private scheduledSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;

  /** True when at least one source is scheduled (used by visualiser). */
  get hasActiveSources(): boolean {
    return this.scheduledSources.size > 0;
  }

  async ensureReady() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: AUDIO_OUTPUT_SAMPLE_RATE });
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      // Smoothing is handled in JS (VoiceOrbVisualizer) for precise control;
      // the AnalyserNode itself stays crisp so frequency data is responsive.
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1;
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      this.nextStartTime = this.audioContext.currentTime;
      BrowserAudioPlayer.lastInstance = this;
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async enqueueBase64Pcm(base64Audio: string) {
    await this.ensureReady();

    if (!this.audioContext || !this.gainNode) {
      return;
    }

    const float32 = pcm16Base64ToFloat32(base64Audio);
    const buffer = this.audioContext.createBuffer(1, float32.length, AUDIO_OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    if (this.analyserNode) {
      source.connect(this.analyserNode);
    } else {
      source.connect(this.gainNode);
    }

    const now = this.audioContext.currentTime;
    const startTime = Math.max(now, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;
    this.scheduledSources.add(source);

    source.onended = () => {
      this.scheduledSources.delete(source);
    };
  }

  /**
   * Returns `bandCount` frequency magnitude values normalized to 0…1.
   * Each value represents the average energy in a frequency band,
   * suitable for driving equaliser-style visualisations.
   */
  getFrequencyBands(bandCount: number): Float32Array {
    if (!this.analyserNode) {
      return new Float32Array(bandCount);
    }

    const bins = this.analyserNode.frequencyBinCount;
    const raw = new Uint8Array(bins);
    this.analyserNode.getByteFrequencyData(raw);

    const result = new Float32Array(bandCount);
    const binsPerGroup = Math.floor(bins / bandCount);

    for (let i = 0; i < bandCount; i++) {
      let sum = 0;
      const start = i * binsPerGroup;
      const end = i === bandCount - 1 ? bins : start + binsPerGroup;
      for (let j = start; j < end; j++) {
        sum += raw[j];
      }
      const count = end - start;
      result[i] = count > 0 ? sum / count / 255 : 0;
    }

    return result;
  }

  interrupt() {
    for (const source of this.scheduledSources) {
      try {
        source.stop();
      } catch {
        // Ignore already stopped nodes.
      }
    }

    this.scheduledSources.clear();

    if (this.audioContext) {
      this.nextStartTime = this.audioContext.currentTime;
    }
  }

  async destroy() {
    this.interrupt();

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
      this.analyserNode = null;
      this.gainNode = null;
    }

    if (BrowserAudioPlayer.lastInstance === this) {
      BrowserAudioPlayer.lastInstance = null;
    }
  }
}
