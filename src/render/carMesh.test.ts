import { describe, expect, it } from 'vitest';
import { createCarMesh, updateCarMesh } from './carMesh';
import { ALL_CARS, createDefaultVehicleState } from '../core';

describe('carMesh 3D Rigging and Animation', () => {
  const defaultCarStats = ALL_CARS[0]; // Carro convencional (ex: Falcon GT)
  const bikeStats = ALL_CARS.find((c) => c.id === 'night_viper') ?? {
    ...ALL_CARS[0],
    id: 'night_viper' as const,
  };

  it('deve criar malhas corretamente para carro padrão e para motocicleta', () => {
    const car = createCarMesh(defaultCarStats);
    expect(car.isMotorcycle).toBe(false);
    expect(car.frontLeftWheel).toBeDefined();
    expect(car.frontRightWheel).toBeDefined();

    const bike = createCarMesh(bikeStats);
    expect(bike.isMotorcycle).toBe(true);
  });

  it('deve esterçar as rodas dianteiras com sinal invertido (-steerInput * 0.45) ao virar para a direita', () => {
    const car = createCarMesh(defaultCarStats);
    const state = createDefaultVehicleState(defaultCarStats);
    const steerInput = 1.0; // Direita

    updateCarMesh(car, state, steerInput, 0.016);

    // No Three.js (Right-Handed Coordinate System, frente apontando para +Z):
    // Rotação Y negativa vira a roda em direção a +X (direita)
    const expectedSteer = -1.0 * 0.45;
    expect(car.frontLeftWheel.rotation.y).toBeCloseTo(expectedSteer);
    expect(car.frontRightWheel.rotation.y).toBeCloseTo(expectedSteer);
  });

  it('deve esterçar as rodas dianteiras com sinal positivo ao virar para a esquerda', () => {
    const car = createCarMesh(defaultCarStats);
    const state = createDefaultVehicleState(defaultCarStats);
    const steerInput = -1.0; // Esquerda

    updateCarMesh(car, state, steerInput, 0.016);

    // Rotação Y positiva vira a roda em direção a -X (esquerda)
    const expectedSteer = -(-1.0) * 0.45;
    expect(car.frontLeftWheel.rotation.y).toBeCloseTo(expectedSteer);
    expect(car.frontRightWheel.rotation.y).toBeCloseTo(expectedSteer);
  });

  it('deve aplicar inclinação (lean) correta na moto ao virar para a direita e esquerda', () => {
    const bike = createCarMesh(bikeStats);
    const state = createDefaultVehicleState(bikeStats);

    // Virando para a direita (steerInput > 0): lean deve ser negativo (rotação Z negativa)
    updateCarMesh(bike, state, 1.0, 1.0); // dt alto para lerp convergir
    expect(bike.root.rotation.z).toBeLessThan(0);
    expect(bike.root.rotation.z).toBeCloseTo(-0.55, 1);

    // Virando para a esquerda (steerInput < 0): lean deve ser positivo (rotação Z positiva)
    updateCarMesh(bike, state, -1.0, 1.0);
    expect(bike.root.rotation.z).toBeGreaterThan(0);
    expect(bike.root.rotation.z).toBeCloseTo(0.55, 1);
  });

  it('deve manter rotação Z zerada para carros convencionais mesmo ao esterçar', () => {
    const car = createCarMesh(defaultCarStats);
    const state = createDefaultVehicleState(defaultCarStats);

    updateCarMesh(car, state, 1.0, 0.1);
    expect(car.root.rotation.z).toBe(0);

    updateCarMesh(car, state, -1.0, 0.1);
    expect(car.root.rotation.z).toBe(0);
  });
});
