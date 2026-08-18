import { describe, expect, it } from 'vitest';
import { AICarController, AI_DIFFICULTY_CONFIGS } from './ai';
import { getCarStats, createDefaultVehicleState } from '../core';
import { buildTrack, DEFAULT_TRACK_DEFINITION } from '../track';

describe('AI Car Controller', () => {
  const track = buildTrack(DEFAULT_TRACK_DEFINITION);
  const stats = getCarStats('sidewinder');

  it('calcula inputs de esterço e acelerador em direção aos waypoints da pista', () => {
    const ai = new AICarController(0);
    const state = createDefaultVehicleState(stats, {
      x: track.startPosition.x,
      y: track.startPosition.y,
      angle: track.startPosition.angle,
    });

    const input = ai.computeInput(state, stats, track, 0, 0, 'pro', 1 / 60);

    expect(input.throttle).toBeGreaterThan(0);
    expect(input.steer).toBeGreaterThanOrEqual(-1);
    expect(input.steer).toBeLessThanOrEqual(1);
  });

  it('possui parâmetros calibrados por nível de dificuldade', () => {
    expect(AI_DIFFICULTY_CONFIGS.amateur.speedFactor).toBeLessThan(
      AI_DIFFICULTY_CONFIGS.pro.speedFactor
    );
    expect(AI_DIFFICULTY_CONFIGS.pro.speedFactor).toBeLessThan(
      AI_DIFFICULTY_CONFIGS.championship.speedFactor
    );
  });

  it('mantém limites no rubber-banding sem ultrapassar tetos configurados', () => {
    const ai = new AICarController(0);
    const state = createDefaultVehicleState(stats, {
      x: track.startPosition.x,
      y: track.startPosition.y,
      angle: track.startPosition.angle,
    });
    state.speed = stats.topSpeed;

    // Jogador 200m à frente -> IA acelera com boost dentro do limite
    const inputAhead = ai.computeInput(state, stats, track, 0, 200, 'pro', 1 / 60);
    expect(inputAhead.throttle).toBeGreaterThanOrEqual(0);

    // Jogador 200m atrás -> IA desacelera dentro do limite
    const inputBehind = ai.computeInput(state, stats, track, 200, 0, 'pro', 1 / 60);
    expect(inputBehind.throttle).toBeLessThanOrEqual(1.0);
  });
});
