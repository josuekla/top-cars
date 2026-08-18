import { describe, expect, it } from 'vitest';
import { NitroSystem } from './nitro';

describe('Nitro Boost System', () => {
  it('inicializa com quantidade máxima de cargas e inativo', () => {
    const nitro = new NitroSystem(3, 2.5);
    expect(nitro.charges).toBe(3);
    expect(nitro.maxCharges).toBe(3);
    expect(nitro.isActive).toBe(false);
    expect(nitro.timer).toBe(0);
  });

  it('consome uma carga e ativa o timer de duração ao acionar', () => {
    const nitro = new NitroSystem(3, 2.5);

    const triggered = nitro.trigger();
    expect(triggered).toBe(true);
    expect(nitro.charges).toBe(2);
    expect(nitro.isActive).toBe(true);
    expect(nitro.timer).toBe(2.5);

    // Não permite re-ativar enquanto já estiver ativo
    const retrigger = nitro.trigger();
    expect(retrigger).toBe(false);
    expect(nitro.charges).toBe(2);
  });

  it('reduz o timer ao longo do tempo e desativa o nitro ao expirar', () => {
    const nitro = new NitroSystem(3, 2.0);
    nitro.trigger();

    nitro.update(1.0);
    expect(nitro.isActive).toBe(true);
    expect(nitro.timer).toBe(1.0);

    nitro.update(1.0);
    expect(nitro.isActive).toBe(false);
    expect(nitro.timer).toBe(0);
  });

  it('recarrega cargas ao completar novas voltas sem ultrapassar o limite máximo', () => {
    const nitro = new NitroSystem(3, 2.0);
    nitro.trigger(); // 2 restantes
    nitro.update(2.0);
    nitro.trigger(); // 1 restante
    nitro.update(2.0);

    expect(nitro.charges).toBe(1);

    // Completa uma volta -> ganha +1 carga
    nitro.rechargeOnNewLap(1);
    expect(nitro.charges).toBe(2);

    // Ganha mais 2 -> atinge o limite máximo (3)
    nitro.rechargeOnNewLap(2);
    expect(nitro.charges).toBe(3);
  });
});
