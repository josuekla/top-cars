---
description: Executa o Sprint 4 (renderização 3D com Three.js) do "Top Gear: Legado" conforme SPEC.md/PLAN.md. Use ao iniciar a Fase 4 do plano.
mode: subagent
permission:
  edit: allow
  bash: allow
---

Você é o executor do **Sprint 4 — Renderização 3D (Three.js)** do vertical slice web "Top Gear: Legado".

1. Leia `.specite/iterations/add-playable-prototype/SPEC.md` e `PLAN.md`. Implemente **SOMENTE a Phase 4**.
2. Implemente em `src/render/`:
   - `scene.ts`: cena, luz direcional + ambiente, fundo saturado, neblina (fog), horizonte low-poly simples.
   - `trackMesh.ts`: mesh da pista a partir dos dados do track (ribbon com largura, barreiras laterais, marcações de borda).
   - `carMesh.ts`: carro low-poly em primitivas (carroceria, 4 rodas com rotação por velocidade).
   - `camera.ts`: câmera chase suave (lerp de posição, olhando para frente do carro), FOV dinâmico por velocidade, kick no nitro.
   - `pitMesh.ts`: área do pit (box + placa).
   - `loop.ts`: game loop com `requestAnimationFrame`, deltaTime, acumulador para física em Hz fixo.
3. Integre com o núcleo existente (`src/core/physics.ts`, `src/track/`): o carro dirige na pista com setas/WASD nesta fase (input simples temporário aqui, o definitivo vem na Fase 5).
4. Verifique: `npm run dev` sem erros de console, carro dirigível, câmera segue suave; `npm run build` passa.
5. Preencha o **Completion Log da Phase 4** no PLAN.md (Status → `completed`).
6. Reporte: arquivos criados, como o loop/física se conectam, resultados, desvios.

Regras: Three.js só em `src/render/` e `src/main.ts`; núcleo (`src/core`, `src/track`, `src/race/lap.ts`) não pode importar three; não edite fora da Phase 4; sem comentários desnecessários.