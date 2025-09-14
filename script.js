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
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.loadQuestions();
    }
    
    initializeEventListeners() {
        // Landing page buttons
        document.getElementById('createRoomBtn').addEventListener('click', () => this.showCreateRoom());
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.showJoinRoom());
        
        // Create room page
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyRoomCode());
        document.getElementById('backToLandingBtn').addEventListener('click', () => this.showLanding());
        document.getElementById('hostName').addEventListener('input', (e) => this.updateHostName(e.target.value));
        
        // Join room page
        document.getElementById('joinGameBtn').addEventListener('click', () => this.joinGame());
        document.getElementById('backToLandingBtn2').addEventListener('click', () => this.showLanding());
        
        // Game room page
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
        
        // Chat input enter key
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        // Room code input enter key
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinGame();
            }
        });
        
        // Room code input character limit feedback
        document.getElementById('roomCodeInput').addEventListener('input', (e) => {
            const value = e.target.value.toUpperCase();
            e.target.value = value;
            if (value.length === 6) {
                e.target.style.borderColor = '#28a745';
            } else {
                e.target.style.borderColor = '#e0e0e0';
            }
        });
        
        // Question input enter key
        document.getElementById('newTruthQuestion').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addQuestion('truth');
            }
        });
        
        document.getElementById('newDareQuestion').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addQuestion('dare');
            }
        });
    }
    
    initializeSocketListeners() {
        // Room events
        this.socket.on('room-created', (data) => {
            this.roomCode = data.roomCode;
            this.playerName = data.playerName;
            this.isHost = true;
            this.players = [{ id: this.socket.id, name: data.playerName, isHost: true }];
            this.updatePlayersList();
            document.getElementById('currentRoomCode').textContent = data.roomCode;
            document.getElementById('roomCode').textContent = data.roomCode;
            // Show the game room after room is created
            this.showGameRoom();
            // Don't automatically start the game - let host decide when to start
        });
        
        this.socket.on('room-joined', (data) => {
            console.log('Successfully joined room:', data.roomCode);
            console.log('Players in room:', data.players);
            this.roomCode = data.roomCode;
            this.players = data.players;
            this.isHost = data.players.find(p => p.id === this.socket.id)?.isHost || false;
            this.updatePlayersList();
            this.updateGameDisplay();
            this.showGameRoom();
        });
        
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
        
        this.socket.on('room-error', (data) => {
            console.error('Room error:', data.message);
            alert(`Error: ${data.message}`);
        });
        
        // Game events
        this.socket.on('game-started', (data) => {
            this.gameStarted = true;
            this.players = data.players;
            this.currentPlayer = data.currentPlayer;
            this.updateGameDisplay();
            this.addChatMessage('System', 'Game started!', false);
        });
        
        
        this.socket.on('challenge-selected', (data) => {
            this.showCard(data.type, data.question, data.player);
        });
        
        this.socket.on('player-changed', (data) => {
            this.players = data.players;
            this.currentPlayer = data.currentPlayer;
            this.updateGameDisplay();
            this.resetCard();
        });
        
        // Chat events
        this.socket.on('chat-message', (data) => {
            this.addChatMessage(data.player, data.message, data.player === this.playerName);
        });
        
        // Voice events
        this.socket.on('voice-status', (data) => {
            if (data.player !== this.playerName) {
                this.updateVoiceStatus(data.player, data.enabled);
            }
        });
    }
    
    // Page Navigation
    showPage(pageId) {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
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
        // Auto-generate room code when page loads
    }
    
    showJoinRoom() {
        this.showPage('joinRoomPage');
        this.isHost = false;
    }
    
    showGameRoom() {
        this.showPage('gameRoomPage');
        this.updateGameDisplay();
    }
    
    // Room Management
    generateRoomCode() {
        // Generate a temporary room code for display
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.roomCode = result;
        document.getElementById('roomCode').textContent = result;
        document.getElementById('currentRoomCode').textContent = result;
    }
    
    createRoom() {
        const playerName = document.getElementById('hostName').value.trim();
        if (!playerName) {
            alert('Please enter your name');
            return;
        }
        
        this.socket.emit('create-room', { playerName });
    }
    
    joinGame() {
        const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        const playerName = document.getElementById('playerName').value.trim();
        
        console.log('Attempting to join room:', roomCode);
        console.log('Player name:', playerName);
        
        if (!roomCode || !playerName) {
            alert('Please enter both room code and your name');
            return;
        }
        
        if (roomCode.length !== 6) {
            alert('Room code must be 6 characters long');
            return;
        }
        
        this.socket.emit('join-room', { roomCode, playerName });
    }
    
    startGame() {
        if (!this.playerName.trim()) {
            alert('Please enter your name');
            return;
        }
        
        // Create the room with the player name
        this.socket.emit('create-room', { playerName: this.playerName });
    }
    
    copyRoomCode() {
        navigator.clipboard.writeText(this.roomCode).then(() => {
            const btn = document.getElementById('copyCodeBtn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.style.background = '#28a745';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '';
            }, 2000);
        });
    }
    
    updateHostName(name) {
        this.playerName = name;
        const startBtn = document.getElementById('startGameBtn');
        startBtn.disabled = !name.trim();
    }
    
    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';
        this.players.forEach(player => {
            const playerTag = document.createElement('div');
            playerTag.className = 'player-tag';
            playerTag.textContent = player.name + (player.isHost ? ' (Host)' : '');
            playersList.appendChild(playerTag);
        });
    }
    
    updateMiniPlayerList() {
        const playersListMini = document.getElementById('playersListMini');
        if (!playersListMini) return;
        
        playersListMini.innerHTML = '';
        this.players.forEach(player => {
            const playerTag = document.createElement('div');
            playerTag.className = 'player-tag-mini';
            playerTag.innerHTML = `
                <span class="player-name">${player.name}</span>
                ${player.isHost ? '<i class="fas fa-crown host-icon"></i>' : ''}
                ${player.id === this.socket.id ? '<i class="fas fa-user current-player-icon"></i>' : ''}
            `;
            playersListMini.appendChild(playerTag);
        });
    }
    
    updateGameDisplay() {
        document.getElementById('currentRoomCode').textContent = this.roomCode;
        console.log("🔄 Updating display — Current player:", this.currentPlayer);
        document.getElementById('playersCount').textContent = this.players.length;
        document.getElementById('currentPlayerName').textContent = this.currentPlayer?.name || 'Player 1';
        
        // Update mini player list
        this.updateMiniPlayerList();
        
        // Show/hide start button based on host status and game state
        const startBtn = document.getElementById('startGameBtn');
        if (startBtn) {
            if (this.isHost && !this.gameStarted) {
                startBtn.style.display = 'block';
                startBtn.disabled = false;
                startBtn.textContent = 'Start Game';
            } else if (this.isHost && this.gameStarted) {
                startBtn.style.display = 'none';
            } else {
                startBtn.style.display = 'none';
            }
        }
    }
    
    // Game Logic
    selectTruth() {
        console.log('Truth button clicked');
        console.log('Is current player:', this.isCurrentPlayer());
        console.log('Room code:', this.roomCode);
        console.log('Game started:', this.gameStarted);
        if (!this.isCurrentPlayer()) {
            console.log('Not current player, cannot select truth');
            return;
        }
        this.socket.emit('select-challenge', { roomCode: this.roomCode, type: 'truth' });
    }
    
    selectDare() {
        console.log('Dare button clicked');
        console.log('Is current player:', this.isCurrentPlayer());
        console.log('Room code:', this.roomCode);
        console.log('Game started:', this.gameStarted);
        if (!this.isCurrentPlayer()) {
            console.log('Not current player, cannot select dare');
            return;
        }
        this.socket.emit('select-challenge', { roomCode: this.roomCode, type: 'dare' });
    }
    
    showCard(type, question, player) {
        document.getElementById('cardType').textContent = type;
        document.getElementById('cardQuestion').textContent = question;
        document.getElementById('nextPlayerBtn').disabled = !this.isCurrentPlayer();
        
        // Disable truth/dare buttons temporarily
        document.getElementById('truthBtn').disabled = true;
        document.getElementById('dareBtn').disabled = true;
        
        // Re-enable after 3 seconds
        setTimeout(() => {
            document.getElementById('truthBtn').disabled = false;
            document.getElementById('dareBtn').disabled = false;
        }, 3000);
    }
    
    resetCard() {
        document.getElementById('cardType').textContent = 'Truth or Dare';
        document.getElementById('cardQuestion').textContent = 'Choose your challenge!';
        document.getElementById('nextPlayerBtn').disabled = !this.isCurrentPlayer();
    }
    
    nextPlayer() {
        if (!this.isCurrentPlayer()) return;
        this.socket.emit('next-player', { roomCode: this.roomCode });
    }
    
    isCurrentPlayer() {
        return this.currentPlayer && this.currentPlayer.id === this.socket.id;
    }
    
    // Voice and Chat
    async toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        const voicePanel = document.getElementById('voicePanel');
        const voiceBtn = document.getElementById('voiceToggleBtn');
        
        if (this.voiceEnabled) {
            try {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                voicePanel.classList.remove('hidden');
                voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Voice';
                voiceBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a24)';
                document.getElementById('voiceStatus').textContent = 'Voice chat active';
                
                this.socket.emit('voice-toggle', { roomCode: this.roomCode, enabled: true });
            } catch (error) {
                console.error('Error accessing microphone:', error);
                alert('Could not access microphone. Please check permissions.');
                this.voiceEnabled = false;
            }
        } else {
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
            }
            voicePanel.classList.add('hidden');
            voiceBtn.innerHTML = '<i class="fas fa-microphone"></i> Voice';
            voiceBtn.style.background = '';
            document.getElementById('voiceStatus').textContent = 'Voice chat ready';
            
            this.socket.emit('voice-toggle', { roomCode: this.roomCode, enabled: false });
        }
    }
    
    toggleChat() {
        this.chatEnabled = !this.chatEnabled;
        const chatPanel = document.getElementById('chatPanel');
        const chatBtn = document.getElementById('chatToggleBtn');
        
        if (this.chatEnabled) {
            chatPanel.classList.remove('hidden');
            chatBtn.innerHTML = '<i class="fas fa-comments"></i> Chat';
            chatBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a24)';
        } else {
            chatPanel.classList.add('hidden');
            chatBtn.innerHTML = '<i class="fas fa-comments"></i> Chat';
            chatBtn.style.background = '';
        }
    }
    
    sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        this.socket.emit('chat-message', { roomCode: this.roomCode, message });
        chatInput.value = '';
    }
    
    addChatMessage(sender, message, isOwn) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isOwn ? 'own' : 'other'}`;
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    updateVoiceStatus(player, enabled) {
        // Update voice status for other players
        console.log(`${player} voice ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    toggleMute() {
        const muteBtn = document.getElementById('muteBtn');
        const isMuted = muteBtn.innerHTML.includes('microphone-slash');
        
        if (isMuted) {
            muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Mute';
            document.getElementById('voiceStatus').textContent = 'Voice chat active';
        } else {
            muteBtn.innerHTML = '<i class="fas fa-microphone"></i> Unmute';
            document.getElementById('voiceStatus').textContent = 'Voice chat muted';
        }
    }
    
    // Question Management
    async loadQuestions() {
        try {
            const response = await fetch('/api/questions');
            this.questions = await response.json();
            this.updateQuestionsDisplay();
        } catch (error) {
            console.error('Error loading questions:', error);
        }
    }
    
    showQuestionModal() {
        if (!this.isHost) {
            alert('Only the host can manage questions');
            return;
        }
        document.getElementById('questionModal').classList.remove('hidden');
        this.updateQuestionsDisplay();
    }
    
    hideQuestionModal() {
        document.getElementById('questionModal').classList.add('hidden');
    }
    
    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}Tab`).classList.add('active');
    }
    
    async addQuestion(type) {
        const input = document.getElementById(`new${type.charAt(0).toUpperCase() + type.slice(1)}Question`);
        const question = input.value.trim();
        
        if (!question) return;
        
        try {
            const response = await fetch(`/api/questions/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });
            
            if (response.ok) {
                this.questions[type].push(question);
                input.value = '';
                this.updateQuestionsDisplay();
            } else {
                alert('Failed to add question');
            }
        } catch (error) {
            console.error('Error adding question:', error);
            alert('Failed to add question');
        }
    }
    
    async deleteQuestion(type, index) {
        try {
            const response = await fetch(`/api/questions/${type}/${index}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.questions[type].splice(index, 1);
                this.updateQuestionsDisplay();
            } else {
                alert('Failed to delete question');
            }
        } catch (error) {
            console.error('Error deleting question:', error);
            alert('Failed to delete question');
        }
    }
    
    updateQuestionsDisplay() {
        this.updateQuestionsList('truth');
        this.updateQuestionsList('dare');
    }
    
    updateQuestionsList(type) {
        const list = document.getElementById(`${type}QuestionsList`);
        list.innerHTML = '';
        
        this.questions[type].forEach((question, index) => {
            const item = document.createElement('div');
            item.className = 'question-item';
            item.innerHTML = `
                <div class="question-text">${question}</div>
                <div class="question-actions">
                    <button class="btn-delete" onclick="game.deleteQuestion('${type}', ${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            list.appendChild(item);
        });
    }
    
    // Utility
    resetGame() {
        this.roomCode = '';
        this.playerName = '';
        this.isHost = false;
        this.players = [];
        this.currentPlayer = null;
        this.gameStarted = false;
        this.voiceEnabled = false;
        this.chatEnabled = false;
        
        // Reset form inputs
        document.getElementById('hostName').value = '';
        document.getElementById('roomCodeInput').value = '';
        document.getElementById('playerName').value = '';
        document.getElementById('chatInput').value = '';
        
        // Hide panels
        document.getElementById('chatPanel').classList.add('hidden');
        document.getElementById('voicePanel').classList.add('hidden');
        document.getElementById('questionModal').classList.add('hidden');
        
        // Reset buttons
        document.getElementById('startGameBtn').disabled = true;
        document.getElementById('voiceToggleBtn').innerHTML = '<i class="fas fa-microphone"></i> Voice';
        document.getElementById('chatToggleBtn').innerHTML = '<i class="fas fa-comments"></i> Chat';
        document.getElementById('voiceToggleBtn').style.background = '';
        document.getElementById('chatToggleBtn').style.background = '';
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TruthOrDareGame();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (window.game && window.game.currentPage === 'gameRoomPage') {
        if (e.key === 't' || e.key === 'T') {
            document.getElementById('truthBtn').click();
        } else if (e.key === 'd' || e.key === 'D') {
            document.getElementById('dareBtn').click();
        } else if (e.key === 'n' || e.key === 'N') {
            if (!document.getElementById('nextPlayerBtn').disabled) {
                document.getElementById('nextPlayerBtn').click();
            }
        }
    }
});