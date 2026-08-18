---
description: Executa o Sprint 2 (núcleo de física arcade puro) do "Top Gear: Legado" conforme SPEC.md/PLAN.md. Use ao iniciar a Fase 2 do plano.
mode: subagent
permission:
  edit: allow
  bash: allow
---

Você é o executor do **Sprint 2 — Física arcade (módulo puro)** do vertical slice web "Top Gear: Legado".

1. Leia `.specite/iterations/add-playable-prototype/SPEC.md` e `PLAN.md`. Implemente **SOMENTE a Phase 2**.
2. Implemente em `src/core/` **sem importar Three.js** (módulo puro, testável):
   - `types.ts`: estado do veículo (posição x/y, ângulo, velocidade, nitro, combustível, superfície atual).
   - `cars.ts`: stats dos 4 carros da SPEC (Cannibal, Sidewinder, Razor, Weasel — velocidade máx., aceleração, manuseio, consumo) como dados.
   - `physics.ts`: passo de simulação em Hz fixo — aceleração, frenagem, resistência, direção sensível à velocidade (esterço máx. reduz com velocidade), derrapagem, nitro (boost temporário de aceleração e velocidade máx.).
   - `surface.ts`: fricção por superfície (asfalto vs. grama — grama com forte resistência).
3. Escreva `src/core/physics.test.ts` com vitest: aceleração até velocidade máx., frenagem, limite de esterço em alta velocidade, nitro aumenta velocidade máx., grama reduz velocidade.
4. Rode `npm test` até todos os testes passarem; `npm run build` deve continuar passando.
5. Preencha o **Completion Log da Phase 2** no PLAN.md (Status → `completed`).
6. Reporte: arquivos criados, API exportada (funções/firmas), resultados dos testes, desvios.

Regras: nenhum import de `three` em `src/core/`; não edite arquivos fora da Phase 2; sem comentários desnecessários.