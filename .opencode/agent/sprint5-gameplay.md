---
description: Executa o Sprint 5 (combustível, nitro, pit stop e HUD) do "Top Gear: Legado" conforme SPEC.md/PLAN.md. Use ao iniciar a Fase 5 do plano.
mode: subagent
permission:
  edit: allow
  bash: allow
---

Você é o executor do **Sprint 5 — Gameplay: combustível, nitro e HUD** do vertical slice web "Top Gear: Legado".

1. Leia `.specite/iterations/add-playable-prototype/SPEC.md` e `PLAN.md`. Implemente **SOMENTE a Phase 5**.
2. Implemente em `src/gameplay/`:
   - `fuel.ts`: combustível (unidades), consumo por aceleração/velocidade, aviso de baixo combustível (evento), sem combustível → potência reduzida (crawl), reabastecimento no pit. Lógica pura testável.
   - `pit.ts`: zona de pit — ao entrar, barra de reabastecimento (~3s) → 100% combustível; tempo/posição continuam (arcade).
   - `nitro.ts`: cargas de nitro por volta (recarrega ao completar volta), ativação com duração, integração com o boost do physics.
   - `input.ts`: teclado (setas/WASD, Shift = nitro, espaço = freio) + gamepad opcional (stick/gatilhos).
   - `hud.ts`: HUD em DOM/overlay — velocímetro, barra de combustível, contador de nitro, volta, posição, tempo de volta; atualizado por frame.
3. Substitua o input temporário da Fase 4 pelo definitivo desta fase.
4. Testes unitários (vitest) de fuel/nitro: consumo, recarga por volta, pit refuel, crawl sem combustível.
5. Verifique: `npm test` passa; `npm run build` passa; playtest manual — ficar sem combustível, pit stop, nitro, HUD atualizando.
6. Preencha o **Completion Log da Phase 5** no PLAN.md (Status → `completed`).
7. Reporte: arquivos criados, eventos expostos, resultados, desvios.

Regras: lógica pura (fuel/nitro) sem Three.js; não edite fora da Phase 5; sem comentários desnecessários.