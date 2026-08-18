import { describe, expect, it } from 'vitest';
import { FuelSystem } from './fuel';
import { PitManager } from './pit';

describe('Fuel System & Pit Stop', () => {
  it('inicializa com tanque cheio e flags normais', () => {
    const fuel = new FuelSystem(100, 2.5);
    expect(fuel.current).toBe(100);
    expect(fuel.percentage).toBe(100);
    expect(fuel.isLow).toBe(false);
    expect(fuel.isEmpty).toBe(false);
  });

  it('consome combustível proporcionalmente ao acelerador e nitro', () => {
    const fuel = new FuelSystem(100, 10); // 10 unidades/s em throttle 100%

    // 1 segundo de aceleração normal
    fuel.consume(1.0, false, 1.0);
    expect(fuel.current).toBe(90);

    // 1 segundo com nitro (1.5x consumo)
    fuel.consume(1.0, true, 1.0);
    expect(fuel.current).toBe(75);

    // Sem aceleração -> consumo zero
    fuel.consume(0, false, 1.0);
    expect(fuel.current).toBe(75);
  });

  it('sinaliza aviso de combustível baixo e tanque esgotado', () => {
    const fuel = new FuelSystem(100, 50);

    // Consome 85 unidades -> restam 15 (15% <= 20%)
    fuel.consume(1.0, false, 1.7);
    expect(fuel.isLow).toBe(true);
    expect(fuel.isEmpty).toBe(false);

    // Consome o restante
    fuel.consume(1.0, false, 1.0);
    expect(fuel.current).toBe(0);
    expect(fuel.isEmpty).toBe(true);
  });

  it('reabastece no pit stop até 100% da capacidade', () => {
    const fuel = new FuelSystem(100, 10, 50); // 50 unidades/s no pit (enche em 2s)
    const pit = new PitManager();

    fuel.consume(1.0, false, 8.0); // Restam 20 unidades
    expect(fuel.current).toBe(20);

    // 1 segundo no pit stop
    const pitState1 = pit.update(true, fuel, 1.0);
    expect(pitState1.isInPit).toBe(true);
    expect(pitState1.isRefueling).toBe(true);
    expect(fuel.current).toBe(70);

    // Mais 1 segundo no pit stop -> enche até 100%
    const pitState2 = pit.update(true, fuel, 1.0);
    expect(fuel.current).toBe(100);
    expect(pitState2.isRefueling).toBe(true);

    // Próximo ciclo com tanque já cheio -> não está mais reabastecendo
    const pitState3 = pit.update(true, fuel, 1.0);
    expect(pitState3.isRefueling).toBe(false);
  });
});
