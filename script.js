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
        this.sounds = {};
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.loadQuestions();
        this.createNotificationContainer();
        this.initializeSounds();
    }
    
    initializeEventListeners() {
        // Landing page buttons
        document.getElementById('createRoomBtn').addEventListener('click', () => this.showCreateRoom());
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.showJoinRoom());
        
        // Create room page
        document.getElementById('startGameBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyRoomCode());
        document.getElementById('backToLandingBtn').addEventListener('click', () => this.showLanding());
        document.getElementById('hostName').addEventListener('input', (e) => this.updateHostName(e.target.value));
        
        // Game room page
        document.getElementById('startGameInRoomBtn').addEventListener('click', () => this.startGame());
        
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
            e.target.classList.remove('error');
            
            if (value.length === 6) {
                e.target.style.borderColor = '#00b894';
                e.target.style.boxShadow = '0 0 0 2px rgba(0, 184, 148, 0.1)';
            } else if (value.length > 0) {
                e.target.style.borderColor = '#e17055';
                e.target.style.boxShadow = '0 0 0 2px rgba(225, 112, 85, 0.1)';
            } else {
                e.target.style.borderColor = '#e0e0e0';
                e.target.style.boxShadow = '';
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
            document.getElementById('roomCode').textContent = data.roomCode;
            console.log("This is the room code" + this.roomCode);
            document.getElementById('currentRoomCode').textContent = data.roomCode;
            
            this.hideLoadingOverlay();
            this.setButtonLoading('startGameBtn', false);
            this.showNotification(`Room ${data.roomCode} created! Share the code with friends.`, 'success');
            
            // Go to game room immediately after room creation
            this.showGameRoom();
            this.updateGameDisplay();
        });
        
        this.socket.on('room-joined', (data) => {
            console.log('Successfully joined room:', data.roomCode);
            console.log('Players in room:', data.players);
            this.roomCode = data.roomCode;
            this.players = data.players;
            this.isHost = data.players.find(p => p.id === this.socket.id)?.isHost || false;
            this.updatePlayersList();
            this.updateGameDisplay();
            
            this.hideLoadingOverlay();
            this.setButtonLoading('joinGameBtn', false);
            this.showNotification(`Successfully joined room ${data.roomCode}!`, 'success');
            
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
            this.hideLoadingOverlay();
            this.setButtonLoading('joinGameBtn', false);
            this.setButtonLoading('startGameBtn', false);
            this.setButtonLoading('startGameInRoomBtn', false);
            this.showNotification(data.message, 'error');
        });
        
        // Game events
        this.socket.on('game-started', (data) => {
            this.gameStarted = true;
            this.players = data.players;
            this.currentPlayer = data.currentPlayer;
            this.showGameRoom(); // Show the game room when game starts
            this.updateGameDisplay();
            this.addChatMessage('System', 'Game started!', false);
            this.showNotification('🎮 Game started! First player can choose Truth or Dare!', 'success', 5000);
            this.hideLoadingOverlay();
            this.setButtonLoading('startGameInRoomBtn', false);
            console.log('Game started with current player:', this.currentPlayer);
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
        const currentPage = document.querySelector('.page.active');
        const newPage = document.getElementById(pageId);
        
        if (currentPage && currentPage !== newPage) {
            // Add exit animation
            currentPage.classList.add('exiting');
            setTimeout(() => {
                currentPage.classList.remove('active', 'exiting');
                newPage.classList.add('active');
                this.currentPage = pageId;
            }, 300);
        } else {
            // Direct show for first page
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active', 'exiting');
            });
            newPage.classList.add('active');
            this.currentPage = pageId;
        }
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
        // Don't auto-create room - wait for user to enter name and click start
    }
    
    showJoinRoom() {
        this.showPage('joinRoomPage');
        this.isHost = false;
    }
    
    showGameRoom() {
        this.showPage('gameRoomPage');
        this.updateGameDisplay();
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
        const roomCodeInput = document.getElementById('roomCodeInput');
        const playerNameInput = document.getElementById('playerName');
        const roomCode = roomCodeInput.value.trim().toUpperCase();
        const playerName = playerNameInput.value.trim();
        
        console.log('Attempting to join room:', roomCode);
        console.log('Player name:', playerName);
        
        let hasError = false;
        
        if (!this.validateInput(roomCodeInput, 'roomCode')) {
            hasError = true;
        }
        
        if (!this.validateInput(playerNameInput, 'name')) {
            hasError = true;
        }
        
        if (hasError) {
            this.showNotification('Please check your inputs', 'error');
            return;
        }
        
        this.setButtonLoading('joinGameBtn', true);
        this.showLoadingOverlay('Joining room...');
        
        this.socket.emit('join-room', { roomCode, playerName });
    }
    
    startGame() {
        if (!this.roomCode) {
            this.showNotification('No room found', 'error');
            return;
        }
        
        this.setButtonLoading('startGameInRoomBtn', true);
        this.showLoadingOverlay('Starting game...');
        
        // Start the game in the existing room
        this.socket.emit('start-game', { roomCode: this.roomCode });
    }
    
    createRoom() {
        if (!this.playerName.trim()) {
            this.showNotification('Please enter your name', 'error');
            const nameInput = document.getElementById('hostName');
            if (nameInput) {
                this.validateInput(nameInput, 'name');
                nameInput.focus();
            }
            return;
        }
        
        this.setButtonLoading('startGameBtn', true);
        this.showLoadingOverlay('Creating room...');
        
        // Create the room with the player name
        this.socket.emit('create-room', { playerName: this.playerName });
    }
    
    copyRoomCode() {
        navigator.clipboard.writeText(this.roomCode).then(() => {
            const btn = document.getElementById('copyCodeBtn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.style.background = '#28a745';
            btn.style.transform = 'scale(1.1)';
            
            this.showNotification('Room code copied to clipboard!', 'success', 2000);
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '';
                btn.style.transform = '';
            }, 2000);
        }).catch(() => {
            this.showNotification('Failed to copy room code', 'error');
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
            
            // Add special classes for different player states
            if (player.isHost) {
                playerTag.classList.add('host');
            }
            if (this.currentPlayer && player.id === this.currentPlayer.id) {
                playerTag.classList.add('current');
            }
            
            playerTag.innerHTML = `
                <span>${player.name}</span>
                ${player.isHost ? '<i class="fas fa-crown" style="margin-left: 8px;"></i>' : ''}
                ${this.currentPlayer && player.id === this.currentPlayer.id ? '<i class="fas fa-star" style="margin-left: 8px;"></i>' : ''}
            `;
            
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
        // Update room code display
        const currentRoomCodeEl = document.getElementById('currentRoomCode');
        if (currentRoomCodeEl) {
            currentRoomCodeEl.textContent = this.roomCode;
        }
        
        // Update player count
        const playersCountEl = document.getElementById('playersCount');
        if (playersCountEl) {
            playersCountEl.textContent = this.players.length;
        }
        
        // Update current player name
        const currentPlayerNameEl = document.getElementById('currentPlayerName');
        if (currentPlayerNameEl) {
            if (this.gameStarted && this.currentPlayer) {
                currentPlayerNameEl.textContent = this.currentPlayer.name;
            } else if (this.isHost && !this.gameStarted) {
                currentPlayerNameEl.textContent = 'Waiting to start...';
            } else {
                currentPlayerNameEl.textContent = 'Waiting for host...';
            }
        }
        
        console.log("🔄 Updating display — Current player:", this.currentPlayer);
        
        // Update mini player list
        this.updateMiniPlayerList();
        
        // Show/hide start button based on host status and game state
        const startBtn = document.getElementById('startGameInRoomBtn');
        if (startBtn) {
            if (this.isHost && !this.gameStarted) {
                startBtn.style.display = 'block';
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-play"></i> Start Game';
            } else {
                startBtn.style.display = 'none';
            }
        }
        
        // Update card content based on game state
        const card = document.querySelector('.card');
        const cardType = document.getElementById('cardType');
        const cardQuestion = document.getElementById('cardQuestion');
        if (cardType && cardQuestion) {
            if (!this.gameStarted) {
                cardType.textContent = 'Waiting...';
                cardQuestion.textContent = this.isHost ? 'Click "Start Game" when ready!' : 'Waiting for host to start the game...';
                if (card) card.classList.add('waiting');
            } else {
                if (card) card.classList.remove('waiting');
                if (!this.currentPlayer) {
                    cardType.textContent = 'Truth or Dare';
                    cardQuestion.textContent = 'Choose your challenge!';
                }
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
            this.vibrate([100, 50, 100]);
            return;
        }
        this.playSound(523, 200); // C5 note
        this.vibrate([50]);
        this.socket.emit('select-challenge', { roomCode: this.roomCode, type: 'truth' });
    }
    
    selectDare() {
        console.log('Dare button clicked');
        console.log('Is current player:', this.isCurrentPlayer());
        console.log('Room code:', this.roomCode);
        console.log('Game started:', this.gameStarted);
        if (!this.isCurrentPlayer()) {
            console.log('Not current player, cannot select dare');
            this.vibrate([100, 50, 100]);
            return;
        }
        this.playSound(659, 200); // E5 note
        this.vibrate([50]);
        this.socket.emit('select-challenge', { roomCode: this.roomCode, type: 'dare' });
    }
    
    showCard(type, question, player) {
        const card = document.querySelector('.card');
        const cardType = document.getElementById('cardType');
        const cardQuestion = document.getElementById('cardQuestion');
        
        // Add card flip animation
        card.classList.add('flipping');
        
        setTimeout(() => {
            cardType.textContent = type;
            cardQuestion.textContent = question;
            card.classList.remove('flipping');
        }, 400);
        
        document.getElementById('nextPlayerBtn').disabled = !this.isCurrentPlayer();
        
        // Disable truth/dare buttons temporarily
        document.getElementById('truthBtn').disabled = true;
        document.getElementById('dareBtn').disabled = true;
        
        // Show notification for the challenge
        this.showNotification(`${player.name} chose ${type}!`, 'info', 3000);
        
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
    
    // Notification System
    createNotificationContainer() {
        if (!document.getElementById('notificationContainer')) {
            const container = document.createElement('div');
            container.id = 'notificationContainer';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 3000;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }
    }
    
    showNotification(message, type = 'info', duration = 4000) {
        const container = document.getElementById('notificationContainer');
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="notification-icon ${icons[type]}"></i>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        container.appendChild(notification);
        
        // Play sound and haptic feedback
        this.playNotificationSound(type);
        if (type === 'error') {
            this.vibrate([100, 50, 100]);
        } else if (type === 'success') {
            this.vibrate([50]);
        }
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto remove
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 400);
        }, duration);
    }
    
    showLoadingOverlay(text = 'Loading...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div style="text-align: center;">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">${text}</div>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        overlay.querySelector('.loading-text').textContent = text;
        overlay.classList.add('show');
    }
    
    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }
    }
    
    setButtonLoading(buttonId, loading = true) {
        const button = document.getElementById(buttonId);
        if (button) {
            if (loading) {
                button.classList.add('loading');
                button.disabled = true;
            } else {
                button.classList.remove('loading');
                button.disabled = false;
            }
        }
    }
    
    // Sound System
    initializeSounds() {
        // Create audio context for sound effects
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playSound(frequency = 440, duration = 200, type = 'sine') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);
    }
    
    playNotificationSound(type = 'success') {
        const sounds = {
            success: [523, 659, 784], // C5, E5, G5
            error: [200, 150, 100],   // Low descending
            info: [440, 554],         // A4, C#5
            warning: [330, 415]       // E4, G#4
        };
        
        const frequencies = sounds[type] || sounds.info;
        frequencies.forEach((freq, index) => {
            setTimeout(() => this.playSound(freq, 150), index * 100);
        });
    }
    
    // Haptic Feedback
    vibrate(pattern = [100]) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }
    
    // Enhanced Input Validation
    validateInput(input, type = 'text') {
        const value = input.value.trim();
        input.classList.remove('error');
        
        if (!value) {
            input.classList.add('error');
            this.vibrate([50, 50, 50]);
            return false;
        }
        
        if (type === 'roomCode' && value.length !== 6) {
            input.classList.add('error');
            this.vibrate([50, 50, 50]);
            return false;
        }
        
        if (type === 'name' && value.length < 2) {
            input.classList.add('error');
            this.vibrate([50, 50, 50]);
            return false;
        }
        
        return true;
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
        
        // Remove error states
        document.querySelectorAll('input').forEach(input => {
            input.classList.remove('error');
        });
        
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