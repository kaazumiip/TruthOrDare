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
        this.peerConnections = {};
        this.localStream = null;
        this.audioContext = null;
        
        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.loadQuestions();
        this.createNotificationContainer();
        this.initializeSounds();
        this.notifications = [];
        this.soundEnabled = true;
        this.unreadMessages = 0;
        this.chatBatchTimer = null;
        this.pendingChatMessages = [];
        this.isKhmerMode = false;
        this.checkLibraries();
        
        // Check for room parameter in URL for auto-join
        this.checkForRoomParameter();
        
        // QR code functionality is handled locally
    }
    
    checkLibraries() {
        console.log('Checking library availability...');
        console.log('jsQR available:', typeof jsQR !== 'undefined');
        console.log('QRCode available:', typeof QRCode !== 'undefined');
        
        if (typeof QRCode === 'undefined') {
            console.warn('QRCode library not loaded - QR generation will use fallback');
        }
        if (typeof jsQR === 'undefined') {
            console.warn('jsQR library not loaded - QR scanning will not work');
        }
    }
    
    // Batch notification system for chat
    addChatMessageToBatch(message, sender) {
        this.pendingChatMessages.push({ message, sender, timestamp: Date.now() });
        this.unreadMessages++;
        
        // Clear existing timer
        if (this.chatBatchTimer) {
            clearTimeout(this.chatBatchTimer);
        }
        
        // Set new timer for batch notification
        this.chatBatchTimer = setTimeout(() => {
            this.showBatchChatNotification();
        }, 2000); // 2 second delay for batching
        
        // Update unread indicator
        this.updateUnreadIndicator();
    }
    
    showBatchChatNotification() {
        if (this.pendingChatMessages.length === 0) return;
        
        const messageCount = this.pendingChatMessages.length;
        const latestMessage = this.pendingChatMessages[this.pendingChatMessages.length - 1];
        
        let notificationText;
        if (messageCount === 1) {
            notificationText = `${latestMessage.sender}: ${latestMessage.message}`;
        } else {
            notificationText = `${messageCount} new messages from ${latestMessage.sender} and others`;
        }
        
        // Show batch notification
        this.showNotification(notificationText, 'info');
        
        // Play sound for batch
        this.playNotificationSound('info');
        
        // Clear pending messages
        this.pendingChatMessages = [];
        this.unreadMessages = 0;
        this.updateUnreadIndicator();
    }
    
    updateUnreadIndicator() {
        const chatButton = document.getElementById('chatToggleBtn');
        const chatIcon = chatButton?.querySelector('i');
        
        if (chatButton && chatIcon) {
            if (this.unreadMessages > 0) {
                // Add unread indicator
                chatButton.classList.add('has-unread');
                chatIcon.classList.remove('fa-comments');
                chatIcon.classList.add('fa-comment-dots');
                
                // Add badge with count
                let badge = chatButton.querySelector('.unread-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'unread-badge';
                    badge.style.cssText = `
                        position: absolute;
                        top: -5px;
                        right: -5px;
                        background: #ff4757;
                        color: white;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        font-size: 12px;
                        font-weight: bold;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10;
                        animation: pulse 1s infinite;
                    `;
                    chatButton.appendChild(badge);
                }
                badge.textContent = this.unreadMessages > 99 ? '99+' : this.unreadMessages;
                
                // Update chat button text with language support (preserve badge)
                const chatText = this.isKhmerMode ? 'ជជែក' : 'Chat';
                const icon = chatButton.querySelector('i');
                if (icon) {
                    icon.className = 'fa-comment-dots';
                }
                const textSpan = chatButton.querySelector('.chat-text');
                if (textSpan) {
                    textSpan.textContent = chatText;
                } else {
                    const newTextSpan = document.createElement('span');
                    newTextSpan.className = 'chat-text';
                    newTextSpan.textContent = chatText;
                    chatButton.appendChild(newTextSpan);
                }
            } else {
                // Remove unread indicator
                chatButton.classList.remove('has-unread');
                chatIcon.classList.remove('fa-comment-dots');
                chatIcon.classList.add('fa-comments');
                
                const badge = chatButton.querySelector('.unread-badge');
                if (badge) {
                    badge.remove();
                }
                
                // Update chat button text with language support (preserve structure)
                const chatText = this.isKhmerMode ? 'ជជែក' : 'Chat';
                const icon = chatButton.querySelector('i');
                if (icon) {
                    icon.className = 'fa-comments';
                }
                const textSpan = chatButton.querySelector('.chat-text');
                if (textSpan) {
                    textSpan.textContent = chatText;
                } else {
                    const newTextSpan = document.createElement('span');
                    newTextSpan.className = 'chat-text';
                    newTextSpan.textContent = chatText;
                    chatButton.appendChild(newTextSpan);
                }
            }
        }
    }
    
    clearUnreadMessages() {
        this.unreadMessages = 0;
        this.pendingChatMessages = [];
        this.updateUnreadIndicator();
        
        // Clear any pending batch timer
        if (this.chatBatchTimer) {
            clearTimeout(this.chatBatchTimer);
            this.chatBatchTimer = null;
        }
        
        console.log('Unread messages cleared - user has interacted with chat');
    }
    
    // Check if chat panel is actually visible to user
    isChatPanelVisible() {
        const chatPanel = document.getElementById('chatPanel');
        return chatPanel && !chatPanel.classList.contains('hidden') && 
               chatPanel.offsetWidth > 0 && chatPanel.offsetHeight > 0;
    }
    
    // Test function to manually trigger badge indicator
    testChatBadge() {
        this.unreadMessages = 3;
        this.updateUnreadIndicator();
        console.log('Chat badge test triggered - should show badge with count 3');
    }

    // Card flip functionality
    flipCard() {
        const gameCard = document.getElementById('gameCard');
        if (gameCard) {
            console.log('Flipping card...');
            gameCard.classList.toggle('flipped');
            
            // Hide the click hint after first flip
            const clickHint = gameCard.querySelector('.card-click-hint');
            if (clickHint) {
                clickHint.style.display = 'none';
            }
            
            // Debug: Check if card is flipped
            setTimeout(() => {
                console.log('Card flipped:', gameCard.classList.contains('flipped'));
                const cardBack = gameCard.querySelector('.card-back');
                if (cardBack) {
                    console.log('Card back content:', cardBack.textContent);
                }
            }, 100);
        }
    }
    
    // Khmer Translation System
    toggleLanguage() {
        this.isKhmerMode = !this.isKhmerMode;
        this.updateLanguageDisplay();
        this.translateInterface();
    }
    
    updateLanguageDisplay() {
        const languageText = document.getElementById('languageText');
        if (languageText) {
            languageText.textContent = this.isKhmerMode ? 'English' : 'ខ្មែរ';
        }
    }
    
    translateInterface() {
        const translations = {
            'Create Room': 'បង្កើតបន្ទប់',
            'Join Room': 'ចូលបន្ទប់',
            'Host Game': 'ចាប់ផ្តើមហ្គេម',
            'Join Game': 'ចូលហ្គេម',
            'With Code': 'ដោយកូដ',
            'Scan QR Code': 'ស្កេន QR Code',
            'Enter Room Code': 'បញ្ចូលកូដបន្ទប់',
            'Enter Your Name': 'បញ្ចូលឈ្មោះរបស់អ្នក',
            'Start Game': 'ចាប់ផ្តើមហ្គេម',
            'Truth': 'ការពិត',
            'Dare': 'ហ៊ាន',
            'Next Player': 'អ្នកលេងបន្ទាប់',
            'Chat': 'ជជែក',
            'Voice': 'សម្លេង',
            'Mute': 'បិទសម្លេង',
            'Unmute': 'បើកសម្លេង',
            'Players': 'អ្នកលេង',
            'Room Code': 'កូដបន្ទប់',
            'Share Room': 'ចែករំលែកបន្ទប់',
            'Download QR': 'ទាញយក QR',
            'Close': 'បិទ',
            'Add Truth Question': 'បន្ថែមសំណួរការពិត',
            'Add Dare Question': 'បន្ថែមសំណួរហ៊ាន',
            'Manage Questions': 'គ្រប់គ្រងសំណួរ',
            'Question Settings': 'ការកំណត់សំណួរ',
            'Truth Questions': 'សំណួរការពិត',
            'Dare Questions': 'សំណួរហ៊ាន',
            'Total Questions': 'សំណួរសរុប',
            'Add New Truth Question': 'បន្ថែមសំណួរការពិតថ្មី',
            'Add New Dare Question': 'បន្ថែមសំណួរហ៊ានថ្មី',
            'Current Truth Questions': 'សំណួរការពិតបច្ចុប្បន្ន',
            'Current Dare Questions': 'សំណួរហ៊ានបច្ចុប្បន្ន',
            'Clear All': 'លុបទាំងអស់',
            'Import': 'នាំចូល',
            'Export Questions': 'នាំចេញសំណួរ',
            'Reset to Default': 'កំណត់ឡើងវិញ',
            'Done': 'រួចរាល់',
            'Edit question': 'កែសំណួរ',
            'Remove question': 'លុបសំណួរ',
            'No truth questions yet': 'មិនទាន់មានសំណួរការពិត',
            'No dare questions yet': 'មិនទាន់មានសំណួរហ៊ាន',
            'Add your first truth question above to get started!': 'បន្ថែមសំណួរការពិតដំបូងរបស់អ្នកខាងលើដើម្បីចាប់ផ្តើម!',
            'Add your first dare question above to get started!': 'បន្ថែមសំណួរហ៊ានដំបូងរបស់អ្នកខាងលើដើម្បីចាប់ផ្តើម!'
        };
        
        if (this.isKhmerMode) {
            // Translate to Khmer
            Object.keys(translations).forEach(english => {
                const elements = document.querySelectorAll(`*:not(script):not(style)`);
                elements.forEach(element => {
                    if (element.children.length === 0 && element.textContent.trim() === english) {
                        element.textContent = translations[english];
                    }
                });
            });
        } else {
            // Translate back to English
            Object.entries(translations).forEach(([english, khmer]) => {
                const elements = document.querySelectorAll(`*:not(script):not(style)`);
                elements.forEach(element => {
                    if (element.children.length === 0 && element.textContent.trim() === khmer) {
                        element.textContent = english;
                    }
                });
            });
        }
        
        // Update chat button with current language
        this.updateUnreadIndicator();
    }
    
    initializeEventListeners() {
        // Landing page buttons
        document.getElementById('createRoomBtn').addEventListener('click', () => this.showCreateRoom());
        document.getElementById('joinRoomBtn').addEventListener('click', () => this.showJoinRoom());
        
        // Create room page
        document.getElementById('createRoomSubmitBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyRoomCode());
        document.getElementById('shareRoomBtn').addEventListener('click', () => this.shareRoom());
        document.getElementById('qrCodeBtn').addEventListener('click', () => this.showQRCode());
        document.getElementById('testQRBtn').addEventListener('click', () => this.testQRCode());
        
        // Join by QR button
        document.getElementById('joinByQRBtn').addEventListener('click', () => this.showJoinByQR());
        document.getElementById('backToLandingBtn3').addEventListener('click', () => this.showLanding());
        document.getElementById('startQRScannerBtn').addEventListener('click', () => this.startQRScanner());
        document.getElementById('stopQRScannerBtn').addEventListener('click', () => this.stopQRScanner());
        document.getElementById('joinWithManualCodeBtn').addEventListener('click', () => this.joinWithManualCode());
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
        
        // Enhanced Question management
        document.getElementById('closeQuestionModal').addEventListener('click', () => this.hideQuestionModal());
        document.getElementById('closeQuestionModalFooter').addEventListener('click', () => this.hideQuestionModal());
        document.getElementById('addTruthBtn').addEventListener('click', () => this.addQuestion('truth'));
        document.getElementById('addDareBtn').addEventListener('click', () => this.addQuestion('dare'));
        
        // New question management features
        document.getElementById('clearTruthBtn').addEventListener('click', () => this.clearQuestions('truth'));
        document.getElementById('clearDareBtn').addEventListener('click', () => this.clearQuestions('dare'));
        document.getElementById('resetQuestionsBtn').addEventListener('click', () => this.resetToDefaultQuestions());
        document.getElementById('exportQuestionsBtn').addEventListener('click', () => this.exportQuestions());
        
        // Preview functionality
        document.getElementById('newTruthQuestion').addEventListener('input', (e) => this.previewQuestion(e.target.value, 'truth'));
        document.getElementById('newDareQuestion').addEventListener('input', (e) => this.previewQuestion(e.target.value, 'dare'));
        
        // Language toggle
        document.getElementById('languageToggle').addEventListener('click', () => this.toggleLanguage());
        
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
        
        // Clear unread messages when user interacts with chat
        document.getElementById('chatMessages').addEventListener('scroll', () => {
            if (this.isChatPanelVisible()) {
                this.clearUnreadMessages();
            }
        });
        
        // Clear unread messages when user focuses on chat input
        document.getElementById('chatInput').addEventListener('focus', () => {
            if (this.isChatPanelVisible()) {
                this.clearUnreadMessages();
            }
        });
        
        // Clear unread messages when user clicks on chat messages area
        document.getElementById('chatMessages').addEventListener('click', () => {
            if (this.isChatPanelVisible()) {
                this.clearUnreadMessages();
            }
        });
        
        // Clear unread messages when user types in chat input
        document.getElementById('chatInput').addEventListener('input', () => {
            if (this.isChatPanelVisible()) {
                this.clearUnreadMessages();
            }
        });
        
        // Clear unread messages when user sends a message
        document.getElementById('sendMessageBtn').addEventListener('click', () => {
            if (this.isChatPanelVisible()) {
                this.clearUnreadMessages();
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
            
            // Show the room created step
            document.getElementById('hostNameStep').style.display = 'none';
            document.getElementById('roomCreatedStep').style.display = 'block';
            
            // Update room code display
            document.getElementById('roomCode').textContent = data.roomCode;
            document.getElementById('currentRoomCode').textContent = data.roomCode;
            
            // Reset create button
            const createBtn = document.getElementById('createRoomSubmitBtn');
            createBtn.disabled = false;
            createBtn.innerHTML = '<i class="fas fa-plus"></i> Create Room';
            
            // Enable start game button
            const startBtn = document.getElementById('startGameBtn');
            if (startBtn) {
                startBtn.disabled = false;
            }
            
            this.showNotification('Room Created!', `Room code: ${data.roomCode}`, 'success');
            console.log("Room created with code: " + this.roomCode);
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
            
            // If voice is enabled, create connections with existing players
            if (this.voiceEnabled && this.localStream) {
                this.players.forEach(player => {
                    if (player.id !== this.socket.id) {
                        this.createPeerConnection(player.id);
                    }
                });
            }
            
            this.showGameRoom();
        });
        
        this.socket.on('player-joined', (data) => {
            this.players = data.players;
            this.updatePlayersList();
            this.updateGameDisplay();
            this.addChatMessage('System', `${data.player.name} joined the game!`, false);
            this.showNotification('Player Joined', `${data.player.name} joined the room!`, 'player-join');
            
            // If voice is enabled, create connection with new player
            if (this.voiceEnabled && this.localStream) {
                this.createPeerConnection(data.player.id);
            }
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
            
            // Reset start button
            const startBtn = document.getElementById('startGameBtn');
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-play"></i> Start Game';
            }
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
            if (data.player !== this.playerName) {
                // Use batch notification system instead of individual notifications
                this.addChatMessageToBatch(data.message, data.player);
            }
        });
        
        // Voice events
        this.socket.on('voice-status', (data) => {
            if (data.player !== this.playerName) {
                this.updateVoiceStatus(data.player, data.enabled);
            }
        });
        
        // WebRTC signaling events
        this.socket.on('webrtc-offer', async (data) => {
            await this.handleOffer(data);
        });
        
        this.socket.on('webrtc-answer', async (data) => {
            await this.handleAnswer(data);
        });
        
        this.socket.on('webrtc-ice-candidate', async (data) => {
            await this.handleIceCandidate(data);
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
        
        // Reset the form steps
        document.getElementById('hostNameStep').style.display = 'block';
        document.getElementById('roomCreatedStep').style.display = 'none';
        
        // Clear previous data
        document.getElementById('hostName').value = '';
        document.getElementById('roomCode').textContent = '----';
        document.getElementById('startGameBtn').disabled = true;
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
            this.showNotification('Name Required', 'Please enter your name to create a room', 'error');
            return;
        }
        
        this.playerName = playerName;
        this.socket.emit('create-room', { playerName });
        
        // Show loading state
        const createBtn = document.getElementById('createRoomSubmitBtn');
        createBtn.disabled = true;
        createBtn.innerHTML = '<div class="loading-spinner"></div> Creating Room...';
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
        
        if (!this.isHost) {
            this.showNotification('Only the host can start the game', 'error');
            return;
        }
        
        // Show loading state
        const startBtn = document.getElementById('startGameBtn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<div class="loading-spinner"></div> Starting Game...';
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
    
    shareRoom() {
        const roomCode = document.getElementById('roomCode').textContent;
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
        
        if (navigator.share) {
            // Use native share API if available
            navigator.share({
                title: 'Join my Truth or Dare game!',
                text: `Join my Truth or Dare game! Room code: ${roomCode}`,
                url: shareUrl
            }).then(() => {
                this.showNotification('Room shared!', 'success');
            }).catch((error) => {
                console.log('Share cancelled or failed:', error);
                this.fallbackShare(shareUrl, roomCode);
            });
        } else {
            // Fallback for browsers without native share
            this.fallbackShare(shareUrl, roomCode);
        }
    }
    
    fallbackShare(shareUrl, roomCode) {
        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            this.showNotification('Share link copied to clipboard!', 'success');
        }).catch(() => {
            // Show share options
            this.showShareOptions(shareUrl, roomCode);
        });
    }
    
    showShareOptions(shareUrl, roomCode) {
        const shareText = `Join my Truth or Dare game!\nRoom code: ${roomCode}\nLink: ${shareUrl}`;
        
        // Create a modal with share options
        const modal = document.createElement('div');
        modal.className = 'share-modal';
        modal.innerHTML = `
            <div class="share-modal-content">
                <h3>Share Room</h3>
                <p>Room Code: <strong>${roomCode}</strong></p>
                <div class="share-options">
                    <button onclick="navigator.clipboard.writeText('${shareUrl}')" class="btn-share-option">
                        <i class="fas fa-link"></i> Copy Link
                    </button>
                    <button onclick="navigator.clipboard.writeText('${roomCode}')" class="btn-share-option">
                        <i class="fas fa-copy"></i> Copy Code
                    </button>
                    <button onclick="navigator.clipboard.writeText('${shareText}')" class="btn-share-option">
                        <i class="fas fa-share"></i> Copy All
                    </button>
                </div>
                <button onclick="this.closest('.share-modal').remove()" class="btn-close">Close</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    showQRCode() {
        const roomCode = document.getElementById('roomCode').textContent;
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
        
        console.log('Generating QR code for:', shareUrl);
        this.showStandardQRCode(shareUrl, roomCode);
    }
    
    downloadQRCode(canvas, roomCode) {
        const link = document.createElement('a');
        link.download = `truth-or-dare-room-${roomCode}.png`;
        link.href = canvas.toDataURL();
        link.click();
        this.showNotification('QR code downloaded!', 'success');
    }
    
    checkForRoomParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        
        if (roomCode) {
            // Auto-navigate to join room page with pre-filled room code
            this.showJoinRoom();
            document.getElementById('roomCodeInput').value = roomCode;
            this.showNotification('Room code detected!', 'Enter your name to join the room.', 'info');
        }
    }
    
    
    testQRCode() {
        console.log('Testing standard QR code generation...');
        this.showNotification('Using standard QR code generator', 'info');
        this.showStandardQRCode('https://example.com', 'TEST');
    }
    
    showTextQRCode(shareUrl, roomCode) {
        console.log('Using text-based QR code fallback');
        
        // Create QR code modal with text fallback
        const modal = document.createElement('div');
        modal.className = 'qr-modal';
        modal.innerHTML = `
            <div class="qr-modal-content">
                <h3>Room QR Code (Text Fallback)</h3>
                <p>QR code library not available. Here's the room information:</p>
                <div class="qr-container" style="text-align: center; padding: 20px; background: #f0f0f0; border-radius: 10px;">
                    <div style="font-size: 24px; font-weight: bold; color: #333; margin-bottom: 10px;">
                        Room Code: ${roomCode}
                    </div>
                    <div style="font-size: 14px; color: #666; word-break: break-all; margin-bottom: 20px;">
                        URL: ${shareUrl}
                    </div>
                    <div style="font-size: 16px; color: #333;">
                        Share this room code with friends to join!
                    </div>
                </div>
                <p class="qr-room-code">Room Code: <strong>${roomCode}</strong></p>
                <p class="qr-url">URL: <code>${shareUrl}</code></p>
                <div class="qr-actions">
                    <button onclick="navigator.clipboard.writeText('${shareUrl}').then(() => alert('URL copied!'))" class="btn-download">
                        <i class="fas fa-copy"></i> Copy URL
                    </button>
                    <button onclick="this.closest('.qr-modal').remove()" class="btn-close">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.showNotification('Using text fallback for QR code', 'info');
    }
    
    showSimpleQRCode(url, title) {
        // Create a simple visual QR code representation
        const modal = document.createElement('div');
        modal.className = 'qr-modal';
        modal.innerHTML = `
            <div class="qr-modal-content">
                <h3>Simple QR Code: ${title}</h3>
                <p>This is a simple visual representation:</p>
                <div class="qr-container" style="text-align: center; padding: 20px; background: #f0f0f0; border-radius: 10px;">
                    <div style="font-size: 20px; font-weight: bold; color: #333; margin-bottom: 10px;">
                        ${title}
                    </div>
                    <div style="font-size: 12px; color: #666; word-break: break-all;">
                        ${url}
                    </div>
                </div>
                <div class="qr-actions">
                    <button onclick="navigator.clipboard.writeText('${url}').then(() => alert('URL copied!'))" class="btn-download">
                        <i class="fas fa-copy"></i> Copy URL
                    </button>
                    <button onclick="this.closest('.qr-modal').remove()" class="btn-close">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    showStandardQRCode(shareUrl, roomCode) {
        console.log('Creating standard QR code...');
        
        // Check if QRCode library is available
        if (typeof QRCode === 'undefined') {
            console.error('QRCode library not loaded, using fallback');
            this.showNotification('Using fallback QR code generator', 'warning');
            this.showLocalQRCode(shareUrl, roomCode);
            return;
        }
        
        // Create QR code modal
        const modal = document.createElement('div');
        modal.className = 'qr-modal';
        modal.innerHTML = `
            <div class="qr-modal-content">
                <h3>Room QR Code</h3>
                <p>Scan this QR code to join the room:</p>
                <div class="qr-container">
                    <canvas id="standardQrCanvas" width="256" height="256"></canvas>
                </div>
                <p class="qr-room-code">Room Code: <strong>${roomCode}</strong></p>
                <p class="qr-url">URL: <code>${shareUrl}</code></p>
                <div class="qr-actions">
                    <button id="downloadStandardQRBtn" class="btn-download">
                        <i class="fas fa-download"></i> Download QR
                    </button>
                    <button onclick="this.closest('.qr-modal').remove()" class="btn-close">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Generate standard QR code
        this.generateStandardQRCode(shareUrl, roomCode);
        
        // Add download functionality
        document.getElementById('downloadStandardQRBtn').addEventListener('click', () => {
            const canvas = document.getElementById('standardQrCanvas');
            this.downloadQRCode(canvas, roomCode);
        });
    }
    
    generateStandardQRCode(url, roomCode) {
        const canvas = document.getElementById('standardQrCanvas');
        if (!canvas) return;
        
        console.log('Generating standard QR code for:', url);
        console.log('QRCode library available:', typeof QRCode !== 'undefined');
        
        // Check if QRCode library is loaded
        if (typeof QRCode === 'undefined') {
            console.error('QRCode library not loaded');
            this.showNotification('QR code library not loaded. Please refresh the page.', 'error');
            this.showTextQRCode(url, roomCode);
            return;
        }
        
        try {
            // Use the QRCode library to generate a proper QR code
            QRCode.toCanvas(canvas, url, {
                width: 256,
                height: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) {
                    console.error('QR code generation error:', error);
                    this.showNotification('Failed to generate QR code. Using text fallback.', 'warning');
                    this.showTextQRCode(url, roomCode);
                } else {
                    console.log('Standard QR code generated successfully');
                    this.showNotification('QR code generated!', 'success');
                }
            });
        } catch (error) {
            console.error('QR code generation error:', error);
            this.showNotification('Failed to generate QR code. Using text fallback.', 'warning');
            this.showTextQRCode(url, roomCode);
        }
    }
    
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
    
    generateLocalQRCode(url, roomCode) {
        const canvas = document.getElementById('localQrCanvas');
        if (!canvas) return;
        
        console.log('Generating local QR code for:', url);
        
        // Create a simple but effective QR-like pattern
        const ctx = canvas.getContext('2d');
        const size = 256;
        const margin = 20;
        const qrSize = size - (margin * 2);
        const cellSize = 4;
        const cells = Math.floor(qrSize / cellSize);
        
        // Clear canvas with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        
        // Create a deterministic pattern based on the URL
        const pattern = this.createStandardQRPattern(url, cells);
        
        // Draw the QR pattern
        ctx.fillStyle = '#000000';
        for (let y = 0; y < cells; y++) {
            for (let x = 0; x < cells; x++) {
                if (pattern[y] && pattern[y][x]) {
                    const pixelX = margin + (x * cellSize);
                    const pixelY = margin + (y * cellSize);
                    ctx.fillRect(pixelX, pixelY, cellSize, cellSize);
                }
            }
        }
        
        // Add room code text at the bottom
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(roomCode, size / 2, size - 8);
        
        console.log('Local QR code generated successfully');
        this.showNotification('Local QR code generated!', 'success');
    }
    
    createStandardQRPattern(url, size) {
        // Create a more standard QR-like pattern
        const pattern = [];
        const hash = this.simpleHash(url);
        
        // Initialize pattern
        for (let y = 0; y < size; y++) {
            pattern[y] = [];
            for (let x = 0; x < size; x++) {
                pattern[y][x] = false;
            }
        }
        
        // Add corner markers (like real QR codes)
        const markerSize = 7;
        this.addMarker(pattern, 0, 0, markerSize, size);
        this.addMarker(pattern, size - markerSize, 0, markerSize, size);
        this.addMarker(pattern, 0, size - markerSize, markerSize, size);
        
        // Add timing patterns
        for (let i = 8; i < size - 8; i++) {
            if (i % 2 === 0) {
                pattern[6][i] = true;
                pattern[i][6] = true;
            }
        }
        
        // Add data pattern based on URL hash
        let hashIndex = 0;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Skip markers and timing patterns
                if (this.isInMarker(x, y, size, markerSize) || 
                    (y === 6 || x === 6)) {
                    continue;
                }
                
                // Use hash to determine pattern
                const hashValue = (hash + hashIndex) % 256;
                pattern[y][x] = hashValue > 128;
                hashIndex++;
            }
        }
        
        return pattern;
    }
    
    addMarker(pattern, startX, startY, markerSize, totalSize) {
        if (startX + markerSize > totalSize || startY + markerSize > totalSize) return;
        
        // Outer square
        for (let y = startY; y < startY + markerSize; y++) {
            for (let x = startX; x < startX + markerSize; x++) {
                if (x === startX || x === startX + markerSize - 1 || 
                    y === startY || y === startY + markerSize - 1) {
                    pattern[y][x] = true;
                }
            }
        }
        
        // Inner square
        const innerStart = startX + 2;
        const innerEnd = startX + markerSize - 2;
        for (let y = startY + 2; y < startY + markerSize - 2; y++) {
            for (let x = innerStart; x < innerEnd; x++) {
                pattern[y][x] = true;
            }
        }
    }
    
    createQRPattern(hash, size) {
        const pattern = [];
        const seed = hash;
        
        // Initialize pattern
        for (let y = 0; y < size; y++) {
            pattern[y] = [];
            for (let x = 0; x < size; x++) {
                pattern[y][x] = false;
            }
        }
        
        // Add corner markers (like real QR codes)
        const markerSize = 7;
        
        // Top-left marker
        for (let y = 0; y < markerSize; y++) {
            for (let x = 0; x < markerSize; x++) {
                if (y < markerSize - 1 && x < markerSize - 1) {
                    pattern[y][x] = true;
                }
            }
        }
        
        // Top-right marker
        for (let y = 0; y < markerSize; y++) {
            for (let x = size - markerSize; x < size; x++) {
                if (y < markerSize - 1 && x >= size - markerSize) {
                    pattern[y][x] = true;
                }
            }
        }
        
        // Bottom-left marker
        for (let y = size - markerSize; y < size; y++) {
            for (let x = 0; x < markerSize; x++) {
                if (y >= size - markerSize && x < markerSize - 1) {
                    pattern[y][x] = true;
                }
            }
        }
        
        // Fill the rest with a pseudo-random pattern based on hash
        let currentHash = seed;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Skip marker areas
                if (this.isInMarker(x, y, size, markerSize)) continue;
                
                // Generate pseudo-random value
                currentHash = (currentHash * 1103515245 + 12345) & 0x7fffffff;
                pattern[y][x] = (currentHash % 3) === 0;
            }
        }
        
        return pattern;
    }
    
    isInMarker(x, y, size, markerSize) {
        // Top-left
        if (x < markerSize && y < markerSize) return true;
        // Top-right
        if (x >= size - markerSize && y < markerSize) return true;
        // Bottom-left
        if (x < markerSize && y >= size - markerSize) return true;
        return false;
    }
    
    updateHostName(name) {
        this.playerName = name;
        const startBtn = document.getElementById('startGameBtn');
        startBtn.disabled = !name.trim();
    }
    
    // QR Scanner functionality
    showJoinByQR() {
        this.showPage('joinByQRPage');
        this.initializeDragAndDrop();
    }
    
    initializeDragAndDrop() {
        const dropZone = document.getElementById('qrDropZone');
        const dropOverlay = document.getElementById('qrDropOverlay');
        const placeholder = document.getElementById('qrPlaceholder');
        
        if (!dropZone) return;
        
        // Prevent duplicate initialization
        if (dropZone.hasAttribute('data-initialized')) return;
        dropZone.setAttribute('data-initialized', 'true');
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });
        
        // Highlight drop zone when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
                dropOverlay.style.display = 'flex';
                placeholder.style.display = 'none';
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
                dropOverlay.style.display = 'none';
                placeholder.style.display = 'block';
            }, false);
        });
        
        // Handle dropped files
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                this.handleDroppedFile(files[0]);
            }
        }, false);
    }
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    handleDroppedFile(file) {
        console.log('File dropped:', file.name, file.type);
        
        // Check if it's an image file
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please drop an image file (PNG, JPG, etc.)', 'error');
            return;
        }
        
        // Show loading state
        this.showNotification('Processing QR code image...', 'info');
        
        // Read the file and process it
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            this.processQRImage(imageData);
        };
        reader.readAsDataURL(file);
    }
    
    processQRImage(imageData) {
        // Create an image element to process the QR code
        const img = new Image();
        img.onload = () => {
            this.readQRFromImage(img);
        };
        img.src = imageData;
    }
    
    readQRFromImage(img) {
        console.log('Processing image for QR code:', img.width, 'x', img.height);
        
        // Check if jsQR is available
        if (typeof jsQR === 'undefined') {
            console.error('jsQR library not loaded');
            this.showNotification('QR code library not loaded. Please refresh the page.', 'error');
            return;
        }
        
        // Create a canvas to process the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw the image to canvas
        ctx.drawImage(img, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        console.log('Image data extracted:', imageData.width, 'x', imageData.height);
        
        try {
            // Use jsQR to decode the QR code
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
                console.log('QR Code detected:', code.data);
                this.handleQRCodeDetected(code.data);
            } else {
                console.log('No QR code found in image');
                this.showNotification('No QR code found in the uploaded image. You can enter the room code manually below.', 'warning');
                
                // Show manual entry option
                this.showManualEntryOption();
            }
        } catch (error) {
            console.error('Error processing QR code:', error);
            this.showNotification('Error processing QR code. Please try a different image.', 'error');
        }
    }
    
    showManualEntryOption() {
        // Highlight the manual entry section
        const manualEntry = document.querySelector('.qr-manual-entry');
        if (manualEntry) {
            manualEntry.style.border = '2px solid #ffc107';
            manualEntry.style.backgroundColor = '#fff3cd';
            manualEntry.style.borderRadius = '10px';
            manualEntry.style.padding = '1rem';
            manualEntry.style.marginTop = '1rem';
            
            // Add a helpful message
            const helpText = document.createElement('div');
            helpText.innerHTML = '<p style="color: #856404; margin: 0; font-size: 0.9rem;"><i class="fas fa-info-circle"></i> QR code not detected. Please enter the room code manually.</p>';
            manualEntry.insertBefore(helpText, manualEntry.firstChild);
        }
    }
    
    handleQRCodeDetected(qrData) {
        console.log('QR Code data:', qrData);
        
        // Try to extract room code from the QR data
        let roomCode = null;
        
        // Check if it's a URL with room parameter
        if (qrData.includes('?room=')) {
            const url = new URL(qrData);
            roomCode = url.searchParams.get('room');
        } else if (qrData.length === 6 && /^[A-Z0-9]+$/.test(qrData)) {
            // Direct room code
            roomCode = qrData;
        } else {
            // Try to extract 6-character room code from the string
            const match = qrData.match(/[A-Z0-9]{6}/);
            if (match) {
                roomCode = match[0];
            }
        }
        
        if (roomCode) {
            this.showNotification(`QR Code detected: ${roomCode}`, 'success');
            
            // Auto-fill the manual input
            document.getElementById('manualRoomCodeInput').value = roomCode;
            
            // Update the scanner area to show success
            this.updateScannerSuccess(roomCode);
        } else {
            this.showNotification('Could not extract room code from QR code', 'error');
            console.log('QR data that could not be parsed:', qrData);
        }
    }
    
    generateRandomRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    updateScannerSuccess(roomCode) {
        const placeholder = document.getElementById('qrPlaceholder');
        placeholder.innerHTML = `
            <div class="qr-scanner-icon" style="color: #28a745;">
                <i class="fas fa-check-circle"></i>
            </div>
            <p class="qr-scanner-text" style="color: #28a745;">QR Code Detected!</p>
            <p class="qr-scanner-subtext">Room Code: <strong>${roomCode}</strong></p>
        `;
    }
    
    startQRScanner() {
        console.log('Starting QR scanner...');
        
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showNotification('Camera access not supported on this device', 'error');
            return;
        }
        
        // Request camera access
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(stream => {
                console.log('Camera access granted');
                this.showNotification('Camera access granted! Point at a QR code', 'success');
                
                // Update UI
                document.getElementById('startQRScannerBtn').style.display = 'none';
                document.getElementById('stopQRScannerBtn').style.display = 'inline-block';
                
                // Store stream for cleanup
                this.cameraStream = stream;
                
                // For now, we'll simulate QR code detection
                // In a real implementation, you'd use a QR code library like jsQR
                this.simulateQRDetection();
            })
            .catch(error => {
                console.error('Camera access denied:', error);
                this.showNotification('Camera access denied. Please allow camera permission.', 'error');
            });
    }
    
    stopQRScanner() {
        console.log('Stopping QR scanner...');
        
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        
        // Update UI
        document.getElementById('startQRScannerBtn').style.display = 'inline-block';
        document.getElementById('stopQRScannerBtn').style.display = 'none';
        
        this.showNotification('QR scanner stopped', 'info');
    }
    
    simulateQRDetection() {
        // For now, we'll simulate QR detection since we don't have a video stream setup
        // In a real implementation, you'd process the video stream frame by frame
        setTimeout(() => {
            // This is just a demo - in reality you'd process video frames
            console.log('Camera QR scanner is active - point at a QR code');
            this.showNotification('Camera active - point at QR code', 'info');
            
            // For demo purposes, we'll simulate detection after 5 seconds
            setTimeout(() => {
                const simulatedRoomCode = 'DEMO123';
                this.showNotification(`QR Code detected: ${simulatedRoomCode}`, 'success');
                document.getElementById('manualRoomCodeInput').value = simulatedRoomCode;
                this.updateScannerSuccess(simulatedRoomCode);
                this.stopQRScanner();
            }, 5000);
        }, 1000);
    }
    
    joinWithManualCode() {
        const roomCode = document.getElementById('manualRoomCodeInput').value.trim().toUpperCase();
        const playerName = document.getElementById('qrPlayerName').value.trim();
        
        if (!roomCode || roomCode.length !== 6) {
            this.showNotification('Please enter a valid 6-digit room code', 'error');
            return;
        }
        
        if (!playerName) {
            this.showNotification('Please enter your name', 'error');
            return;
        }
        
        // Use the existing join room functionality
        this.playerName = playerName;
        this.joinGameWithCode(roomCode);
    }
    
    joinGameWithCode(roomCode) {
        console.log('Attempting to join room:', roomCode);
        console.log('Player name:', this.playerName);
        
        if (!roomCode || roomCode.length !== 6) {
            this.showNotification('Please enter a valid 6-digit room code', 'error');
            return;
        }
        
        if (!this.playerName) {
            this.showNotification('Please enter your name', 'error');
            return;
        }
        
        this.setButtonLoading('joinWithManualCodeBtn', true);
        this.showLoadingOverlay('Joining room...');
        
        this.socket.emit('join-room', { roomCode, playerName: this.playerName });
    }
    
    updatePlayersList() {
        const playersList = document.getElementById('playersListMini');
        if (!playersList) return;
        
        playersList.innerHTML = '';
        this.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            
            // Add special classes for different player states
            if (player.isHost) {
                playerItem.classList.add('host');
            }
            
            // Get first letter of name for avatar
            const avatarLetter = player.name.charAt(0).toUpperCase();
            
            // Determine status
            let statusClass = 'status-indicator';
            let statusText = 'Online';
            if (this.currentPlayer && player.id === this.currentPlayer.id) {
                statusClass += ' speaking';
                statusText = 'Speaking';
            } else if (this.voiceEnabled) {
                statusClass += '';
                statusText = 'Voice enabled';
            } else {
                statusClass += ' muted';
                statusText = 'Muted';
            }
            
            playerItem.innerHTML = `
                <div class="player-avatar ${player.isHost ? 'host' : ''}">
                    ${avatarLetter}
                    ${player.isHost ? '<div class="host-crown">👑</div>' : ''}
                </div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-status">
                        <div class="${statusClass}"></div>
                        ${statusText}
                    </div>
                </div>
            `;
            playersList.appendChild(playerItem);
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
        
        // Show/hide challenge selection based on current player
        const challengeSelection = document.getElementById('challengeSelection');
        if (challengeSelection) {
            if (this.gameStarted && this.isCurrentPlayer()) {
                challengeSelection.style.display = 'block';
            } else {
                challengeSelection.style.display = 'none';
            }
        }
        
        // Update game status text
        const gameStatusText = document.getElementById('gameStatusText');
        if (gameStatusText) {
            if (this.gameStarted) {
                gameStatusText.textContent = this.isCurrentPlayer() ? 
                    'It\'s your turn! Choose Truth or Dare.' : 
                    `Waiting for ${this.currentPlayer ? this.currentPlayer.name : 'player'} to choose...`;
            } else {
                gameStatusText.textContent = 'Waiting for game to start...';
            }
        }
        
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
        console.log('Showing card:', type, question, player);
        
        // Hide challenge selection
        const challengeSelection = document.getElementById('challengeSelection');
        if (challengeSelection) {
            challengeSelection.style.display = 'none';
        }
        
        // Show game card
        const gameCardContainer = document.getElementById('gameCardContainer');
        const cardTypeBadge = document.getElementById('cardTypeBadge');
        const cardPlayerName = document.getElementById('cardPlayerName');
        const cardQuestion = document.getElementById('cardQuestion');
        
        // Back side elements
        const cardTypeBadgeBack = document.getElementById('cardTypeBadgeBack');
        const cardPlayerNameBack = document.getElementById('cardPlayerNameBack');
        const cardQuestionBack = document.getElementById('cardQuestionBack');
        
        if (gameCardContainer) {
            gameCardContainer.style.display = 'block';
        }
        
        // Update front side
        if (cardTypeBadge) {
            cardTypeBadge.textContent = type.toUpperCase();
            cardTypeBadge.className = `card-type-badge ${type.toLowerCase()}`;
        }
        
        if (cardPlayerName) {
            cardPlayerName.textContent = player.name;
        }
        
        if (cardQuestion) {
            cardQuestion.textContent = question;
        }
        
        // Update back side
        if (cardTypeBadgeBack) {
            cardTypeBadgeBack.textContent = type.toUpperCase();
            cardTypeBadgeBack.className = `card-type-badge ${type.toLowerCase()}`;
        }
        
        if (cardPlayerNameBack) {
            cardPlayerNameBack.textContent = player.name;
        }
        
        if (cardQuestionBack) {
            cardQuestionBack.textContent = question;
        }
        
        // Update card back class for styling
        const cardBack = document.getElementById('cardBack');
        if (cardBack) {
            cardBack.className = `card-back ${type.toLowerCase()}`;
        }
        
        // Reset card flip state and show click hint
        const gameCard = document.getElementById('gameCard');
        if (gameCard) {
            gameCard.classList.remove('flipped');
            gameCard.classList.add('flipping');
            setTimeout(() => {
                gameCard.classList.remove('flipping');
            }, 600);
            
            // Show click hint again
            const clickHint = gameCard.querySelector('.card-click-hint');
            if (clickHint) {
                clickHint.style.display = 'block';
            }
        }
        
        // Update next player button
        const nextPlayerBtn = document.getElementById('nextPlayerBtn');
        if (nextPlayerBtn) {
            nextPlayerBtn.disabled = !this.isCurrentPlayer();
        }
        
        // Show notification
        this.showNotification('Challenge Selected!', `${player.name} chose ${type}!`, 'success');
    }
    
    resetCard() {
        // Hide game card
        const gameCardContainer = document.getElementById('gameCardContainer');
        if (gameCardContainer) {
            gameCardContainer.style.display = 'none';
        }
        
        // Show challenge selection for current player
        const challengeSelection = document.getElementById('challengeSelection');
        if (challengeSelection) {
            if (this.isCurrentPlayer()) {
                challengeSelection.style.display = 'block';
            } else {
                challengeSelection.style.display = 'none';
            }
        }
        
        // Update next player button
        const nextPlayerBtn = document.getElementById('nextPlayerBtn');
        if (nextPlayerBtn) {
            nextPlayerBtn.disabled = !this.isCurrentPlayer();
        }
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
                // Get user media
                this.localStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: true, 
                    video: false 
                });
                
                // Show voice panel
                voicePanel.classList.remove('hidden');
                voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Voice';
                voiceBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a24)';
                document.getElementById('voiceStatus').textContent = 'Voice chat active';
                
                // Notify other players
                this.socket.emit('voice-toggle', { roomCode: this.roomCode, enabled: true });
                
                // Create peer connections with other players
                this.players.forEach(player => {
                    if (player.id !== this.socket.id) {
                        this.createPeerConnection(player.id);
                    }
                });
                
            } catch (error) {
                console.error('Error accessing microphone:', error);
                this.showNotification('Microphone Access Denied', 'Please allow microphone access for voice chat', 'error');
                this.voiceEnabled = false;
            }
        } else {
            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }
            
            // Close all peer connections
            Object.values(this.peerConnections).forEach(pc => pc.close());
            this.peerConnections = {};
            
            // Hide voice panel
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
            chatBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a24)';
            
            // Only clear unread messages when chat panel is actually visible and user interacts
            // Use a longer delay to ensure the panel is fully rendered and user sees it
            setTimeout(() => {
                if (this.isChatPanelVisible()) {
                    // Don't clear immediately - wait for user interaction
                    console.log('Chat panel opened - badge will clear on user interaction');
                }
            }, 200);
        } else {
            chatPanel.classList.add('hidden');
            chatBtn.style.background = '';
        }
        
        // Update chat button text with current language (preserve badge)
        this.updateUnreadIndicator();
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
    
    // WebRTC Handler Functions
    async handleOffer(data) {
        try {
            const peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            this.peerConnections[data.from] = peerConnection;
            
            // Add local stream if available
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Handle incoming stream
            peerConnection.ontrack = (event) => {
                const audio = document.createElement('audio');
                audio.srcObject = event.streams[0];
                audio.autoplay = true;
                audio.volume = 0.8;
                document.body.appendChild(audio);
            };
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('webrtc-ice-candidate', {
                        to: data.from,
                        candidate: event.candidate
                    });
                }
            };
            
            await peerConnection.setRemoteDescription(data.offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            this.socket.emit('webrtc-answer', {
                to: data.from,
                answer: answer
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }
    
    async handleAnswer(data) {
        try {
            const peerConnection = this.peerConnections[data.from];
            if (peerConnection) {
                await peerConnection.setRemoteDescription(data.answer);
            }
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }
    
    async handleIceCandidate(data) {
        try {
            const peerConnection = this.peerConnections[data.from];
            if (peerConnection) {
                await peerConnection.addIceCandidate(data.candidate);
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }
    
    async createPeerConnection(playerId) {
        try {
            const peerConnection = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            
            this.peerConnections[playerId] = peerConnection;
            
            // Add local stream if available
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Handle incoming stream
            peerConnection.ontrack = (event) => {
                const audio = document.createElement('audio');
                audio.srcObject = event.streams[0];
                audio.autoplay = true;
                audio.volume = 0.8;
                document.body.appendChild(audio);
            };
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('webrtc-ice-candidate', {
                        to: playerId,
                        candidate: event.candidate
                    });
                }
            };
            
            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.socket.emit('webrtc-offer', {
                to: playerId,
                offer: offer
            });
        } catch (error) {
            console.error('Error creating peer connection:', error);
        }
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
            this.showNotification('Only the host can manage questions', 'error');
            return;
        }
        document.getElementById('questionModal').classList.remove('hidden');
        this.updateQuestionsDisplay();
        this.updateQuestionStats();
    }
    
    hideQuestionModal() {
        document.getElementById('questionModal').classList.add('hidden');
        // Clear previews
        this.hidePreview('truth');
        this.hidePreview('dare');
    }
    
    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}Tab`).classList.add('active');
        
        // Hide previews when switching tabs
        this.hidePreview('truth');
        this.hidePreview('dare');
    }
    
    updateQuestionStats() {
        const truthCount = this.truthQuestions.length;
        const dareCount = this.dareQuestions.length;
        const totalCount = truthCount + dareCount;
        
        document.getElementById('truthCount').textContent = truthCount;
        document.getElementById('dareCount').textContent = dareCount;
        document.getElementById('totalCount').textContent = totalCount;
        document.getElementById('truthTabCount').textContent = truthCount;
        document.getElementById('dareTabCount').textContent = dareCount;
    }
    
    previewQuestion(text, type) {
        if (!text.trim()) {
            this.hidePreview(type);
            return;
        }
        
        const previewElement = document.getElementById(`${type}Preview`);
        const previewTextElement = document.getElementById(`${type}PreviewText`);
        
        if (previewElement && previewTextElement) {
            previewTextElement.textContent = text;
            previewElement.style.display = 'block';
        }
    }
    
    hidePreview(type) {
        const previewElement = document.getElementById(`${type}Preview`);
        if (previewElement) {
            previewElement.style.display = 'none';
        }
    }
    
    clearQuestions(type) {
        if (!this.isHost) {
            this.showNotification('Only the host can manage questions', 'error');
            return;
        }
        
        const confirmMessage = `Are you sure you want to clear all ${type} questions?`;
        if (!confirm(confirmMessage)) return;
        
        if (type === 'truth') {
            this.truthQuestions = [];
        } else {
            this.dareQuestions = [];
        }
        
        this.updateQuestionsDisplay();
        this.updateQuestionStats();
        this.showNotification(`All ${type} questions cleared`, 'success');
    }
    
    resetToDefaultQuestions() {
        if (!this.isHost) {
            this.showNotification('Only the host can manage questions', 'error');
            return;
        }
        
        if (!confirm('Are you sure you want to reset to default questions? This will replace all current questions.')) return;
        
        // Reset to default questions
        this.truthQuestions = [
            "What's your biggest fear?",
            "What's the most embarrassing thing you've ever done?",
            "Who was your first crush?",
            "What's your biggest secret?",
            "What's the worst lie you've ever told?",
            "What's your most embarrassing moment?",
            "What's something you've never told your parents?",
            "What's your biggest regret?",
            "What's the most childish thing you still do?",
            "What's your most irrational fear?"
        ];
        
        this.dareQuestions = [
            "Do 20 jumping jacks",
            "Sing a song of your choice",
            "Do your best impression of someone in the room",
            "Dance for 30 seconds",
            "Tell a joke",
            "Do 10 push-ups",
            "Speak in an accent for the next 3 rounds",
            "Do a cartwheel",
            "Do your best animal impression",
            "Do 15 squats"
        ];
        
        this.updateQuestionsDisplay();
        this.updateQuestionStats();
        this.showNotification('Questions reset to default', 'success');
    }
    
    exportQuestions() {
        const questionsData = {
            truth: this.truthQuestions,
            dare: this.dareQuestions,
            exported: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(questionsData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `truth-or-dare-questions-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Questions exported successfully', 'success');
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
        this.updateQuestionStats();
    }
    
    updateQuestionsList(type) {
        const listElement = document.getElementById(`${type}QuestionsList`);
        const questions = type === 'truth' ? this.truthQuestions : this.dareQuestions;
        
        if (questions.length === 0) {
            listElement.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-${type === 'truth' ? 'question-circle' : 'fire'}"></i>
                    <h4>No ${type} questions yet</h4>
                    <p>Add your first ${type} question above to get started!</p>
                </div>
            `;
            return;
        }
        
        listElement.innerHTML = '';
        questions.forEach((question, index) => {
            const item = document.createElement('div');
            item.className = `question-item ${type}-item`;
            item.innerHTML = `
                <div class="question-text">${question}</div>
                <div class="question-actions">
                    <button class="btn-icon btn-edit" onclick="game.editQuestion('${type}', ${index})" title="Edit question">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="game.removeQuestion('${type}', ${index})" title="Remove question">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            listElement.appendChild(item);
        });
    }
    
    editQuestion(type, index) {
        const questions = type === 'truth' ? this.truthQuestions : this.dareQuestions;
        const currentQuestion = questions[index];
        const newQuestion = prompt(`Edit ${type} question:`, currentQuestion);
        
        if (newQuestion && newQuestion.trim() && newQuestion !== currentQuestion) {
            questions[index] = newQuestion.trim();
            this.updateQuestionsDisplay();
            this.showNotification(`${type} question updated`, 'success');
        }
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
    
    // Add global test function for chat badge
    window.testChatBadge = function() {
        if (window.game) {
            window.game.testChatBadge();
        }
    };
    
    // Add global flip card function
    window.flipCard = function() {
        if (window.game) {
            window.game.flipCard();
        }
    };
});

// Add notification functions to the TruthOrDareGame class
TruthOrDareGame.prototype.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    let iconClass = 'info-circle';
    if (type === 'success') iconClass = 'check-circle';
    else if (type === 'error') iconClass = 'exclamation-circle';
    else if (type === 'warning') iconClass = 'exclamation-triangle';
    
    notification.innerHTML = `
        <div class="notification-header">
            <i class="fas fa-${iconClass}"></i>
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Play sound
    this.playNotificationSound(type);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
};

TruthOrDareGame.prototype.playNotificationSound = function(type) {
    if (!this.soundEnabled) return;
    
    switch(type) {
        case 'success':
            this.playSound(800, 200, 'sine');
            break;
        case 'error':
            this.playSound(300, 300, 'sawtooth');
            break;
        case 'player-join':
            this.playSound(600, 150, 'sine');
            setTimeout(() => this.playSound(800, 150, 'sine'), 100);
            break;
        case 'chat':
            this.playSound(1000, 100, 'sine');
            break;
        default:
            this.playSound(500, 200, 'sine');
    }
};

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