import type { CarId, CarStats } from './types';

export const CARS: Record<CarId, CarStats> = {
  cannibal: {
    id: 'cannibal',
    name: 'Cannibal',
    color: '#e74c3c', // Vermelho clássico
    topSpeed: 90,
    acceleration: 24,
    braking: 45,
    handling: 2.2,
    fuelTank: 100,
    fuelConsumption: 3.5,
    nitroBoostMultiplier: 1.6,
    nitroTopSpeedBonus: 25,
    nitroDuration: 2.5,
  },
  sidewinder: {
    id: 'sidewinder',
    name: 'Sidewinder',
    color: '#ecf0f1', // Branco equilibrado
    topSpeed: 82,
    acceleration: 26,
    braking: 45,
    handling: 2.5,
    fuelTank: 100,
    fuelConsumption: 2.8,
    nitroBoostMultiplier: 1.55,
    nitroTopSpeedBonus: 22,
    nitroDuration: 2.5,
  },
  razor: {
    id: 'razor',
    name: 'Razor',
    color: '#8e44ad', // Roxo ágil
    topSpeed: 78,
    acceleration: 30,
    braking: 48,
    handling: 2.8,
    fuelTank: 100,
    fuelConsumption: 3.0,
    nitroBoostMultiplier: 1.5,
    nitroTopSpeedBonus: 20,
    nitroDuration: 2.5,
  },
  weasel: {
    id: 'weasel',
    name: 'Weasel',
    color: '#2ecc71', // Verde econômico
    topSpeed: 72,
    acceleration: 22,
    braking: 42,
    handling: 3.2,
    fuelTank: 100,
    fuelConsumption: 2.0,
    nitroBoostMultiplier: 1.5,
    nitroTopSpeedBonus: 18,
    nitroDuration: 2.5,
  },
  night_viper: {
    id: 'night_viper',
    name: 'Night Viper (Moto 🏍️)',
    color: '#ff007f', // Magenta Neon Cyberpunk
    topSpeed: 96,
    acceleration: 36,
    braking: 46,
    handling: 3.4,
    fuelTank: 90,
    fuelConsumption: 2.4,
    nitroBoostMultiplier: 1.65,
    nitroTopSpeedBonus: 28,
    nitroDuration: 3.0,
  },
};

export const DEFAULT_CAR_ID: CarId = 'cannibal';

export function getCarStats(id: CarId = DEFAULT_CAR_ID): CarStats {
  return CARS[id] ?? CARS[DEFAULT_CAR_ID];
}

export const ALL_CARS: CarStats[] = Object.values(CARS);
