---
description: Executa o Sprint 7 (menus retrô, áudio procedural WebAudio e polish final) do "Top Gear: Legado" conforme SPEC.md/PLAN.md. Use ao iniciar a Fase 7 do plano.
mode: subagent
permission:
  edit: allow
  bash: allow
---

Você é o executor do **Sprint 7 — Menus, áudio e polish** do vertical slice web "Top Gear: Legado".

1. Leia `.specite/iterations/add-playable-prototype/SPEC.md` e `PLAN.md`. Implemente **SOMENTE a Phase 7**.
2. Implemente em `src/ui/` e `src/audio/`:
   - `menus.ts`: tela inicial retrô SNES (título "Top Gear: Legado"), seleção de modo (Corrida/Time Attack), carro (4 com stats visíveis), dificuldade (Amador/Profissional/Campeonato).
   - `screens.ts`: gerenciador de telas (menu → corrida → resultados → menu) com transições simples.
   - `audio.ts`: WebAudio — motor sintetizado (oscilador + filtro, pitch por RPM), derrapagem (ruído filtrado), nitro (varredura), colisão; música chiptune simples (sequenciador com osciladores quadrados). Contexto de áudio inicia após gesto do usuário.
3. `src/gameplay/events.ts`: barramento de eventos (combustível baixo, nitro usado, volta completada, chegada) consumido por HUD/áudio.
4. Polish: bordas da pista visíveis, favicon/título da página, resize de janela sem quebra.
5. Verifique: `npm run build` limpo (tsc strict); playtest completo do fluxo menu → corrida → resultados → menu; motor muda com RPM; música no menu e na corrida; nenhum erro de console.
6. Preencha o **Completion Log da Phase 7** no PLAN.md (Status → `completed`).
7. Reporte: arquivos criados, estrutura de telas, implementação de áudio, resultados, desvios.

Regras: não edite fora da Phase 7; sem comentários desnecessários.