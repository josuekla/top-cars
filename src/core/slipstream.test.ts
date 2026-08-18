import { describe, expect, it } from 'vitest';
import { calculateSlipstream } from './slipstream';
import { createDefaultVehicleState } from './physics';
import { getCarStats } from './cars';

describe('Slipstream System', () => {
  it('detecta vácuo quando o carro está logo atrás e alinhado com o líder', () => {
    const stats = getCarStats('cannibal');
    const leadCar = createDefaultVehicleState(stats);
    const followCar = createDefaultVehicleState(stats);

    // Líder em (20, 0), Seguidor em (5, 0), ambos apontando em 0 deg (+X)
    leadCar.x = 20;
    leadCar.y = 0;
    leadCar.angle = 0;

    followCar.x = 5;
    followCar.y = 0;
    followCar.angle = 0;

    const result = calculateSlipstream(leadCar, followCar);

    expect(result.inSlipstream).toBe(true);
    expect(result.boostFactor).toBeGreaterThan(1.0);
    expect(result.distance).toBe(15);
  });

  it('não ativa vácuo se os carros estiverem desalinhados lateralmente', () => {
    const stats = getCarStats('cannibal');
    const leadCar = createDefaultVehicleState(stats);
    const followCar = createDefaultVehicleState(stats);

    leadCar.x = 20;
    leadCar.y = 20; // Muito ao lado
    leadCar.angle = 0;

    followCar.x = 5;
    followCar.y = 0;
    followCar.angle = 0;

    const result = calculateSlipstream(leadCar, followCar);

    expect(result.inSlipstream).toBe(false);
    expect(result.boostFactor).toBe(1.0);
  });
});
