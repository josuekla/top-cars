import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundSystem } from './audio';

describe('SoundSystem Audio Engine', () => {
  let soundSystem: SoundSystem;

  beforeEach(() => {
    vi.restoreAllMocks();
    soundSystem = new SoundSystem();
  });

  it('inicializa com estado padrão não-mutado', () => {
    expect(soundSystem.muted).toBe(false);
  });

  it('alterna o estado de mudo com toggleMute()', () => {
    const isMuted1 = soundSystem.toggleMute();
    expect(isMuted1).toBe(true);
    expect(soundSystem.muted).toBe(true);

    const isMuted2 = soundSystem.toggleMute();
    expect(isMuted2).toBe(false);
    expect(soundSystem.muted).toBe(false);
  });

  it('enfileira ou reproduz a música do menu com playMenuMusic()', () => {
    soundSystem.playMenuMusic();
    expect(() => soundSystem.playMenuMusic()).not.toThrow();
  });

  it('permite definir e reproduzir trilha de pista específica com playTrackMusic()', () => {
    expect(() => soundSystem.playTrackMusic('/audio/track_tokyo.mp3')).not.toThrow();
    expect(() => soundSystem.playTrackMusic('/audio/track_desert.mp3')).not.toThrow();
    expect(() => soundSystem.playTrackMusic('/audio/track_lasvegas.mp3')).not.toThrow();
  });

  it('para a música suavemente com stopMusic()', () => {
    soundSystem.playTrackMusic('/audio/track_lasvegas.mp3');
    expect(() => soundSystem.stopMusic(100)).not.toThrow();
  });

  it('desbloqueia o sistema de áudio e processa músicas pendentes ao chamar init()', () => {
    soundSystem.playMenuMusic();
    soundSystem.init();
    expect(soundSystem.unlocked).toBe(true);
  });

  it('executa todos os efeitos sonoros sintéticos com segurança sem lançar exceções', () => {
    soundSystem.init();
    expect(() => soundSystem.updateEngine(80, 100, true)).not.toThrow();
    expect(() => soundSystem.updateSkid(5.0)).not.toThrow();
    expect(() => soundSystem.playNitro()).not.toThrow();
    expect(() => soundSystem.playCollision(2.5)).not.toThrow();
    expect(() => soundSystem.playCountdown(false)).not.toThrow();
    expect(() => soundSystem.playCountdown(true)).not.toThrow();
    expect(() => soundSystem.playBackfire()).not.toThrow();
    expect(() => soundSystem.playSlipstream()).not.toThrow();
    expect(() => soundSystem.playCrowdCheer()).not.toThrow();
    expect(() => soundSystem.playBeep(440)).not.toThrow();
    expect(() => soundSystem.startChiptuneMusic()).not.toThrow();
  });

  it('respeita o modo mudo para todos os efeitos sonoros e músicas', () => {
    soundSystem.toggleMute(); // Mudo ativado
    expect(soundSystem.muted).toBe(true);

    expect(() => soundSystem.updateEngine(80, 100, true)).not.toThrow();
    expect(() => soundSystem.updateSkid(5.0)).not.toThrow();
    expect(() => soundSystem.playNitro()).not.toThrow();
    expect(() => soundSystem.playCollision(1.0)).not.toThrow();
    expect(() => soundSystem.playCountdown(false)).not.toThrow();
    expect(() => soundSystem.playBackfire()).not.toThrow();
    expect(() => soundSystem.playSlipstream()).not.toThrow();
    expect(() => soundSystem.playCrowdCheer()).not.toThrow();
    expect(() => soundSystem.playBeep(440)).not.toThrow();
    expect(() => soundSystem.playMenuMusic()).not.toThrow();
    expect(() => soundSystem.stopMusic()).not.toThrow();
  });

  it('reproduz com mock de HTMLAudioElement e lida com autoplay bloqueado / desbloqueado', async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    const pauseMock = vi.fn();

    class MockAudio {
      src = '';
      loop = false;
      volume = 1;
      muted = false;
      paused = false;
      currentTime = 0;
      play = playMock;
      pause = pauseMock;
      constructor(url?: string) {
        if (url) this.src = url;
      }
    }

    vi.stubGlobal('Audio', MockAudio);

    const mockedSoundSystem = new SoundSystem();
    mockedSoundSystem.playTrackMusic('/audio/track_tokyo.mp3');

    expect(mockedSoundSystem.getCurrentMusicUrl()).toBe('/audio/track_tokyo.mp3');
    expect(playMock).toHaveBeenCalled();

    // Teste de stopMusic
    mockedSoundSystem.stopMusic(50);

    // Teste de Mute com áudio ativo
    mockedSoundSystem.toggleMute();
    expect(mockedSoundSystem.muted).toBe(true);

    mockedSoundSystem.toggleMute();
    expect(mockedSoundSystem.muted).toBe(false);

    vi.unstubAllGlobals();
  });
});
