Dojo Tactics é um jogo brilhante! Ele pega a essência do xadrez, remove a complexidade das dezenas de peças diferentes e adiciona uma mecânica de rotação de movimentos que torna cada partida única.

Aqui está um mergulho nas regras e, em seguida, um roteiro para você tirar essa ideia do papel e levar para a web.

---

### Parte 1: Entendendo o Dojo Tactics

**História e Características**
Criado pelo designer japonês Shimpei Sato e lançado em 2014, o jogo original é um jogo de estratégia abstrata e informação perfeita (como o xadrez ou damas: não há dados ou elementos de sorte ocultos durante a partida, apenas no setup inicial). Ele se destaca por partidas rápidas (10-15 minutos) e pela extrema elegância do design.

**Componentes**

* **O Tabuleiro:** Uma grade simples de 5x5.
* **As Peças:** Cada jogador controla 5 peças: 1 Mestre (Monge) e 4 Discípulos (Estudantes). O espaço central da linha de trás de cada jogador é o "Templo" (ou Arco) do Mestre.
* **As Cartas de Movimento:** O jogo possui um baralho de 16 cartas, mas **apenas 5** são usadas em uma partida. Elas mostram uma grade com o movimento exato que uma peça pode fazer (ex: um passo para frente e um para a direita).

**Como Jogar (As Regras)**

1. **Setup:** As peças são dispostas nas linhas extremas do tabuleiro. O Mestre no centro, ladeado por dois Discípulos de cada lado. Embaralhe as 16 cartas e compre 5. Cada jogador recebe 2 cartas (que ficam abertas na mesa), e a 5ª carta fica neutra, ao lado do tabuleiro.
2. **O Turno:** Na sua vez, você *deve* escolher uma das suas duas cartas, mover qualquer uma de suas peças (Mestre ou Discípulo) seguindo o padrão exato daquela carta.
3. **A Troca (O Coração do Jogo):** Após usar a carta, você a coloca no espaço neutro ao lado do tabuleiro e pega a carta que estava lá para a sua mão. Ou seja, **o movimento que você acabou de usar estará disponível para o seu oponente no próximo turno dele**.
4. **Captura:** Se você mover uma peça para uma casa ocupada por uma peça adversária, a peça adversária é capturada e removida do jogo.
5. **Condições de Vitória:** Existem duas formas de vencer:
* **Caminho da Pedra:** Capturar o Mestre do oponente.
* **Caminho do Riacho:** Mover o seu próprio Mestre para a casa inicial do Mestre do oponente (o Templo adversário).



---

### Parte 2: Criando a Versão Web

Sobre o `antigravity`: no ecossistema Python, `import antigravity` é um *Easter Egg* clássico que abre uma tirinha do XKCD no navegador. Se você estiver usando o **PyScript** (que permite rodar Python direto no HTML e frequentemente brinca com esse conceito de "antigravity" para rodar código no browser), é uma ótima ferramenta para protótipos front-end.

Porém, para um jogo multiplayer com validação de regras sólida, separar as coisas entre um backend robusto e um frontend reativo é o caminho ideal. Utilizar algo como o **FastAPI** para gerenciar as rotas e o estado da partida encaixa perfeitamente nesse cenário, permitindo conexões em tempo real.

Aqui está um passo a passo estruturado com foco em algoritmos e modelagem de estado:

#### Passo 1: Modelagem das Estruturas de Dados (Backend em Python)

Antes de pensar em tela, o jogo precisa existir na memória.

* **O Tabuleiro:** Represente a grade 5x5 como uma matriz bidimensional (lista de listas).
* `0` para espaço vazio, `1` e `2` para os discípulos dos jogadores 1 e 2, `3` e `4` para os Mestres.


* **As Cartas:** Crie uma estrutura (como um dicionário ou dataclass) para as 16 cartas. Cada carta pode ser representada por uma lista de tuplas com coordenadas relativas `(dx, dy)`.
* *Exemplo da carta Tigre:* `[(0, 2), (0, -1)]` (dois passos para frente, um para trás).


* **O Estado da Partida:** Você precisa de um objeto que guarde a matriz do tabuleiro, as 2 cartas do Jogador A, as 2 do Jogador B, a carta neutra e de quem é o turno.

#### Passo 2: O Motor de Regras (Análise do Algoritmo)

Você precisará escrever funções puras para validar as jogadas. Isso envolve matemática de coordenadas simples:

* **Validação de Movimento:** A função recebe `(posicao_atual, carta_escolhida, posicao_destino)`. Ela soma o `(dx, dy)` da carta à `posicao_atual` e verifica se bate com a `posicao_destino`.
* **Limites:** Garantir que o destino não ultrapassa os limites `0 <= x <= 4` e `0 <= y <= 4`.
* **Colisão:** Garantir que o destino não está ocupado por uma peça do *próprio* jogador.
* **Condição de Vitória:** Checar se a peça capturada foi um Mestre, ou se o Mestre que se moveu aterrissou na coordenada `(0, 2)` ou `(4, 2)` correspondente ao templo inimigo.

#### Passo 3: Criando a API (FastAPI)

Para conectar a lógica à web:

* **Rotas REST:** Crie uma rota `POST /match/new` para inicializar a matriz e sortear as 5 cartas.
* **WebSockets (Obrigatório para tempo real):** Como é um jogo de turnos onde a tela do oponente precisa atualizar na hora, crie um endpoint WebSocket. Quando o Jogador A faz um movimento, o backend valida no motor de regras, atualiza a matriz, rotaciona as cartas e faz o *broadcast* do novo estado (em JSON) para ambos os jogadores.

#### Passo 4: O Frontend (HTML/JS/CSS)

Mantenha simples no começo:

* **A Grade:** Use CSS Grid (`display: grid; grid-template-columns: repeat(5, 1fr);`) para desenhar o tabuleiro 5x5.
* **A Interface das Cartas:** Mostre 2 blocos de cartas na parte inferior (suas), 2 na superior (oponente) e 1 na lateral (neutra).
* **Interatividade (JS):**
1. Clique na carta que deseja usar (ela fica destacada).
2. Clique na peça que deseja mover (o JS pode calcular e destacar as casas válidas no tabuleiro baseado na carta).
3. Clique no destino. O JS envia um payload pelo WebSocket: `{"action": "move", "from": [3,2], "to": [2,2], "card": "Tiger"}`.



**Dica de Desenvolvimento:** Comece rodando tudo no terminal primeiro. Imprima a matriz 5x5 no console e garanta que o loop de rotação das cartas e as validações de vitória estão 100% corretos antes de encostar no HTML ou no FastAPI. Se a matemática e os algoritmos de estado estiverem sólidos no núcleo Python, plugar a interface web depois vira apenas um detalhe de exibição.