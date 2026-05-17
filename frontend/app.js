// Configurações
const API_BASE = window.location.origin;
const WS_BASE = window.location.protocol === 'https:' ? `wss://${window.location.host}` : `ws://${window.location.host}`;

// Estado Local
let roomId = null;
let playerId = null;
let socket = null;
let gameState = null;
let isMuted = true;

let selectedCard = null;
let selectedPiece = null; // {row, col}
let validMovesCache = []; // [{row, col}]

// Elementos da UI
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const createBtn = document.getElementById('create-btn');
const createAIBtn = document.getElementById('create-ai-btn');
const joinBtn = document.getElementById('join-btn');
const roomInput = document.getElementById('room-input');
const playerSelect = document.getElementById('player-select');
const roomInfo = document.getElementById('room-info');
const linkP1 = document.getElementById('link-p1');
const linkP2 = document.getElementById('link-p2');
const copyBtn = document.getElementById('copy-btn');
const muteBtn = document.getElementById('mute-btn');

const boardEl = document.getElementById('board');
const p1CardsEl = document.getElementById('player-cards');
const p2CardsEl = document.getElementById('opponent-cards');
const neutralCardEl = document.getElementById('neutral-card-area');
const turnIndicator = document.getElementById('turn-indicator');
const roomDisplay = document.getElementById('room-display');
const playerDisplay = document.getElementById('player-display-visible');
const victoryModal = document.getElementById('victory-modal');
const victoryMessage = document.getElementById('victory-message');

// Definição das cartas para desenhar os grids
const CARDS = {
    "Tigre": [[0, -2], [0, 1]],
    "Dragão": [[-2, -1], [2, -1], [-1, 1], [1, 1]],
    "Sapo": [[-2, 0], [-1, -1], [1, 1]],
    "Coelho": [[1, -1], [2, 0], [-1, 1]],
    "Caranguejo": [[-2, 0], [2, 0], [0, -1]],
    "Elefante": [[-1, -1], [1, -1], [-1, 0], [1, 0]],
    "Ganso": [[-1, -1], [-1, 0], [1, 0], [1, 1]],
    "Galo": [[1, -1], [-1, 0], [1, 0], [-1, 1]],
    "Macaco": [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    "Louva-a-deus": [[-1, -1], [1, -1], [0, 1]],
    "Cavalo": [[0, -1], [-1, 0], [0, 1]],
    "Boi": [[0, -1], [1, 0], [0, 1]],
    "Garça": [[0, -1], [-1, 1], [1, 1]],
    "Javali": [[-1, 0], [1, 0], [0, -1]],
    "Enguia": [[-1, -1], [-1, 1], [1, 0]],
    "Cobra": [[1, -1], [1, 1], [-1, 0]]
};

// --- INICIALIZAÇÃO ---
let isInitialLoad = true;
let lastActionId = -1;

function init() {
    // Checar URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get('room');
    const player = urlParams.get('player');

    if (room && player) {
        roomId = room;
        playerId = player;
        connectWebSocket();
    } else {
        fetchActiveGames();
    }
}

async function fetchActiveGames() {
    try {
        const res = await fetch(`${API_BASE}/api/games`);
        const data = await res.json();
        const listEl = document.getElementById('active-games-list');
        const pastListEl = document.getElementById('past-games-list');
        listEl.innerHTML = '';
        pastListEl.innerHTML = '';
        
        const activeGames = data.games.filter(g => !g.winner);
        const pastGames = data.games.filter(g => g.winner);
        
        if (activeGames.length === 0) {
            listEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Nenhum jogo em andamento.</p>';
        } else {
            activeGames.forEach(game => {
                const gameDiv = document.createElement('div');
                gameDiv.className = 'game-item';
                gameDiv.innerHTML = `
                    <div>
                        <strong>Sala: ${game.room_id}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Turno: ${game.turn} | Jogadas: ${game.turn_count}</div>
                    </div>
                    <button class="secondary-btn" onclick="window.location.href='/?room=${game.room_id}&player=spectator'" style="padding: 6px 12px; font-size: 0.9rem;">Assistir</button>
                `;
                listEl.appendChild(gameDiv);
            });
        }

        if (pastGames.length === 0) {
            pastListEl.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">Nenhum jogo finalizado.</p>';
        } else {
            pastGames.forEach(game => {
                const gameDiv = document.createElement('div');
                gameDiv.className = 'game-item';
                const colorLabel = game.winner === 'p1' ? '<span style="color: #3b82f6;">🔵 Azul</span>' : '<span style="color: #ef4444;">🔴 Vermelho</span>';
                gameDiv.innerHTML = `
                    <div>
                        <strong style="color: #94a3b8; text-decoration: line-through;">Sala: ${game.room_id}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Jogadas Totais: ${game.turn_count}</div>
                    </div>
                    <div style="font-size: 0.9rem; font-weight: bold;">Vitória: ${colorLabel}</div>
                `;
                pastListEl.appendChild(gameDiv);
            });
        }

    } catch (e) {
        console.error("Erro ao carregar jogos ativos", e);
    }
}

// --- EVENTOS DE SETUP E CONTROLE ---
muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔇 Mudo' : '🔊 Som Ativo';
});

function copyLink() {
    linkP2.select();
    navigator.clipboard.writeText(linkP2.value).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copiado!';
        setTimeout(() => copyBtn.textContent = originalText, 2000);
    }).catch(err => alert("Erro ao copiar: " + err));
}

createBtn.addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_BASE}/api/new`, { method: 'POST' });
        const data = await res.json();
        
        roomId = data.room_id;
        
        // Mostrar links
        roomInfo.classList.remove('hidden');
        
        const p1Url = `${window.location.origin}${data.join_url_p1}`;
        const p2Url = `${window.location.origin}${data.join_url_p2}`;
        
        linkP1.href = p1Url;
        linkP2.value = p2Url;
        
    } catch (e) {
        alert("Erro ao criar partida: " + e);
    }
});

createAIBtn.addEventListener('click', async () => {
    try {
        const res = await fetch(`${API_BASE}/api/new-ai`, { method: 'POST' });
        const data = await res.json();
        
        window.location.href = data.join_url_p1;
    } catch (e) {
        alert("Erro ao criar partida contra IA: " + e);
    }
});

joinBtn.addEventListener('click', () => {
    const r = roomInput.value.trim();
    if (!r) return alert("Digite o código da sala");
    
    roomId = r;
    playerId = playerSelect.value;
    connectWebSocket();
});

// --- WEBSOCKET ---
function connectWebSocket() {
    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    roomDisplay.textContent = `Sala: ${roomId}`;
    if (playerId.startsWith('spectator')) {
        playerDisplay.textContent = "Você é: Espectador 👀";
    } else {
        playerDisplay.textContent = `Você é: Jogador ${playerId === 'p1' ? '1 (Azul)' : '2 (Vermelho)'}`;
    }

    socket = new WebSocket(`${WS_BASE}/ws/${roomId}/${playerId}`);

    socket.onopen = () => {
        console.log("Conectado!");
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.error) {
            alert(data.error);
            gameScreen.classList.add('hidden');
            setupScreen.classList.remove('hidden');
            window.history.pushState({}, document.title, window.location.pathname);
            socket.close();
            fetchActiveGames(); // Atualiza a lista caso a sala não exista mais
            return;
        }
        
        if (data.type === "state") {
            gameState = data.state;
            
            // Render buttons for missing players if I am a spectator
            if (playerId.startsWith('spectator')) {
                const connected = data.connected_players || [];
                renderSpectatorJoinButtons(connected);
            }
            
            if (gameState.last_action && gameState.last_action.id > lastActionId) {
                if (!isInitialLoad) {
                    playSound(gameState.last_action);
                }
                lastActionId = gameState.last_action.id;
            }
            isInitialLoad = false;
            
            render();
        }
    };

    socket.onclose = () => {
        turnIndicator.textContent = "Desconectado.";
        turnIndicator.style.color = "gray";
        
        // Se a conexão fechar e o tabuleiro nem tiver carregado, a sala não existe mais
        if (isInitialLoad) {
            setTimeout(() => {
                alert("Não foi possível conectar. A sala pode ter sido encerrada.");
                window.location.href = '/';
            }, 500);
        }
    };
}

// --- RENDERIZAÇÃO ---
function renderSpectatorJoinButtons(connectedPlayers) {
    const actionsDiv = document.getElementById('spectator-actions');
    actionsDiv.innerHTML = '';
    
    let hasMissing = false;
    
    if (!connectedPlayers.includes('p1')) {
        hasMissing = true;
        const btn = document.createElement('button');
        btn.className = 'primary-btn';
        btn.style.padding = '6px 12px';
        btn.style.fontSize = '0.85rem';
        btn.textContent = 'Assumir P1 (Azul)';
        btn.onclick = () => window.location.href = `/?room=${roomId}&player=p1`;
        actionsDiv.appendChild(btn);
    }
    
    if (!connectedPlayers.includes('p2') && !gameState.is_ai) {
        hasMissing = true;
        const btn = document.createElement('button');
        btn.className = 'primary-btn';
        btn.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
        btn.style.padding = '6px 12px';
        btn.style.fontSize = '0.85rem';
        btn.textContent = 'Assumir P2 (Vermelho)';
        btn.onclick = () => window.location.href = `/?room=${roomId}&player=p2`;
        actionsDiv.appendChild(btn);
    }
    
    if (hasMissing) {
        actionsDiv.classList.remove('hidden');
    } else {
        actionsDiv.classList.add('hidden');
    }
}

function render() {
    renderBoard();
    renderCards();
    updateStatus();
    checkVictory();
}

function updateStatus() {
    if (gameState.turn === playerId) {
        turnIndicator.textContent = "Sua Vez!";
        turnIndicator.className = `turn-${playerId}`;
    } else {
        turnIndicator.textContent = "Vez do Oponente...";
        turnIndicator.className = "";
    }
}

function checkVictory() {
    if (gameState.winner) {
        victoryModal.classList.remove('hidden');
        if (gameState.winner === playerId) {
            victoryMessage.textContent = "Você Venceu!";
            victoryMessage.style.color = "#4ade80";
        } else if (playerId.startsWith('spectator')) {
            const winnerColor = gameState.winner === 'p1' ? 'Azul' : 'Vermelho';
            victoryMessage.textContent = `Vitória: Jogador ${winnerColor}!`;
            victoryMessage.style.color = gameState.winner === 'p1' ? '#3b82f6' : '#ef4444';
        } else {
            victoryMessage.textContent = "Você Perdeu!";
            victoryMessage.style.color = "#ef4444";
        }
    }
}

function renderBoard() {
    boardEl.innerHTML = '';
    const board = gameState.board;

    const rows = playerId === 'p2' ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];
    const cols = playerId === 'p2' ? [4, 3, 2, 1, 0] : [0, 1, 2, 3, 4];

    for (let row of rows) {
        for (let col of cols) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;

            const piece = board[row][col];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.className = `piece piece-${piece}`;
                cell.appendChild(pieceEl);
            }

            // Highlights
            if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
                cell.classList.add('selected');
            }

            const isValidMove = validMovesCache.some(m => m.row === row && m.col === col);
            if (isValidMove) {
                cell.classList.add('valid-move');
            }

            // Evento de clique na célula
            cell.addEventListener('click', () => handleCellClick(row, col));

            boardEl.appendChild(cell);
        }
    }
}

function renderCards() {
    // Minhas cartas
    const myCards = playerId === 'p1' ? gameState.p1_cards : gameState.p2_cards;
    const oppCards = playerId === 'p1' ? gameState.p2_cards : gameState.p1_cards;
    
    p1CardsEl.innerHTML = '';
    myCards.forEach(c => p1CardsEl.appendChild(createCardElement(c, true)));
    
    p2CardsEl.innerHTML = '';
    oppCards.forEach(c => p2CardsEl.appendChild(createCardElement(c, false)));
    
    neutralCardEl.innerHTML = '';
    neutralCardEl.appendChild(createCardElement(gameState.neutral_card, false, true));
}

function createCardElement(cardName, isMine, isNeutral = false) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    if (isMine && selectedCard === cardName) cardDiv.classList.add('selected');
    
    const title = document.createElement('div');
    title.className = 'card-name';
    title.textContent = cardName;
    
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    
    const moves = CARDS[cardName];
    
    // Construir grid 5x5
    for(let r = 0; r < 5; r++){
        for(let c = 0; c < 5; c++){
            const cell = document.createElement('div');
            cell.className = 'card-cell';
            
            if(r === 2 && c === 2) {
                cell.classList.add('center');
            } else {
                const dy = r - 2;
                const dx = c - 2;
                
                const isMove = moves.some(m => m[0] === dx && m[1] === dy);
                if (isMove) {
                    cell.classList.add('move');
                }
            }
            grid.appendChild(cell);
        }
    }
    
    cardDiv.appendChild(title);
    cardDiv.appendChild(grid);
    
    if (isMine && gameState.turn === playerId && !gameState.winner) {
        cardDiv.addEventListener('click', () => {
            selectedCard = cardName;
            calculateValidMoves();
            render();
        });
    }
    
    return cardDiv;
}

// --- LÓGICA DE INTERAÇÃO ---
function handleCellClick(row, col) {
    if (playerId !== 'p1' && playerId !== 'p2') return; // Espectadores não interagem
    if (gameState.turn !== playerId || gameState.winner) return;

    const piece = gameState.board[row][col];
    
    // Se clicou num movimento válido
    const isValid = validMovesCache.some(m => m.row === row && m.col === col);
    if (isValid && selectedPiece && selectedCard) {
        // Enviar jogada
        socket.send(JSON.stringify({
            action: "move",
            from: [selectedPiece.row, selectedPiece.col],
            to: [row, col],
            card: selectedCard
        }));
        
        // Reset local state
        selectedPiece = null;
        selectedCard = null;
        validMovesCache = [];
        return;
    }

    if (piece.endsWith(playerId[1])) {
        selectedPiece = {row, col};
        calculateValidMoves();
        render();
    }
}

function calculateValidMoves() {
    validMovesCache = [];
    if (!selectedPiece || !selectedCard) return;

    const moves = CARDS[selectedCard];
    const {row, col} = selectedPiece;

    moves.forEach(m => {
        let dx = m[0];
        let dy = m[1];

        // Se eu sou p2, a carta gira 180 (ou os movimentos invertem em relação ao tabuleiro global)
        if (playerId === 'p2') {
            dx = -dx;
            dy = -dy;
        }

        const targetRow = row + dy;
        const targetCol = col + dx;

        // Verifica limites do tabuleiro
        if (targetRow >= 0 && targetRow < 5 && targetCol >= 0 && targetCol < 5) {
            const targetPiece = gameState.board[targetRow][targetCol];
            if (!targetPiece.endsWith(playerId[1])) {
                validMovesCache.push({row: targetRow, col: targetCol});
            }
        }
    });
}

// --- EFEITOS DE ÁUDIO ---
function playSound(action) {
    if (isMuted) return; 
    
    let audioSrc = 'sounds/move.mp3';
    
    if (action.captured) {
        const animalName = action.card;
        audioSrc = `sounds/${animalName}.mp3`;
        
        const audio = new Audio(audioSrc);
        audio.play().catch(e => {
            new Audio('sounds/capture.mp3').play().catch(err => {});
        });
        return;
    }
    
    new Audio(audioSrc).play().catch(err => {});
}

init();
