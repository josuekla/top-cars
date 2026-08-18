import { describe, expect, it } from 'vitest';
import { resolveVehicleCollision, VEHICLE_COLLISION_RADIUS } from './collision';
import { createDefaultVehicleState } from './physics';
import { getCarStats } from './cars';

describe('Vehicle Collision System', () => {
  it('detecta colisão e afasta dois veículos sobrepostos', () => {
    const statsA = getCarStats('cannibal');
    const statsB = getCarStats('sidewinder');

    const stateA = createDefaultVehicleState(statsA);
    const stateB = createDefaultVehicleState(statsB);

    // Posiciona os carros a 2 metros de distância (menor que 2 * RADIUS = 3.6m)
    stateA.x = 0;
    stateA.y = 0;
    stateA.speed = 30;

    stateB.x = 2.0;
    stateB.y = 0;
    stateB.speed = 10;

    const result = resolveVehicleCollision(stateA, stateB);

    expect(result.hasCollided).toBe(true);
    expect(result.impulse).toBeGreaterThan(0);

    // Distância após a separação deve ser pelo menos o diâmetro de colisão
    const newDist = Math.hypot(stateA.x - stateB.x, stateA.y - stateB.y);
    expect(newDist).toBeGreaterThanOrEqual(VEHICLE_COLLISION_RADIUS * 2 - 0.01);
  });

  it('não altera posições se os carros estiverem distantes', () => {
    const statsA = getCarStats('cannibal');
    const statsB = getCarStats('sidewinder');

    const stateA = createDefaultVehicleState(statsA);
    const stateB = createDefaultVehicleState(statsB);

    stateA.x = 0;
    stateB.x = 10.0; // Distante

    const result = resolveVehicleCollision(stateA, stateB);

    expect(result.hasCollided).toBe(false);
    expect(result.impulse).toBe(0);
    expect(stateA.x).toBe(0);
    expect(stateB.x).toBe(10.0);
  });
});
