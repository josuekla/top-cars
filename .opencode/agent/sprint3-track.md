---
description: Executa o Sprint 3 (sistema de pista procedural e lógica de voltas) do "Top Gear: Legado" conforme SPEC.md/PLAN.md. Use ao iniciar a Fase 3 do plano.
mode: subagent
permission:
  edit: allow
  bash: allow
---

Você é o executor do **Sprint 3 — Sistema de pista** do vertical slice web "Top Gear: Legado".

1. Leia `.specite/iterations/add-playable-prototype/SPEC.md` e `PLAN.md`. Implemente **SOMENTE a Phase 3**.
2. Implemente em `src/track/` (módulo puro, sem Three.js) e `src/race/lap.ts`:
   - `segments.ts`: tipos de segmento (reta, curva com raio/ângulo).
   - `track.ts`: gera circuito fechado a partir de dados — loop de segmentos → pontos de centro, largura, normais; 1 pista base desta iteração.
   - `trackmath.ts`: sampling de ponto no caminho, distância percorrida, ângulo da pista, projeção do carro no caminho.
   - `src/race/lap.ts`: contagem de voltas via progresso 0..1 (travessia da linha start/fim), tempo por volta, melhor volta.
3. Testes unitários (vitest): circuito fecha (fim ≈ início), sampling de posição correto, contagem de voltas (N travessias), progresso monotônico.
4. Rode `npm test` até passar; `npm run build` continua passando.
5. Preencha o **Completion Log da Phase 3** no PLAN.md (Status → `completed`).
6. Reporte: arquivos criados, formato de dados da pista, resultados dos testes, desvios.

Regras: sem import de `three` em `src/track/` nem em `lap.ts`; não edite fora da Phase 3; sem comentários desnecessários.