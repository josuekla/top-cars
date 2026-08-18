export class SoundSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isUnlocked: boolean = false;

  // Gerenciamento de Trilhas Sonoras MP3
  private currentMusic: HTMLAudioElement | null = null;
  private currentMusicUrl: string | null = null;
  private pendingMusicUrl: string | null = null;
  private musicVolume: number = 0.55;
  private fadeTimer: any = null;

  // Nós do Som do Motor
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Nós de Derrapagem (Skid)
  private skidSource: AudioBufferSourceNode | null = null;
  private skidGain: GainNode | null = null;

  // Sequenciador de Música Chiptune (Compatibilidade retrô / fallback sintético)
  private musicInterval: any = null;
  private musicStep: number = 0;
  private isMusicPlaying: boolean = false;

  constructor() {
    // Desbloqueia AudioContext e trilha sonora na primeira interação do usuário (evita bloqueios de autoplay)
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.init();
        if (this.isUnlocked) {
          window.removeEventListener('click', unlock);
          window.removeEventListener('keydown', unlock);
          window.removeEventListener('touchstart', unlock);
          window.removeEventListener('pointerdown', unlock);
        }
      };
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
      window.addEventListener('pointerdown', unlock, { passive: true });
    }
  }

  public init(): void {
    if (typeof window !== 'undefined' && !this.ctx) {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
          this.setupEngineSound();
          this.setupSkidSound();
        }
      } catch {
        // Fallback silencioso
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.isUnlocked = true;

    // Se havia alguma música aguardando permissão de autoplay, inicia agora
    if (this.pendingMusicUrl) {
      const pendingUrl = this.pendingMusicUrl;
      this.pendingMusicUrl = null;
      this.playTrackMusic(pendingUrl);
    }
  }

  public playMenuMusic(): void {
    this.playTrackMusic('/audio/intro.mp3');
  }

  public playTrackMusic(musicUrl: string): void {
    this.pendingMusicUrl = musicUrl;

    // Se já estiver tocando a mesma música e não estiver pausada
    if (this.currentMusic && this.currentMusicUrl === musicUrl && !this.currentMusic.paused) {
      if (!this.isMuted) {
        this.fadeInCurrent(this.musicVolume, 300);
      }
      return;
    }

    // Limpa fade anterior se houver
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    const startAudio = () => {
      try {
        if (typeof Audio === 'undefined') return;

        if (this.currentMusic) {
          this.currentMusic.pause();
          this.currentMusic.src = '';
          this.currentMusic = null;
        }

        const audio = new Audio(musicUrl);
        audio.loop = true;
        audio.volume = this.isMuted ? 0 : 0.01;
        this.currentMusic = audio;
        this.currentMusicUrl = musicUrl;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.isUnlocked = true;
              this.pendingMusicUrl = null;
              if (!this.isMuted) {
                this.fadeInCurrent(this.musicVolume, 400);
              }
            })
            .catch((_err) => {
              // Se bloqueado pelo autoplay do navegador, mantém na fila para a primeira interação
              this.pendingMusicUrl = musicUrl;
            });
        }
      } catch {
        // Fallback silencioso
      }
    };

    // Fade out suave da música anterior se houver
    if (this.currentMusic && !this.currentMusic.paused && this.currentMusic.volume > 0.05) {
      this.fadeOutCurrent(() => {
        startAudio();
      }, 300);
    } else {
      startAudio();
    }
  }

  public stopMusic(durationMs: number = 400): void {
    this.pendingMusicUrl = null;
    this.isMusicPlaying = false;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }

    if (!this.currentMusic || this.currentMusic.paused) {
      if (this.currentMusic) {
        this.currentMusic.currentTime = 0;
      }
      return;
    }

    this.fadeOutCurrent(() => {
      if (this.currentMusic) {
        this.currentMusic.pause();
        this.currentMusic.currentTime = 0;
        this.currentMusicUrl = null;
      }
    }, durationMs);
  }

  private fadeOutCurrent(onComplete?: () => void, durationMs: number = 300): void {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (!this.currentMusic) {
      onComplete?.();
      return;
    }

    const audio = this.currentMusic;
    const startVol = audio.volume;
    const steps = 12;
    const stepTime = Math.max(10, Math.floor(durationMs / steps));
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step++;
      const progress = step / steps;
      audio.volume = Math.max(0, startVol * (1 - progress));

      if (step >= steps) {
        if (this.fadeTimer !== null) {
          clearInterval(this.fadeTimer);
          this.fadeTimer = null;
        }
        audio.volume = 0;
        onComplete?.();
      }
    }, stepTime);
  }

  private fadeInCurrent(targetVol: number, durationMs: number = 400): void {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (!this.currentMusic || this.isMuted) return;

    const audio = this.currentMusic;
    const startVol = audio.volume;
    const steps = 12;
    const stepTime = Math.max(10, Math.floor(durationMs / steps));
    let step = 0;

    this.fadeTimer = setInterval(() => {
      step++;
      const progress = step / steps;
      audio.volume = Math.min(targetVol, startVol + (targetVol - startVol) * progress);

      if (step >= steps) {
        if (this.fadeTimer !== null) {
          clearInterval(this.fadeTimer);
          this.fadeTimer = null;
        }
        audio.volume = targetVol;
      }
    }, stepTime);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;

    if (this.isMuted) {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      if (this.skidGain && this.ctx) {
        this.skidGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      if (this.currentMusic) {
        this.currentMusic.muted = true;
        this.currentMusic.volume = 0;
      }
    } else {
      if (this.currentMusic) {
        this.currentMusic.muted = false;
        this.currentMusic.volume = this.musicVolume;
        if (this.currentMusic.paused && this.currentMusicUrl) {
          this.currentMusic.play().catch(() => {});
        }
      }
    }

    return this.isMuted;
  }

  public get muted(): boolean {
    return this.isMuted;
  }

  public get unlocked(): boolean {
    return this.isUnlocked;
  }

  public getCurrentMusicUrl(): string | null {
    return this.currentMusicUrl;
  }

  private setupEngineSound(): void {
    if (!this.ctx) return;

    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(300, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc.start();
  }

  private setupSkidSound(): void {
    if (!this.ctx) return;

    // Gera buffer de ruído branco para derrapagem
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.skidSource = this.ctx.createBufferSource();
    this.skidSource.buffer = noiseBuffer;
    this.skidSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 3.0;

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.skidSource.connect(filter);
    filter.connect(this.skidGain);
    this.skidGain.connect(this.ctx.destination);

    this.skidSource.start();
  }

  public updateEngine(speed: number, maxSpeed: number, isThrottle: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || !this.engineFilter || this.isMuted) {
      return;
    }

    const ratio = Math.min(1.2, Math.max(0, Math.abs(speed) / maxSpeed));
    const targetFreq = 45 + ratio * 240 + (isThrottle ? 30 : 0);
    const targetFilterFreq = 200 + ratio * 1200;
    const targetGain = 0.08 + (isThrottle ? 0.08 : 0.02);

    const now = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(targetFilterFreq, now, 0.08);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.05);
  }

  public updateSkid(lateralSpeed: number): void {
    if (!this.ctx || !this.skidGain || this.isMuted) return;

    const slip = Math.min(1.0, Math.max(0, (Math.abs(lateralSpeed) - 2.0) / 10.0));
    const targetGain = slip * 0.18;

    this.skidGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
  }

  public playNitro(): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.4);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  }

  public playCollision(intensity: number = 1.0): void {
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

    const clampedIntensity = Math.min(1.0, Math.max(0.1, intensity / 5.0));
    gain.gain.setValueAtTime(clampedIntensity * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playCountdown(isGo: boolean): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    const now = this.ctx.currentTime;

    const freq = isGo ? 1760 : 880;
    const duration = isGo ? 0.6 : 0.2;

    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  public playBackfire(): void {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.12);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playSlipstream(): void {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playCrowdCheer(): void {
    if (!this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
    osc.frequency.setValueAtTime(880.0, now + 0.3); // A5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  public playBeep(freq: number = 520): void {
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public startChiptuneMusic(): void {
    if (this.isMusicPlaying || !this.ctx) return;
    this.isMusicPlaying = true;
    this.musicStep = 0;

    // Linha de baixo e melodia retrô anos 90 (estilo Top Gear Las Vegas / San Francisco)
    const bassline = [110, 110, 130, 110, 146, 130, 110, 164, 110, 110, 130, 110, 146, 164, 196, 220];
    const melody = [440, 0, 523, 587, 0, 523, 440, 0, 659, 0, 587, 523, 440, 523, 587, 659];

    const stepDurationMs = 135; // ~111 BPM

    this.musicInterval = setInterval(() => {
      if (!this.ctx || this.isMuted || !this.isMusicPlaying) return;

      const now = this.ctx.currentTime;
      const bassFreq = bassline[this.musicStep % bassline.length];
      const leadFreq = melody[this.musicStep % melody.length];

      // Nota de baixo
      if (bassFreq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassFreq, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      }

      // Nota da melodia
      if (leadFreq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(leadFreq, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      }

      this.musicStep++;
    }, stepDurationMs);
  }
}

export const soundSystem = new SoundSystem();

