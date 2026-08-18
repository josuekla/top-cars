import { describe, expect, it } from 'vitest';
import { RaceManager } from './race';
import { buildTrack, DEFAULT_TRACK_DEFINITION } from '../track';
import type { VehicleInput } from '../core';

describe('Race Manager', () => {
  const track = buildTrack(DEFAULT_TRACK_DEFINITION);
  const fullThrottle: VehicleInput = { throttle: 1, brake: 0, steer: 0, nitro: false };

  it('inicializa o grid com o jogador e oponentes IA escalonados na largada', () => {
    const race = new RaceManager(track, { mode: 'race', aiCount: 3, totalLaps: 3 });

    expect(race.racers.length).toBe(4);
    expect(race.player.isPlayer).toBe(true);
    expect(race.status).toBe('countdown');
    expect(race.countdownDisplay).toBe('3');
  });

  it('faz a transição da contagem regressiva 3-2-1-GO para o estado de corrida', () => {
    const race = new RaceManager(track, { mode: 'race', aiCount: 1 });

    expect(race.status).toBe('countdown');

    // 1 segundo passa -> '2'
    race.update(fullThrottle, 1.0);
    expect(race.status).toBe('countdown');

    // Mais 3.1 segundos (total 4.1s) -> inicia corrida ('racing')
    race.update(fullThrottle, 3.1);
    expect(race.status).toBe('racing');
    expect(race.countdownDisplay).toBeNull();
  });

  it('ordena a classificação (leaderboard) em tempo real conforme o progresso', () => {
    const race = new RaceManager(track, { mode: 'race', aiCount: 3 });
    // Inicia a corrida
    race.update(fullThrottle, 4.0);

    const leaderboard = race.getLeaderboard();
    expect(leaderboard.length).toBe(4);
    expect(leaderboard[0].currentRank).toBe(1);
    expect(leaderboard[3].currentRank).toBe(4);
  });
});
