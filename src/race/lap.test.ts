import { describe, expect, it } from 'vitest';
import { createLapTracker, updateLapTracker } from './lap';

describe('Lap Tracking System', () => {
  it('inicializa na volta 1 com progresso zerado', () => {
    const tracker = createLapTracker(3);
    expect(tracker.currentLap).toBe(1);
    expect(tracker.totalLaps).toBe(3);
    expect(tracker.isFinished).toBe(false);
    expect(tracker.bestLapTime).toBeNull();
  });

  it('completa uma volta válida ao atravessar checkpoints e cruzar a linha de chegada', () => {
    let tracker = createLapTracker(3);
    const dt = 0.1;

    // Simula volta 1 progredindo suavemente pelo circuito: 0.0 -> 0.95 -> 0.02
    const steps = [0.0, 0.1, 0.25, 0.35, 0.5, 0.6, 0.75, 0.85, 0.95, 0.02];
    for (const prog of steps) {
      tracker = updateLapTracker(tracker, prog, dt);
    }

    expect(tracker.currentLap).toBe(2);
    expect(tracker.lapTimes.length).toBe(1);
    expect(tracker.bestLapTime).toBeGreaterThan(0);
    expect(tracker.isFinished).toBe(false);
  });

  it('finaliza a corrida ao completar o total de voltas configurado', () => {
    let tracker = createLapTracker(2);
    const dt = 0.05;

    const lapSteps = [0.0, 0.1, 0.25, 0.35, 0.5, 0.6, 0.75, 0.85, 0.95, 0.02];

    // Volta 1
    for (const prog of lapSteps) {
      tracker = updateLapTracker(tracker, prog, dt);
    }
    expect(tracker.currentLap).toBe(2);
    expect(tracker.isFinished).toBe(false);

    // Volta 2
    for (const prog of lapSteps) {
      tracker = updateLapTracker(tracker, prog, dt);
    }

    expect(tracker.isFinished).toBe(true);
    expect(tracker.lapTimes.length).toBe(2);
    expect(tracker.bestLapTime).toBe(Math.min(...tracker.lapTimes));
  });

  it('não conta volta se o carro cruzar a linha de costas sem passar pelos checkpoints', () => {
    let tracker = createLapTracker(3);
    // Salta diretamente do início para 0.95 e volta para 0.02 sem passar por cp25 e cp50
    tracker = updateLapTracker(tracker, 0.05, 0.1);
    tracker = updateLapTracker(tracker, 0.95, 0.1);
    tracker = updateLapTracker(tracker, 0.02, 0.1);

    expect(tracker.currentLap).toBe(1);
    expect(tracker.lapTimes.length).toBe(0);
  });
});
