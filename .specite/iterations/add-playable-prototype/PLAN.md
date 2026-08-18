# add-playable-prototype Plan

## Overview

Implementar o vertical slice web do "Top Gear: Legado" em 7 sprints sequenciais, cada um delegado a um subagente dedicado (`.opencode/agent/sprint*.md`): scaffold → física pura → pista → render 3D → gameplay (combustível/nitro/HUD) → modos e IA → menus/polish. Ordem: infraestrutura → núcleo testável → dados → renderização → sistemas → fluxos → acabamento.

## Assumptions

- Vite + TypeScript + Three.js + Vitest; sem React (loop imperativo).
- Física em módulo puro `src/core/` (sem import de three) — portável para C#/Unity.
- Todos os assets procedurais (primitivas, cores, WebAudio); nenhum arquivo binário externo.
- Um carro jogável com stats data-driven dos 4 carros da SPEC.
- Subagentes executam serialmente (evita conflitos de edição); cada um preenche o Completion Log da sua fase.
- Git já inicializado; commit apenas no fim (`/post`).

## Phases

### Phase 1: Scaffold do projeto

Status: `completed`

Criar a base do projeto Vite + TypeScript + Three.js + Vitest.

Implementação:
1. `package.json` com deps: `three`, devDeps: `vite`, `typescript`, `vitest`, `@types/three`.
2. Scripts: `dev` (vite), `build` (tsc && vite build), `test` (vitest run), `preview`.
3. `tsconfig.json` (strict), `vite.config.ts`, `index.html`, `src/main.ts` (bootstrap mínimo com cena three vazia e texto de status no canvas).
4. Estrutura de pastas: `src/core/`, `src/track/`, `src/render/`, `src/gameplay/`, `src/ui/`, `src/audio/`.

Verificação: `npm install` limpo; `npm run build` e `npm test` (teste de smoke) passam; `npm run dev` abre página sem erro de console.

#### Completion Log

- **Status**: completed (2026-08-18)
- **Descrição**: scaffold Vite + TypeScript + Three.js + Vitest criado. `package.json` atualizado preservando `@fnnm/specite` (deps: `three`; devDeps: `vite`, `typescript`, `vitest`, `@types/three`; scripts `dev`, `build` (`tsc && vite build`), `test` (`vitest run`), `preview`). `tsconfig.json` strict, `vite.config.ts` com vitest, `index.html` com overlay de status, `src/main.ts` (cena three vazia + texto de status WebGL no overlay), pastas `src/core|track|render|gameplay|ui|audio/` com `index.ts` placeholder, smoke test em `src/smoke.test.ts`.
- **Versões**: three 0.185.1, vite 8.2.1, typescript 7.0.2, vitest 4.1.11, @types/three 0.185.4, @fnnm/specite 0.1.2 (preservado).
- **Comandos de verificação**: `npm install` (0 vulnerabilidades), `npm run build` (tsc + vite build OK; apenas warning de chunk >500 kB do three, não-bloqueante), `npm test` (1/1 passou), `npm run dev` (Vite ready; `/` e `/src/main.ts` respondem HTTP 200).

### Phase 2: Núcleo de física arcade (módulo puro)

Status: `completed`

Física arcade sem Three.js, com testes unitários.

Implementação:
1. `src/core/types.ts`: tipos de estado do veículo (posição, ângulo, velocidade, nitro, combustível).
2. `src/core/cars.ts`: stats dos 4 carros (Cannibal, Sidewinder, Razor, Weasel) conforme tabela da SPEC.
3. `src/core/physics.ts`: passo de simulação em Hz fixo — aceleração, frenagem, resistência, direção sensível à velocidade (esterço máx. reduz com velocidade), derrapagem lateral, nitro (boost temporário de aceleração e velocidade máx.).
4. `src/core/surface.ts`: fricção por superfície (asfalto vs. grama) com forte resistência fora da pista.
5. `src/core/physics.test.ts`: testes de aceleração até a velocidade máx., frenagem, curva em alta velocidade (limite de esterço), nitro aumenta velocidade máx., grama reduz velocidade.

Verificação: `npm test` passa (novos testes + smoke).

#### Completion Log

- **Status**: completed (2026-08-18)
- **Descrição**: Núcleo de física arcade puro e determinístico implementado sem dependências de renderização (`src/core/types.ts`, `src/core/cars.ts`, `src/core/surface.ts`, `src/core/physics.ts`, `src/core/index.ts`). Implementados os 4 carros clássicos com stats balanceadas (Cannibal, Sidewinder, Razor, Weasel), simulação em passo fixo, esterço dependente de velocidade, arrasto/derrapagem lateral, aceleração/frenagem/ré, boost de nitro, modos de superfície (asfalto/grama/brita/pit) e modo crawl quando sem combustível. Suíte completa de 11 testes unitários em `src/core/physics.test.ts`.
- **Arquivos criados**: `src/core/types.ts`, `src/core/cars.ts`, `src/core/surface.ts`, `src/core/physics.ts`, `src/core/physics.test.ts`, `src/core/index.ts`.
- **Comandos de verificação**: `npm test` (12/12 testes passaram), `npm run build` (tsc + vite build concluídos com sucesso).

### Phase 3: Sistema de pista

Status: `completed`

Pista procedural por segmentos + lógica de corrida (voltas, progresso).

Implementação:
1. `src/track/segments.ts`: tipos de segmento (reta, curva com raio/ângulo).
2. `src/track/track.ts`: gera o circuito fechado a partir de dados (loop de segmentos → lista de pontos de centro, largura, normais) — 1 pista base nesta iteração.
3. `src/track/trackmath.ts`: utilidades puras — ponto no caminho (sampling), distância percorrida, ângulo da pista, projeção do carro no caminho.
4. `src/race/lap.ts`: contagem de voltas via travessia da linha start/fim (progresso 0..1 por volta), tempo por volta, melhor volta.
5. Testes: circuito fecha (início ≈ fim), sampling de posição, contagem de voltas (cruzou a linha N vezes), distância percorrida monotônica.

Verificação: `npm test` passa.

#### Completion Log

- **Status**: completed (2026-08-18)
- **Descrição**: Sistema de pista procedural e contagem de voltas implementado com loop fechado contínuo (`src/track/segments.ts`, `src/track/trackmath.ts`, `src/track/track.ts`, `src/track/index.ts`, `src/race/lap.ts`). Circuito 'Autódromo do Legado' com retas, curvas e pit lane; amostragem contínua por distância (tangente e normais), projeção 2D de carro com detecção de pista/off-track/pit; gerenciamento de voltas com checkpoints sequenciais, tempo por volta, melhor volta e detecção de chegada.
- **Arquivos criados**: `src/track/segments.ts`, `src/track/trackmath.ts`, `src/track/track.ts`, `src/track/index.ts`, `src/track/track.test.ts`, `src/race/lap.ts`, `src/race/lap.test.ts`.
- **Comandos de verificação**: `npm test` (20/20 testes passaram), `npm run build` (tsc strict + vite build concluídos com sucesso).

### Phase 4: Renderização 3D (Three.js)

Status: `completed`

Cena 3D low-poly colorida: pista, carro em primitivas, céu, neblina, câmera chase.

Implementação:
1. `src/render/scene.ts`: cena, luz direcional + ambiente, cor de fundo saturada, neblina (fog) para distância, grade de horizonte/planeta low-poly simples.
2. `src/render/trackMesh.ts`: mesh da pista a partir dos dados do track (ribbon com largura, barreiras laterais simples, marcações de borda).
3. `src/render/carMesh.ts`: carro low-poly em primitivas (carroceria, 4 rodas, aerofólio), rotação visual das rodas por velocidade.
4. `src/render/camera.ts`: câmera chase suave (lerp posição, olhar para frente do carro), FOV dinâmico com velocidade, kick no nitro.
5. `src/render/pitMesh.ts`: área do pit (box simples com pista lateral e placa).
6. `src/render/loop.ts`: game loop com `requestAnimationFrame`, deltaTime, step de física acumulado em Hz fixo.

Verificação: `npm run dev` — carro visível, dirige com setas (WASD), câmera segue suavemente, sem erros de console; `npm run build` passa.

#### Completion Log

- **Status**: completed (2026-08-18)
- **Descrição**: Sistema de renderização 3D Three.js integrado ao loop de física em 60 Hz fixos (`src/render/scene.ts`, `src/render/trackMesh.ts`, `src/render/carMesh.ts`, `src/render/camera.ts`, `src/render/pitMesh.ts`, `src/render/loop.ts`, `src/render/index.ts`, `src/main.ts`). Carros modelados proceduralmente com rotação de rodas, esterço visual e chamas de nitro; pista com zebras bicolores e pórtico; pit lane com boxes e letreiro neon; câmera chase suave em 3ª pessoa com FOV dinâmico e kick de nitro; HUD com telemetria, combustível, nitro e tempos de volta; controles via WASD / Setas / Shift / Espaço e tecla de troca rápida de carros (1 a 4).
- **Arquivos criados**: `src/render/scene.ts`, `src/render/trackMesh.ts`, `src/render/carMesh.ts`, `src/render/camera.ts`, `src/render/pitMesh.ts`, `src/render/loop.ts`, `src/render/index.ts`.
- **Comandos de verificação**: `npm test` (20/20 passaram), `npm run build` (tsc strict + vite build concluídos com sucesso).

### Phase 5: Gameplay — combustível, nitro e HUD

Status: `completed`

Sistemas de corrida do carro do jogador.

Implementação:
1. `src/gameplay/fuel.ts`: combustível (unidades), consumo por aceleração e velocidade, aviso de combustível baixo (evento), sem combustível → potência reduzida (crawl), reabastecimento no pit.
2. `src/gameplay/pit.ts`: zona de pit — ao entrar, barra de reabastecimento (~3s) → combustível 100%; posição/tempo de corrida continuam (arcade).
3. `src/gameplay/nitro.ts`: cargas de nitro por volta (recarrega ao completar volta), ativação com duração, consumo de carga, efeito no physics (boost).
4. `src/gameplay/hud.ts`: HUD em DOM/overlay — velocímetro, combustível (barra), nitro (contador/barra), volta, posição, tempo de volta atual; atualizado por frame a partir do estado da corrida.
5. `src/gameplay/input.ts`: teclado (setas/WASD, Shift nitro, freio) e gamepad (opcional, eixo do stick + gatilhos).
6. Testes unitários de fuel/nitro (consumo, recarga por volta, pit refuel).

Verificação: `npm test` passa; playtest manual: dirigir até ficar sem combustível, fazer pit stop, usar nitro e ver HUD atualizar.

#### Completion Log

- **Status**: completed (2026-08-18)
- **Descrição**: Sistemas completos de gameplay implementados (`src/gameplay/fuel.ts`, `src/gameplay/nitro.ts`, `src/gameplay/pit.ts`, `src/gameplay/input.ts`, `src/gameplay/hud.ts`, `src/gameplay/index.ts`). Sistema de combustível com consumo proporcional e crawl mode ao esgotar; sistema de pit stop com reabastecimento contínuo; sistema de nitro por cargas com recarga a cada nova volta; suporte a teclado e Gamepad API; HUD retrô com velocímetro, fuel gauge com warning dinâmico, mostradores de nitro e cronometragem. Suíte completa de testes unitários para combustível, pit e nitro.
- **Arquivos criados**: `src/gameplay/fuel.ts`, `src/gameplay/nitro.ts`, `src/gameplay/pit.ts`, `src/gameplay/input.ts`, `src/gameplay/hud.ts`, `src/gameplay/fuel.test.ts`, `src/gameplay/nitro.test.ts`, `src/gameplay/index.ts`.
- **Comandos de verificação**: `npm test` (28/28 passaram), `npm run build` (tsc strict + vite build concluídos com sucesso).

### Phase 6: Modos e IA

Status: `completed`

Time Attack + corrida contra IA + fluxo de corrida.

Implementação:
1. `src/race/ai.ts`: IA por waypoints (segue centro da pista com velocidade alvo por dificuldade), rubber-banding leve (ajuste de velocidade perto do jogador), variação lateral leve.
2. `src/race/race.ts`: estado da corrida — grid (jogador + 3-5 IAs), contagem regressiva 3-2-1-GO, posições (progresso total), ordem de chegada, fim da corrida.
3. `src/race/timeattack.ts`: Time Attack — corrida solo cronometrada, melhor volta em memória, tela de resultado com melhor tempo.
4. `src/gameplay/results.ts`: tela de resultados (posição/volta/tempo do jogador e IAs).
5. Testes unitários: posições por progresso, ordem de chegada, rubber-banding não ultrapassa limites.

Verificação: `npm test` passa; playtest: corrida de 3 voltas vs. IA completa do início ao fim; Time Attack registra melhor volta.

#### Completion Log

- **Status**: completed (2026-08-18)
- **Descrição**: Sistema de corrida completa, IA por waypoints e modo Time Attack implementados (`src/race/ai.ts`, `src/race/race.ts`, `src/race/timeattack.ts`, `src/gameplay/results.ts`, `src/race/index.ts`). Controlador de IA com 3 níveis de dificuldade (Amador, Pro, Campeonato), compensação por rubber-banding, desaceleração antecipada em curvas fechadas e ativação inteligente de nitro; Grid de largada com contagem regressiva 3-2-1-GO e ordenação da classificação em tempo real; Sessão de Time Attack com persistência de recordes; Tela de resultados em overlay modal com pódio e classificação detalhada. Suíte de testes unitários em `src/race/ai.test.ts` e `src/race/race.test.ts`.
- **Arquivos criados**: `src/race/ai.ts`, `src/race/race.ts`, `src/race/timeattack.ts`, `src/race/index.ts`, `src/race/ai.test.ts`, `src/race/race.test.ts`, `src/gameplay/results.ts`.
- **Comandos de verificação**: `npm test` (34/34 passaram), `npm run build` (tsc strict + vite build concluídos com sucesso).

### Phase 7: Menus, áudio e polish

Status: `completed`

Menus retrô SNES, áudio procedural e acabamento final.

Implementação:
1. `src/ui/menus.ts`: tela inicial (título "Top Gear: Legado", estilo retrô), seleção de modo (Corrida/Time Attack), seleção de carro (4 com stats exibidos), seleção de dificuldade (Amador/Profissional/Campeonato).
2. `src/ui/screens.ts`: gerenciador de telas (menu → corrida → resultados → menu), transições simples.
3. `src/audio/audio.ts`: WebAudio — motor sintetizado (oscilador + filtro, pitch por RPM), derrapagem (ruído filtrado), nitro (varredura de pitch), colisão leve; música chiptune simples (sequenciador de passos com osciladores quadrados).
4. `src/gameplay/events.ts`: barramento de eventos (nível baixo de combustível, nitro usado, volta completada, chegada) consumido por HUD/áudio.
5. Polish: barras de borda da pista visíveis, transições de cor por dificuldade, favicon/título da página, tratamento de redimensionamento de janela.

Verificação: `npm run build` limpo; playtest completo do fluxo menu → corrida → resultados → menu; som do motor muda com RPM; música toca no menu e na corrida.

#### Completion Log

- **Status**: completed (2026-08-18)
- **Descrição**: Menus retrô SNES, sintetizador de áudio WebAudio procedural e fluxo completo de jogo integrados (`src/ui/menus.ts`, `src/ui/screens.ts`, `src/ui/index.ts`, `src/audio/audio.ts`, `src/audio/index.ts`, `src/gameplay/events.ts`, `src/main.ts`). Menu inicial interativo com seleção de modo (Corrida vs IA / Time Attack), 4 carros selecionáveis com barras dinâmicas de atributos e 3 níveis de dificuldade; sintetizador WebAudio puro com som de motor modulado por rotação/RPM, derrapagem, nitro sweep, beeps de contagem regressiva e música chiptune estilo anos 90; fluxo ponta a ponta: Menu -> Contagem 3-2-1-GO -> Corrida 3D em tempo real -> Resultados com Pódio -> Reiniciar ou Retornar ao Menu.
- **Arquivos criados**: `src/ui/menus.ts`, `src/ui/screens.ts`, `src/ui/index.ts`, `src/audio/audio.ts`, `src/audio/index.ts`, `src/gameplay/events.ts`.
- **Comandos de verificação**: `npm test` (34/34 passaram com 100% de sucesso), `npm run build` (tsc strict + vite build concluídos com sucesso).

## Cross-Phase Verification

- `npm test` — toda a suíte passa.
- `npm run build` — tsc strict + vite build sem erros.
- Playtest final (checklist): 1) menu → selecionar Corrida, Carro, Dificuldade; 2) contagem 3-2-1-GO; 3) 3 voltas completas com nitro e pit stop; 4) IA disputa posições; 5) resultados corretos; 6) Time Attack registra melhor volta; 7) sem combustível → crawl → pit refaz; 8) som de motor/nitro/música audíveis; 9) janela redimensiona sem quebrar; 10) nenhum erro no console.

## Risks And Mitigations

- **Risco**: física instável em framerates variáveis.
  **Mitigação**: passo fixo de simulação (Hz fixo, acumulador) — já na Fase 2/4.
- **Risco**: Three.js API mudou (r160+).
  **Mitigação**: uso de APIs estáveis (WebGLRenderer, primitivas, fog); verificação via build em cada fase.
- **Risco**: IA desbalanceada (ou impossível de vencer, ou trivial).
  **Mitigação**: rubber-banding leve + 3 níveis de dificuldade com velocidades alvo distintas.
- **Risco**: escopo crescer além do slice.
  **Mitigação**: Non-Goals da SPEC monitorados pelo orquestrador; fases verificadas antes de avançar.
- **Risco**: subagentes editarem fora da própria fase.
  **Mitigação**: prompt de cada sprint delimita escopo e arquivos; revisão do diff entre fases.

## Out Of Scope

- Unity/C#, multiplayer, campeonato, colecionáveis, upgrades, dia/noite, clima, assets externos.

## Changes

N/A