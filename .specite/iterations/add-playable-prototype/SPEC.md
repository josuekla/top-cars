# add-playable-prototype

## Goal

Construir um protótipo web JOGÁVEL do jogo "Top Gear: Legado" (vertical slice) que valide o núcleo arcade da SPEC: física divertida, combustível + pit stop, nitro, corrida vs. IA e modo Time Attack, com estética low-poly retrô e áudio procedural. O protótipo roda no navegador (Three.js) e serve como prova de jogabilidade ("só mais uma corrida") antes do port para Unity/C# em iterações futuras.

## Background

- O projeto `projeto_dione` está vazio: apenas `package.json` com a dependência `@fnnm/specite` (workflow spec-driven, já corrigido e inicializado).
- A SPEC original (documento "Top Gear: Legado") define o jogo completo em Unity 2022 LTS + C#. **Unity não está instalado nesta máquina** — decisão aprovada pelo usuário: primeira iteração em **Vite + Three.js + TypeScript**, com núcleo de física em módulo puro (sem Three.js) para port 1:1 para C# depois.
- Sem assets externos: tudo procedural (carro em primitivas, pista gerada por dados, áudio via WebAudio).
- Subagentes de sprint serão criados em `.opencode/agent/` e disparados serialmente via Task tool.

## Requirements

1. **Física arcade pura** (módulo sem Three.js, testável com vitest): aceleração, freio, direção sensível à velocidade (trava em alta velocidade), derrapagem, nitro com duração limitada, redução de velocidade fora da pista.
2. **Stats dos 4 carros** da SPEC como dados (Cannibal, Sidewinder, Razor, Weasel — velocidade, aceleração, manuseio, consumo), com 1 carro jogável nesta iteração (seleção por dados já funcional).
3. **1 pista procedural**: loop fechado por segmentos (retas + curvas), linha start/fim, contagem de voltas, limites de pista (barreiras).
4. **Combustível**: consumo proporcional ao acelerar, pit stop que reabastece com perda de tempo, aviso de combustível baixo, pista fica sem combustível (crawl até o pit).
5. **Nitro**: quantidade limitada (recarrega por volta), impulso de velocidade com FOV kick.
6. **Modos**: Time Attack (melhor volta) e Corrida contra 3-5 IAs (waypoints + rubber-banding), contagem regressiva, ordem de chegada, tela de resultados.
7. **HUD**: velocímetro, combustível, nitro, volta/lap, posição, tempo.
8. **Renderização 3D**: cena low-poly com cores saturadas (estética anos 90), céu/neblina, câmera chase com FOV dinâmico por velocidade.
9. **Menus**: tela inicial retrô SNES, seleção de modo, carro e dificuldade.
10. **Áudio procedural (WebAudio)**: motor sintetizado por RPM, derrapagem, nitro, música chiptune simples.
11. **Input**: teclado (setas/WASD + Shift nitro) e gamepad (opcional).

## Acceptance Criteria

- [x] `npm run dev` abre o jogo no navegador; carro dirige, derrapa, usa nitro e reabastece no pit.
- [x] `npm test` (vitest) cobre a física (aceleração, freio, direção, nitro, off-track) e passa.
- [x] `npm run build` (tsc + vite build) passa sem erros.
- [x] Corrida vs. IA completa: contagem → 3 voltas → resultados com ordem correta.
- [x] Time Attack registra melhor volta e mostra na tela de resultados.
- [x] HUD mostra velocidade, combustível, nitro, volta e posição em tempo real.
- [x] Sem combustível: carro perde potência; pit stop reabastece com ~3s de penalidade.
- [x] Menus permitem escolher modo, carro (4 disponíveis) e dificuldade (3 níveis).

## Scope

- `index.html`, `src/` (módulos: `core/` física + dados, `track/`, `render/`, `gameplay/`, `ui/`, `audio/`, `main.ts`), `package.json`, `tsconfig.json`, `vite.config.ts`, testes em `src/**/*.test.ts`.
- `.specite/iterations/add-playable-prototype/` (SPEC/PLAN), `.opencode/agent/sprint*.md` (7 subagentes).
- Git: repositório inicializado, commit final via `/post`.

## Non-Goals

- Unity/C# (iteração futura; núcleo desenhado para port 1:1).
- Multiplayer split-screen, campeonato por país, colecionáveis, upgrades, dia/noite e clima.
- Modelos 3D/áudio externos (tudo procedural).
- Física realista (simulação); gameplay é arcade por design.

## Behavior Details

- Direção: ângulo de esterço máximo reduz com velocidade (arcade clássico); derrapagem aumenta em curvas com alta velocidade.
- Off-track (grama/areia): forte resistência — o carro quase para.
- Barreiras da pista: colisão elástica que reduz velocidade e impede saída.
- Nitro: N usos por volta; ao ativar, aceleração e velocidade máx. aumentam temporariamente; FOV da câmera expande.
- Pit stop: entra na área → barra de reabastecimento (~3s) → combustível 100% e volta cronometrada continua.
- IA: segue o centro da pista (waypoints), com rubber-banding leve para manter corrida disputada e dificuldade por nível.
- Dificuldade: Amador (IA lenta), Profissional (IA média), Campeonato (IA rápida + consumo maior).
- Física em Hz fixo (e.g. 60 Hz acumulado) para independência do framerate; estado do carro = posição, ângulo, velocidade.
- Combustível em unidades; consumo por aceleração/velocidade; pit stop reabastece instantaneamente com delay de tempo (arcade).

## Dependencies And Research

- `three` (r160+): renderização 3D. API estável e documentada.
- `vite` + `typescript`: build/dev server.
- `vitest`: testes unitários do núcleo.
- `@fnnm/specite`: workflow SPEC → PLAN → exec → post (instalado).
- Sem pesquisa externa adicional necessária: APIs conhecidas (Three.js WebGLRenderer, WebAudio OscillatorNode). Pesquisas futuras documentadas em `.specite/docs/`.

## Verification

- `npm test` → todos os testes unitários do núcleo passam.
- `npm run build` → tsc + vite build sem erros.
- `npm run dev` → playtest manual guiado por checklist no PLAN.md (Corrida completa + Time Attack).
- `npx vite preview` opcional para validar build de produção.

## Shifts

N/A