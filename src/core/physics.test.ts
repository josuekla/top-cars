import { describe, expect, it } from 'vitest';
import {
  CARS,
  createDefaultVehicleState,
  getCarStats,
  normalizeAngle,
  stepPhysics,
  type VehicleInput,
} from './index';

describe('Physics Engine (Arcade Core)', () => {
  const dt = 1 / 60;
  const noInput: VehicleInput = { throttle: 0, brake: 0, steer: 0, nitro: false };
  const fullThrottle: VehicleInput = { throttle: 1, brake: 0, steer: 0, nitro: false };
  const fullBrake: VehicleInput = { throttle: 0, brake: 1, steer: 0, nitro: false };

  it('acelera a partir do repouso até atingir a velocidade máxima no asfalto', () => {
    const stats = getCarStats('cannibal');
    let state = createDefaultVehicleState(stats);

    expect(state.speed).toBe(0);

    // Simula 10 segundos de aceleração contínua
    for (let i = 0; i < 600; i++) {
      state = stepPhysics(state, fullThrottle, stats, 'asphalt', dt);
    }

    expect(state.speed).toBeCloseTo(stats.topSpeed, 1);
    expect(state.x).toBeGreaterThan(0);
  });

  it('freia o veículo quando o freio é pressionado em movimento', () => {
    const stats = getCarStats('sidewinder');
    let state = createDefaultVehicleState(stats);

    // Acelera por 2 segundos
    for (let i = 0; i < 120; i++) {
      state = stepPhysics(state, fullThrottle, stats, 'asphalt', dt);
    }
    const speedBeforeBrake = state.speed;
    expect(speedBeforeBrake).toBeGreaterThan(30);

    // Freia por 0.5 segundo
    for (let i = 0; i < 30; i++) {
      state = stepPhysics(state, fullBrake, stats, 'asphalt', dt);
    }
    expect(state.speed).toBeLessThan(speedBeforeBrake);

    // Continua freando até atingir o repouso
    while (state.speed > 0) {
      state = stepPhysics(state, fullBrake, stats, 'asphalt', dt);
    }
    expect(state.speed).toBe(0);
  });

  it('permite marcha ré quando o freio continua pressionado com o carro parado', () => {
    const stats = getCarStats('razor');
    let state = createDefaultVehicleState(stats);

    // Freia com carro parado -> entra em ré
    for (let i = 0; i < 60; i++) {
      state = stepPhysics(state, fullBrake, stats, 'asphalt', dt);
    }

    expect(state.speed).toBeLessThan(0);
    expect(state.speed).toBeGreaterThanOrEqual(-18); // Limite de ré
  });

  it('reduz a sensibilidade do esterço em altas velocidades (speed-sensitive steering)', () => {
    const stats = getCarStats('cannibal');

    // Teste 1: Curva em baixa velocidade
    let lowSpeedState = createDefaultVehicleState(stats);
    lowSpeedState.speed = 20;
    const steerRight: VehicleInput = { throttle: 0.5, brake: 0, steer: 1, nitro: false };
    const stepLow = stepPhysics(lowSpeedState, steerRight, stats, 'asphalt', dt);
    const angleDeltaLow = Math.abs(stepLow.angle - lowSpeedState.angle);

    // Teste 2: Curva em velocidade máxima
    let highSpeedState = createDefaultVehicleState(stats);
    highSpeedState.speed = stats.topSpeed;
    const stepHigh = stepPhysics(highSpeedState, steerRight, stats, 'asphalt', dt);
    const angleDeltaHigh = Math.abs(stepHigh.angle - highSpeedState.angle);

    // Em velocidade máxima, a taxa de curva deve ser menor para evitar perda de controle
    expect(angleDeltaHigh).toBeLessThan(angleDeltaLow);
  });

  it('não esterça se o carro estiver completamente parado', () => {
    const stats = getCarStats('cannibal');
    const stoppedState = createDefaultVehicleState(stats);
    const steerInput: VehicleInput = { throttle: 0, brake: 0, steer: 1, nitro: false };

    const nextState = stepPhysics(stoppedState, steerInput, stats, 'asphalt', dt);
    expect(nextState.angle).toBe(0);
  });

  it('ativa o nitro e ultrapassa a velocidade máxima padrão', () => {
    const stats = getCarStats('cannibal');
    let state = createDefaultVehicleState(stats);

    // Acelera até top speed normal
    for (let i = 0; i < 600; i++) {
      state = stepPhysics(state, fullThrottle, stats, 'asphalt', dt);
    }
    expect(state.speed).toBeCloseTo(stats.topSpeed, 1);

    // Aciona nitro
    const nitroInput: VehicleInput = { throttle: 1, brake: 0, steer: 0, nitro: true };
    for (let i = 0; i < 90; i++) {
      state = stepPhysics(state, nitroInput, stats, 'asphalt', dt);
    }

    expect(state.nitroTimer).toBeGreaterThan(0);
    expect(state.speed).toBeGreaterThan(stats.topSpeed);
    expect(state.speed).toBeLessThanOrEqual(stats.topSpeed + stats.nitroTopSpeedBonus);
  });

  it('reduz drasticamente a velocidade e impõe forte resistência na grama', () => {
    const stats = getCarStats('cannibal');
    let state = createDefaultVehicleState(stats);

    // Acelera no asfalto até velocidade alta
    for (let i = 0; i < 200; i++) {
      state = stepPhysics(state, fullThrottle, stats, 'asphalt', dt);
    }
    const highSpeed = state.speed;
    expect(highSpeed).toBeGreaterThan(50);

    // Entra na grama continuando a acelerar
    for (let i = 0; i < 180; i++) {
      state = stepPhysics(state, fullThrottle, stats, 'grass', dt);
    }

    // Na grama, a velocidade deve cair para no máximo 35% da top speed
    expect(state.speed).toBeLessThan(highSpeed);
    expect(state.speed).toBeLessThanOrEqual(stats.topSpeed * 0.36);
  });

  it('consome combustível ao acelerar e entra em modo crawl quando o tanque esvazia', () => {
    const stats = getCarStats('cannibal');
    let state = createDefaultVehicleState(stats, { fuel: 0.5 }); // Tanque quase vazio

    expect(state.isOutOfFuel).toBe(false);

    // Acelera até esgotar o combustível
    for (let i = 0; i < 60; i++) {
      state = stepPhysics(state, fullThrottle, stats, 'asphalt', dt);
    }

    expect(state.fuel).toBe(0);
    expect(state.isOutOfFuel).toBe(true);

    // Continua acelerando sem combustível: velocidade limitada ao crawl
    for (let i = 0; i < 180; i++) {
      state = stepPhysics(state, fullThrottle, stats, 'asphalt', dt);
    }

    expect(state.speed).toBeLessThanOrEqual(12.1); // Crawl speed
  });

  it('desacelera naturalmente por atrito quando não há input', () => {
    const stats = getCarStats('weasel');
    let state = createDefaultVehicleState(stats);
    state.speed = 50;

    for (let i = 0; i < 120; i++) {
      state = stepPhysics(state, noInput, stats, 'asphalt', dt);
    }

    expect(state.speed).toBeLessThan(50);
  });

  it('possui atributos e balanceamento diferenciados entre os 4 carros', () => {
    expect(CARS.cannibal.topSpeed).toBeGreaterThan(CARS.weasel.topSpeed);
    expect(CARS.razor.acceleration).toBeGreaterThan(CARS.cannibal.acceleration);
    expect(CARS.weasel.handling).toBeGreaterThan(CARS.cannibal.handling);
    expect(CARS.weasel.fuelConsumption).toBeLessThan(CARS.cannibal.fuelConsumption);
  });

  it('normaliza ângulos corretamente dentro do intervalo [-PI, PI]', () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(Math.PI)).toBe(Math.PI);
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 5);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI, 5);
  });
});
