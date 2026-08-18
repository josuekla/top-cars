---
description: Executa o Sprint 6 (modos Time Attack e corrida vs. IA) do "Top Gear: Legado" conforme SPEC.md/PLAN.md. Use ao iniciar a Fase 6 do plano.
mode: subagent
permission:
  edit: allow
  bash: allow
---

Você é o executor do **Sprint 6 — Modos e IA** do vertical slice web "Top Gear: Legado".

1. Leia `.specite/iterations/add-playable-prototype/SPEC.md` e `PLAN.md`. Implemente **SOMENTE a Phase 6**.
2. Implemente em `src/race/` e `src/gameplay/`:
   - `ai.ts`: IA por waypoints (segue o centro da pista, velocidade alvo por dificuldade), rubber-banding leve, variação lateral pequena. Lógica pura testável.
   - `race.ts`: estado da corrida — grid (jogador + 3-5 IAs), contagem regressiva 3-2-1-GO, posições por progresso total, ordem de chegada, fim da corrida.
   - `timeattack.ts`: Time Attack solo cronometrado, melhor volta (memória), resultado com melhor tempo.
   - `results.ts`: tela de resultados (posição, volta, tempo de jogador e IAs).
3. Testes unitários: posições por progresso, ordem de chegada, rubber-banding dentro de limites.
4. Verifique: `npm test` passa; `npm run build` passa; playtest — corrida de 3 voltas vs. IA completa; Time Attack registra melhor volta.
5. Preencha o **Completion Log da Phase 6** no PLAN.md (Status → `completed`).
6. Reporte: arquivos criados, comportamento da IA, resultados, desvios.

Regras: IA e lógica de corrida sem Three.js (renderização à parte); não edite fora da Phase 6; sem comentários desnecessários.