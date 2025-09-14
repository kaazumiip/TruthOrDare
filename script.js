// Real-time multiplayer Truth or Dare game
class TruthOrDareGame {
    constructor() {
        this.socket = io();
        this.currentPage = 'landingPage';
        this.roomCode = '';
        this.playerName = '';
        this.isHost = false;
        this.players = [];
        this.currentPlayer = null;
        this.gameStarted = false;
        this.voiceEnabled = false;
        this.chatEnabled = false;
        this.mediaStream = null;
        this.questions = { truth: [], dare: [] };
        this.turnTimer = null;
        this.turnTimeLeft = 30;

        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.loadQuestions();
    }

    // ------------------- Event Listeners -------------------
    initializeEventListeners() {
        // Landing page
        document.getElementById('createRoomBtn').addEventListener('click', () => this.showCreateRoom());
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.showJoinRoom());

        // Create room
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyRoomCode());
        document.getElementById('backToLandingBtn').addEventListener('click', () => this.showLanding());
        document.getElementById('hostName').addEventListener('input', (e) => this.updateHostName(e.target.value));

        // Join room
        document.getElementById('joinGameBtn').addEventListener('click', () => this.joinGame());
        document.getElementById('backToLandingBtn2').addEventListener('click', () => this.showLanding());

        // Game room
        document.getElementById('truthBtn').addEventListener('click', () => this.selectTruth());
        document.getElementById('dareBtn').addEventListener('click', () => this.selectDare());
        document.getElementById('nextPlayerBtn').addEventListener('click', () => this.nextPlayer());
        document.getElementById('voiceToggleBtn').addEventListener('click', () => this.toggleVoice());
        document.getElementById('chatToggleBtn').addEventListener('click', () => this.toggleChat());
        document.getElementById('closeChatBtn').addEventListener('click', () => this.toggleChat());
        document.getElementById('closeVoiceBtn').addEventListener('click', () => this.toggleVoice());
        document.getElementById('sendMessageBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('muteBtn').addEventListener('click', () => this.toggleMute());
        document.getElementById('manageQuestionsBtn').addEventListener('click', () => this.showQuestionModal());

        // Question management
        document.getElementById('closeQuestionModal').addEventListener('click', () => this.hideQuestionModal());
        document.getElementById('addTruthBtn').addEventListener('click', () => this.addQuestion('truth'));
        document.getElementById('addDareBtn').addEventListener('click', () => this.addQuestion('dare'));

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Enter key for chat
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Enter key for room code
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });

        // Room code uppercase & length feedback
        document.getElementById('roomCodeInput').addEventListener('input', (e) => {
            const value = e.target.value.toUpperCase();
            e.target.value = value;
            e.target.style.borderColor = value.length === 6 ? '#28a745' : '#e0e0e0';
        });

        // Question input enter key
        document.getElementById('newTruthQuestion').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addQuestion('truth');
        });
        document.getElementById('newDareQuestion').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addQuestion('dare');
        });
    }

    // ------------------- Socket Listeners -------------------
    initializeSocketListeners() {
        // Room created by server
        this.socket.on('room-created', (data) => {
            this.roomCode = data.roomCode;   // server-generated
            this.playerName = data.playerName;
            this.isHost = true;
            this.players = [{ id: this.socket.id, name: data.playerName, isHost: true }];
            this.updatePlayersList();

            document.getElementById('currentRoomCode').textContent = data.roomCode;
            document.getElementById('roomCode').textContent = data.roomCode;

            this.showGameRoom();
        });

        // Room joined by player
        this.socket.on('room-joined', (data) => {
            this.roomCode = data.roomCode;
            this.players = data.players;
            this.isHost = data.players.find(p => p.id === this.socket.id)?.isHost || false;
            this.updatePlayersList();
            this.updateGameDisplay();
            this.showGameRoom();
        });

        // Player events
        this.socket.on('player-joined', (data) => {
            this.players = data.players;
            this.updatePlayersList();
            this.updateGameDisplay();
            this.addChatMessage('System', `${data.player.name} joined the game!`, false);
        });
        this.socket.on('player-left', (data) => {
            this.players = data.players;
            this.updatePlayersList();
            this.updateGameDisplay();
            this.addChatMessage('System', `${data.player} left the game`, false);
        });

        // Game events
        this.socket.on('game-started', (data) => {
            this.gameStarted = true;
            this.players = data.players;
            this.currentPlayer = data.currentPlayer;
            this.turnInfo = data.turnInfo;
            this.updateGameDisplay();
            this.updateTurnDisplay();
            this.addChatMessage('System', 'Game started!', false);
        });

        this.socket.on('challenge-selected', (data) => {
            this.turnInfo = data.turnInfo;
            this.showCard(data.type, data.question, data.player);
            this.updateTurnDisplay();
        });

        this.socket.on('player-changed', (data) => {
            this.players = data.players;
            this.currentPlayer = data.currentPlayer;
            this.turnInfo = data.turnInfo;
            this.updateGameDisplay();
            this.updateTurnDisplay();
            this.resetCard();
            if (data.autoAdvanced) this.addChatMessage('System', 'Turn automatically advanced!', false);
        });

        this.socket.on('turn-error', (data) => this.addChatMessage('System', data.message, false));
        this.socket.on('chat-message', (data) => this.addChatMessage(data.player, data.message, data.player === this.playerName));
        this.socket.on('voice-status', (data) => { if (data.player !== this.playerName) this.updateVoiceStatus(data.player, data.enabled); });
        this.socket.on('room-error', (data) => { alert(`Error: ${data.message}`); });
    }

    // ------------------- Page Navigation -------------------
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        this.currentPage = pageId;
    }
    showLanding() {
        this.showPage('landingPage');
        this.resetGame();
    }
    showCreateRoom() {
        this.showPage('createRoomPage');
        this.isHost = true;
        this.players = [];
        this.updatePlayersList();
    }
    showJoinRoom() {
        this.showPage('joinRoomPage');
        this.isHost = false;
    }
    showGameRoom() {
        this.showPage('gameRoomPage');
        this.updateGameDisplay();
    }

    // ------------------- Room Management -------------------
    startGame() {
        if (!this.playerName.trim()) { alert('Please enter your name'); return; }
        this.socket.emit('create-room', { playerName: this.playerName });
    }

    joinGame() {
        const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        const playerName = document.getElementById('playerName').value.trim();
        if (!roomCode || !playerName) { alert('Please enter both room code and your name'); return; }
        if (roomCode.length !== 6) { alert('Room code must be 6 characters long'); return; }
        this.socket.emit('join-room', { roomCode, playerName });
    }

    copyRoomCode() {
        navigator.clipboard.writeText(this.roomCode).then(() => {
            const btn = document.getElementById('copyCodeBtn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.style.background = '#28a745';
            setTimeout(() => { btn.innerHTML = originalHTML; btn.style.background = ''; }, 2000);
        });
    }

    updateHostName(name) {
        this.playerName = name;
        document.getElementById('startGameBtn').disabled = !name.trim();
    }

    // ------------------- Players & Game Display -------------------
    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        this.players.forEach(player => {
            const playerTag = document.createElement('div');
            playerTag.className = 'player-tag';
            playerTag.textContent = player.name + (player.isHost ? ' (Host)' : '');
            playersList.appendChild(playerTag);
        });
        this.updateMiniPlayerList();
    }

    updateMiniPlayerList() {
        const playersListMini = document.getElementById('playersListMini');
        if (!playersListMini) return;
        playersListMini.innerHTML = '';
        this.players.forEach((player, index) => {
            const playerTag = document.createElement('div');
            playerTag.className = 'player-tag-mini';
            const isCurrentTurn = this.turnInfo && index === this.turnInfo.currentPlayerIndex;
            const isMyTurn = this.turnInfo && this.turnInfo.currentPlayer?.id === this.socket.id;
            playerTag.innerHTML = `
                <span class="player-name">${player.name}</span>
                ${player.isHost ? '<i class="fas fa-crown host-icon"></i>' : ''}
                ${player.id === this.socket.id ? '<i class="fas fa-user current-player-icon"></i>' : ''}
            `;
            if (isCurrentTurn) {
                playerTag.style.background = isMyTurn ? '#e3f2fd' : '#fff3e0';
                playerTag.style.border = isMyTurn ? '2px solid #2196f3' : '2px solid #ff9800';
                playerTag.style.fontWeight = 'bold';
            }
            playersListMini.appendChild(playerTag);
        });
    }

    updateGameDisplay() {
        document.getElementById('currentRoomCode').textContent = this.roomCode;
        document.getElementById('playersCount').textContent = this.players.length;
        document.getElementById('currentPlayerName').textContent = this.currentPlayer?.name || 'Player 1';
        this.updateMiniPlayerList();

        const startBtn = document.getElementById('startGameBtn');
        if (startBtn) {
            if (this.isHost && !this.gameStarted) { startBtn.style.display = 'block'; startBtn.disabled = false; startBtn.textContent = 'Start Game'; }
            else { startBtn.style.display = 'none'; }
        }
    }

    // ------------------- Game Logic -------------------
    selectTruth() { if (!this.isCurrentPlayer()) return; this.socket.emit('select-challenge', { roomCode: this.roomCode, type: 'truth' }); }
    selectDare() { if (!this.isCurrentPlayer()) return; this.socket.emit('select-challenge', { roomCode: this.roomCode, type: 'dare' }); }

    showCard(type, question, player) {
        document.getElementById('cardType').textContent = type;
        document.getElementById('cardQuestion').textContent = question;
        document.getElementById('cardPlayer').textContent = player.name;
        document.getElementById('challengeCard').classList.add('show');
    }

    resetCard() {
        document.getElementById('cardType').textContent = '';
        document.getElementById('cardQuestion').textContent = '';
        document.getElementById('cardPlayer').textContent = '';
        document.getElementById('challengeCard').classList.remove('show');
    }

    nextPlayer() {
        if (!this.isHost) return;
        this.socket.emit('next-turn', { roomCode: this.roomCode });
    }

    isCurrentPlayer() { return this.currentPlayer?.id === this.socket.id; }

    // ------------------- Chat & Voice -------------------
    addChatMessage(player, message, isSelf = false) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${isSelf ? 'self' : ''}`;
        messageEl.innerHTML = `<strong>${player}:</strong> ${message}`;
        chatContainer.appendChild(messageEl);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        if (!message) return;
        this.socket.emit('send-message', { roomCode: this.roomCode, message });
        input.value = '';
    }

    toggleVoice() { this.voiceEnabled = !this.voiceEnabled; this.updateVoiceUI(); }
    toggleChat() { this.chatEnabled = !this.chatEnabled; this.updateChatUI(); }

    updateVoiceUI() { document.getElementById('voiceContainer').style.display = this.voiceEnabled ? 'block' : 'none'; }
    updateChatUI() { document.getElementById('chatContainer').style.display = this.chatEnabled ? 'block' : 'none'; }

    updateVoiceStatus(playerName, enabled) {
        // update UI of other player voice status
    }

    toggleMute() {
        if (!this.mediaStream) return;
        this.mediaStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    }

    // ------------------- Questions -------------------
    loadQuestions() { this.questions = { truth: ['Default Truth 1'], dare: ['Default Dare 1'] }; }
    showQuestionModal() { document.getElementById('questionModal').style.display = 'block'; }
    hideQuestionModal() { document.getElementById('questionModal').style.display = 'none'; }
    addQuestion(type) {
        const input = document.getElementById(type === 'truth' ? 'newTruthQuestion' : 'newDareQuestion');
        const q = input.value.trim();
        if (!q) return;
        this.questions[type].push(q);
        input.value = '';
        this.renderQuestions(type);
    }
    renderQuestions(type) {
        const container = document.getElementById(type === 'truth' ? 'truthList' : 'dareList');
        container.innerHTML = '';
        this.questions[type].forEach(q => {
            const qEl = document.createElement('div'); qEl.textContent = q; container.appendChild(qEl);
        });
    }

    // ------------------- Misc -------------------
    switchTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    }

    resetGame() {
        this.roomCode = '';
        this.playerName = '';
        this.isHost = false;
        this.players = [];
        this.currentPlayer = null;
        this.gameStarted = false;
        this.turnInfo = null;
        this.updatePlayersList();
    }
}

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', () => { window.game = new TruthOrDareGame(); });
