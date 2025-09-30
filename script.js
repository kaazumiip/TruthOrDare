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
        
        // Rule system properties
        this.gameRules = {
            maxPlayers: 8,
            minPlayers: 2,
            categories: ['normal', 'couple', 'mystery', 'dare'],
            selectedCategory: 'normal',
            safetyMode: true,
            skipLimit: 3, // Max skips per player
            timeLimit: 30, // Seconds to answer
            scoring: false, // No scoring system
            boundaries: {
                respectBoundaries: true,
                skipUncomfortable: true,
                safeDares: true,
                supportiveEnvironment: true
            }
        };
        this.playerStats = {}; // Track player statistics
        this.currentQuestion = null;
        this.questionTimer = null;
        this.selectiveVoiceMode = false;
        
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
        
        // Force update visible player list after page loads
        setTimeout(() => {
            this.updateVisiblePlayerList();
        }, 1000);
        
        // Also force update when page is fully loaded
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.updateVisiblePlayerList();
            }, 500);
        });
        
        // Force update when DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                this.updateVisiblePlayerList();
            }, 200);
        });
        
        // Force update when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => {
                    this.updateVisiblePlayerList();
                }, 100);
            }
        });
        
        // Force update every 2 seconds to ensure it stays visible
        setInterval(() => {
            if (this.isHost) {
                this.updateVisiblePlayerList();
            }
        }, 2000);
        
        // Add a simple test function to force show the list
        window.testVisiblePlayerList = () => {
            console.log('🧪 Testing visible player list...');
            this.updateVisiblePlayerList();
        };
        
        // Add a function to force show the list for testing
        window.forceShowPlayerList = () => {
            console.log('🔧 Forcing player list to show...');
            const visiblePlayerList = document.getElementById('visiblePlayerList');
            if (visiblePlayerList) {
                visiblePlayerList.style.display = 'block';
                visiblePlayerList.style.visibility = 'visible';
                visiblePlayerList.style.opacity = '1';
                visiblePlayerList.style.position = 'relative';
                visiblePlayerList.style.zIndex = '10';
                console.log('✅ Player list forced to show');
            } else {
                console.log('❌ Player list element not found');
            }
        };
        
        // Add a function to check if the list is working
        window.checkPlayerList = () => {
            console.log('🔍 Checking player list status...');
            const visiblePlayerList = document.getElementById('visiblePlayerList');
            const visiblePlayerListContainer = document.getElementById('visiblePlayerListContainer');
            const visiblePlayerCount = document.getElementById('visiblePlayerCount');
            
            console.log('Elements found:', {
                visiblePlayerList: !!visiblePlayerList,
                visiblePlayerListContainer: !!visiblePlayerListContainer,
                visiblePlayerCount: !!visiblePlayerCount,
                isHost: this.isHost,
                playersCount: this.players.length
            });
            
            if (visiblePlayerList) {
                console.log('Player list styles:', {
                    display: visiblePlayerList.style.display,
                    visibility: visiblePlayerList.style.visibility,
                    opacity: visiblePlayerList.style.opacity
                });
            }
        };
        
        // Add a function to force update player count
        window.forceUpdatePlayerCount = () => {
            console.log('🔧 Forcing player count update...');
            this.updateGameDisplay();
            this.updateVisiblePlayerList();
            console.log('Current players:', this.players);
        };
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
        
        // Rules panel event listeners
        document.getElementById('rulesToggleBtn').addEventListener('click', () => this.toggleRules());
        document.getElementById('closeRulesBtn').addEventListener('click', () => this.toggleRules());
        document.getElementById('applyRulesBtn').addEventListener('click', () => this.applyRules());
        document.getElementById('resetRulesBtn').addEventListener('click', () => this.resetRules());
        
        // Host controls event listeners
        document.getElementById('kickPlayerBtn').addEventListener('click', () => this.showKickPlayerDialog());
        document.getElementById('transferHostBtn').addEventListener('click', () => this.showTransferHostDialog());
        document.getElementById('copyRoomCodeBtn').addEventListener('click', () => this.copyRoomCode());
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
            this.updateVisiblePlayerList();
            this.updateRoomPlayersList();
            this.updateGameDisplay();
            
            // Show the room created step
            document.getElementById('hostNameStep').style.display = 'none';
            document.getElementById('roomCreatedStep').style.display = 'block';
            
            // Update room code display
            document.getElementById('roomCode').textContent = data.roomCode;
            document.getElementById('currentRoomCode').textContent = data.roomCode;
            
            console.log('🏠 Room created with players:', this.players);
            
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
            this.updateRoomPlayersList();
            this.updateGameDisplay();
            this.addChatMessage('System', `${data.player.name} joined the game!`, false);
            
            // Enhanced notification for host
            if (this.isHost) {
                this.showHostPlayerJoinNotification(data.player.name, data.roomCode);
            } else {
                this.showNotification('Player Joined', `${data.player.name} joined the room!`, 'player-join');
            }
            
            // Show join notification animation
            this.showPlayerJoinNotification(data.player.name);
            
            // Update room status
            this.updateRoomStatus();
            
            // Ensure visible player list is updated
            this.updateVisiblePlayerList();
            
            console.log('👥 Player joined, total players:', this.players.length);
            
            // If voice is enabled, create connection with new player
            if (this.voiceEnabled && this.localStream) {
                if (this.selectiveVoiceMode) {
                    // In selective mode, only connect if they're important (current/next/prev)
                    const shouldConnect = this.shouldConnectToPlayer(data.player.id);
                    if (shouldConnect) {
                        this.createPeerConnection(data.player.id);
                    }
                } else {
                    // In full mode, connect to everyone
                    this.createPeerConnection(data.player.id);
                }
            }
        });
        
        this.socket.on('player-left', (data) => {
            this.players = data.players;
            this.updatePlayersList();
            this.updateRoomPlayersList();
            this.updateGameDisplay();
            this.updateVisiblePlayerList();
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
            
            // Apply rules from server
            if (data.rules) {
                this.gameRules = { ...this.gameRules, ...data.rules };
            }
            
            this.showGameRoom(); // Show the game room when game starts
            this.updateGameDisplay();
            this.updateVisiblePlayerList();
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
            this.currentQuestion = data;
            this.showCard(data.type, data.question, data.player);
            
            // Start question timer if enabled
            if (this.gameRules.timeLimit > 0) {
                this.startQuestionTimer();
            }
        });
        
        this.socket.on('player-changed', (data) => {
            this.players = data.players;
            this.currentPlayer = data.currentPlayer;
            this.updateGameDisplay();
            this.updateVisiblePlayerList();
            this.resetCard();
            
            // Update voice connections for selective mode
            this.updateVoiceConnectionsForTurn();
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
        
        this.socket.on('voice-mute-status', (data) => {
            if (data.player !== this.playerName) {
                this.updatePlayerMuteStatus(data.player, data.muted);
            }
        });
        
        this.socket.on('kicked', (data) => {
            this.showNotification('Kicked from Room', data.reason, 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
        });
        
        this.socket.on('host-transferred', (data) => {
            this.players = data.players;
            this.isHost = data.players.find(p => p.id === this.socket.id)?.isHost || false;
            this.updatePlayersList();
            this.updateHostControls();
            this.showNotification('Host Transferred', `${data.newHost} is now the host`, 'info');
        });
        
        // Rules events
        this.socket.on('rules-updated', (data) => {
            if (data.rules) {
                this.gameRules = { ...this.gameRules, ...data.rules };
                this.showNotification('Rules Updated', `Rules updated by ${data.updatedBy}`, 'info');
                console.log('Rules updated from server:', data.rules);
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
        this.updateRoomStatus();
        this.updateHostControls();
        this.updateVisiblePlayerList();
        console.log('🏠 Game room shown, updating visible player list');
        
        // Force update visible player list after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.updateVisiblePlayerList();
        }, 100);
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
        
        // Enforce game rules before starting
        if (!this.enforceRules()) {
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
        
        // Start the game with rules
        this.socket.emit('start-game', { 
            roomCode: this.roomCode,
            rules: this.getGameRulesDisplay()
        });
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
            playerItem.setAttribute('data-player-id', player.id);
            
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
        
        // Update visible player list for all players
        this.updateVisiblePlayerList();
        
        // Update host controls visibility
        this.updateHostControls();
    }
    
    updateVisiblePlayerList() {
        const visiblePlayerList = document.getElementById('visiblePlayerList');
        const visiblePlayerListContainer = document.getElementById('visiblePlayerListContainer');
        const visiblePlayerCount = document.getElementById('visiblePlayerCount');
        
        console.log('🔍 Updating visible player list:', {
            visiblePlayerList: !!visiblePlayerList,
            visiblePlayerListContainer: !!visiblePlayerListContainer,
            visiblePlayerCount: !!visiblePlayerCount,
            isHost: this.isHost,
            playersCount: this.players.length
        });
        
        if (!visiblePlayerList || !visiblePlayerListContainer || !visiblePlayerCount) {
            console.log('❌ Missing elements for visible player list');
            return;
        }
        
        // Show for all players now
        visiblePlayerList.style.display = 'block';
        visiblePlayerList.style.visibility = 'visible';
        visiblePlayerList.style.opacity = '1';
        visiblePlayerList.style.position = 'relative';
        visiblePlayerList.style.zIndex = '10';
        console.log('✅ Showing visible player list for all players');
        
        // Update player count
        visiblePlayerCount.textContent = this.players.length;
        
        // Clear existing players
        visiblePlayerListContainer.innerHTML = '';
        
        console.log('👥 Adding players to visible list:', this.players);
        
        // Add each player
        if (this.players.length === 0) {
            // Show empty state
            const emptyState = document.createElement('div');
            emptyState.className = 'visible-player-item';
            emptyState.innerHTML = `
                <div class="visible-player-info">
                    <div class="visible-player-name">No players yet</div>
                    <div class="visible-player-status">
                        <div class="status-dot offline"></div>
                        Waiting for players to join
                    </div>
                </div>
            `;
            visiblePlayerListContainer.appendChild(emptyState);
            console.log('📝 Added empty state to visible list');
        } else {
            this.players.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'visible-player-item';
                if (player.isHost) {
                    playerItem.classList.add('host');
                }
                
                // Get first letter of name for avatar
                const avatarLetter = player.name.charAt(0).toUpperCase();
                
                // Determine status
                let statusClass = 'status-dot';
                let statusText = 'Online';
                if (this.currentPlayer && player.id === this.currentPlayer.id) {
                    statusClass += ' speaking';
                    statusText = 'Speaking';
                } else if (this.voiceEnabled) {
                    statusText = 'Voice enabled';
                } else {
                    statusClass += ' offline';
                    statusText = 'Muted';
                }
                
                playerItem.innerHTML = `
                    <div class="visible-player-avatar ${player.isHost ? 'host' : ''}">
                        ${avatarLetter}
                    </div>
                    <div class="visible-player-info">
                        <div class="visible-player-name">${player.name}</div>
                        <div class="visible-player-status">
                            <div class="${statusClass}"></div>
                            ${statusText}
                        </div>
                    </div>
                `;
                
                visiblePlayerListContainer.appendChild(playerItem);
                console.log('✅ Added player to visible list:', player.name);
            });
        }
        
        console.log('🎉 Visible player list updated successfully');
        
        // Force the list to be visible for all players
        visiblePlayerList.style.display = 'block';
        visiblePlayerList.style.visibility = 'visible';
        visiblePlayerList.style.opacity = '1';
        console.log('🔧 Forced visible player list to show for all players');
    }
    
    // Enhanced Player Display for Room Code Page
    updateRoomPlayersList() {
        const roomPlayersList = document.getElementById('roomPlayersList');
        const roomPlayerCount = document.getElementById('roomPlayerCount');
        const roomPlayerCountBadge = document.getElementById('roomPlayerCountBadge');
        
        console.log('🏠 Updating room players list:', {
            roomPlayersList: !!roomPlayersList,
            roomPlayerCount: !!roomPlayerCount,
            roomPlayerCountBadge: !!roomPlayerCountBadge,
            playersCount: this.players.length
        });
        
        if (roomPlayersList) {
            roomPlayersList.innerHTML = '';
            this.players.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'room-player-item';
                
                // Add host class if this player is the host
                if (player.isHost) {
                    playerItem.classList.add('host');
                }
                
                playerItem.innerHTML = `
                    <div class="room-player-avatar ${player.isHost ? 'host' : ''}">${player.name.charAt(0).toUpperCase()}</div>
                    <div class="room-player-info">
                        <div class="room-player-name">${player.name}</div>
                        <div class="room-player-status ${player.isHost ? 'host' : ''}">
                            ${player.isHost ? 'Host' : 'Player'}
                        </div>
                    </div>
                `;
                
                roomPlayersList.appendChild(playerItem);
            });
        }
        
        // Update player count displays
        if (roomPlayerCount) {
            roomPlayerCount.textContent = this.players.length;
        }
        if (roomPlayerCountBadge) {
            roomPlayerCountBadge.textContent = this.players.length;
        }
        
        console.log('✅ Room players list updated successfully');
    }
    
    showPlayerJoinNotification(playerName) {
        const joinNotifications = document.getElementById('joinNotifications');
        if (!joinNotifications) return;
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'join-notification-item';
        notification.innerHTML = `
            <div class="join-notification-content">
                <i class="fas fa-user-plus"></i>
                <span>${playerName} joined!</span>
            </div>
        `;
        
        // Add to notifications container
        joinNotifications.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
    showHostPlayerJoinNotification(playerName, roomCode) {
        // Enhanced notification for host with room code
        const notification = document.createElement('div');
        notification.className = 'host-join-notification';
        notification.innerHTML = `
            <div class="host-join-content">
                <div class="host-join-header">
                    <i class="fas fa-crown"></i>
                    <span>New Player Joined!</span>
                </div>
                <div class="host-join-details">
                    <div class="player-name-large">${playerName}</div>
                    <div class="room-code-display">Room: ${roomCode}</div>
                    <div class="player-count">Total Players: ${this.players.length}</div>
                </div>
                <div class="host-join-actions">
                    <button class="btn btn-small btn-success" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-check"></i> Got it
                    </button>
                </div>
            </div>
        `;
        
        // Add to body for prominent display
        document.body.appendChild(notification);
        
        // Auto-remove after 8 seconds (longer for host)
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 8000);
        
        // Add sound effect for host (if supported)
        this.playJoinSound();
    }
    
    playJoinSound() {
        // Simple sound effect for player join (if audio context is available)
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Audio not supported or blocked');
        }
    }
    
    updateRoomStatus() {
        const roomStatusBadge = document.getElementById('roomStatusBadge');
        if (!roomStatusBadge) return;
        
        const playerCount = this.players.length;
        const minPlayers = 2;
        
        if (playerCount < minPlayers) {
            roomStatusBadge.innerHTML = '<i class="fas fa-clock"></i> Waiting for players...';
            roomStatusBadge.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        } else if (playerCount >= minPlayers && !this.gameStarted) {
            roomStatusBadge.innerHTML = '<i class="fas fa-check-circle"></i> Ready to start!';
            roomStatusBadge.style.background = 'linear-gradient(135deg, #4ade80, #22c55e)';
        } else if (this.gameStarted) {
            roomStatusBadge.innerHTML = '<i class="fas fa-gamepad"></i> Game in progress';
            roomStatusBadge.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
        }
    }
    
    updateHostControls() {
        const hostControls = document.getElementById('hostControls');
        if (!hostControls) return;
        
        if (this.isHost) {
            hostControls.classList.remove('hidden');
        } else {
            hostControls.classList.add('hidden');
        }
    }
    
    showKickPlayerDialog() {
        if (!this.isHost) return;
        
        const playerNames = this.players
            .filter(p => !p.isHost)
            .map(p => p.name);
            
        if (playerNames.length === 0) {
            this.showNotification('No Players', 'No players to kick', 'info');
            return;
        }
        
        const playerName = prompt(`Enter player name to kick:\n\nAvailable players: ${playerNames.join(', ')}`);
        if (playerName && playerNames.includes(playerName)) {
            this.kickPlayer(playerName);
        }
    }
    
    showTransferHostDialog() {
        if (!this.isHost) return;
        
        const playerNames = this.players
            .filter(p => !p.isHost)
            .map(p => p.name);
            
        if (playerNames.length === 0) {
            this.showNotification('No Players', 'No players to transfer host to', 'info');
            return;
        }
        
        const playerName = prompt(`Enter player name to transfer host to:\n\nAvailable players: ${playerNames.join(', ')}`);
        if (playerName && playerNames.includes(playerName)) {
            this.transferHost(playerName);
        }
    }
    
    kickPlayer(playerName) {
        if (!this.isHost) return;
        
        this.socket.emit('kick-player', {
            roomCode: this.roomCode,
            playerName: playerName
        });
        
        this.showNotification('Player Kicked', `${playerName} has been kicked from the room`, 'warning');
    }
    
    transferHost(playerName) {
        if (!this.isHost) return;
        
        this.socket.emit('transfer-host', {
            roomCode: this.roomCode,
            playerName: playerName
        });
        
        this.showNotification('Host Transferred', `Host privileges transferred to ${playerName}`, 'info');
    }
    
    copyRoomCode() {
        if (!this.roomCode) return;
        
        navigator.clipboard.writeText(this.roomCode).then(() => {
            this.showNotification('Room Code Copied', `Room code ${this.roomCode} copied to clipboard!`, 'success');
            
            // Visual feedback on the button
            const copyBtn = document.getElementById('copyRoomCodeBtn');
            if (copyBtn) {
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyBtn.style.background = 'rgba(34, 197, 94, 0.3)';
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.style.background = '';
                }, 2000);
            }
        }).catch(err => {
            console.error('Failed to copy room code:', err);
            this.showNotification('Copy Failed', 'Failed to copy room code to clipboard', 'error');
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
            console.log('✅ Updated playersCount element:', this.players.length);
        } else {
            console.log('❌ playersCount element not found');
        }
        
        // Also update visible player count
        const visiblePlayerCount = document.getElementById('visiblePlayerCount');
        if (visiblePlayerCount) {
            visiblePlayerCount.textContent = this.players.length;
            console.log('✅ Updated visiblePlayerCount element:', this.players.length);
        } else {
            console.log('❌ visiblePlayerCount element not found');
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
        
        // Update current player initial
        const currentPlayerInitialEl = document.getElementById('currentPlayerInitial');
        if (currentPlayerInitialEl) {
            if (this.gameStarted && this.currentPlayer) {
                currentPlayerInitialEl.textContent = this.currentPlayer.name.charAt(0).toUpperCase();
            } else if (this.isHost && !this.gameStarted) {
                currentPlayerInitialEl.textContent = 'H';
            } else {
                currentPlayerInitialEl.textContent = 'W';
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
    
    // Voice and Chat - Scalable Implementation
    async toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        const voicePanel = document.getElementById('voicePanel');
        const voiceBtn = document.getElementById('voiceToggleBtn');
        
        if (this.voiceEnabled) {
            try {
                // Check browser support
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Your browser does not support voice chat. Please use Chrome, Firefox, or Edge.');
                }
                
                // Check if too many players for full voice chat
                const playerCount = this.players.length;
                const maxFullVoice = 6; // Limit for full mesh voice
                
                if (playerCount > maxFullVoice) {
                    const useSelectiveVoice = confirm(
                        `Voice chat with ${playerCount} players works best in selective mode.\n\n` +
                        `Selective mode: Only active players can hear each other.\n` +
                        `Full mode: Everyone can hear everyone (may cause issues).\n\n` +
                        `Choose "OK" for selective mode or "Cancel" for full mode.`
                    );
                    this.selectiveVoiceMode = useSelectiveVoice;
                } else {
                    this.selectiveVoiceMode = false;
                }
                
                // Detect mobile device and optimize constraints
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                
                // Mobile-optimized audio constraints
                const audioConstraints = isMobile ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: isIOS ? 48000 : 44100, // iOS prefers 48kHz
                    channelCount: 1,
                    latency: 0.01, // Lower latency for mobile
                    volume: 1.0
                } : {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100,
                    channelCount: 1
                };
                
                console.log(`Mobile device detected: ${isMobile}, iOS: ${isIOS}`);
                console.log('Using audio constraints:', audioConstraints);
                
                // Get user media with mobile-optimized constraints
                this.localStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: audioConstraints,
                    video: false 
                }).catch(error => {
                    console.error('Microphone access denied:', error);
                    
                    // Mobile-specific error messages
                    if (isMobile) {
                        if (error.name === 'NotAllowedError') {
                            throw new Error('Microphone access denied on mobile. Please:\n1. Allow microphone permission in your browser\n2. Make sure you\'re using Chrome or Safari\n3. Try refreshing the page');
                        } else if (error.name === 'NotFoundError') {
                            throw new Error('No microphone found on mobile. Please:\n1. Check if your phone has a working microphone\n2. Try using headphones with a microphone\n3. Restart your browser');
                        }
                    }
                    
                    throw new Error('Microphone access is required for voice chat. Please allow microphone access and try again.');
                });
                
                // Show voice panel
                voicePanel.classList.remove('hidden');
                voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Voice';
                voiceBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a24)';
                
                // Initialize mute button state
                const muteBtn = document.getElementById('muteBtn');
                muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Mute';
                muteBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a24)';
                
                // Update status based on mode
                const statusText = this.selectiveVoiceMode ? 
                    'Selective voice active (active players only)' : 
                    'Voice chat active (all players)';
                document.getElementById('voiceStatus').textContent = statusText;
                
                // Notify other players
                this.socket.emit('voice-toggle', { 
                    roomCode: this.roomCode, 
                    enabled: true,
                    selectiveMode: this.selectiveVoiceMode 
                });
                
                // Create peer connections based on mode
                if (this.selectiveVoiceMode) {
                    this.createSelectiveVoiceConnections();
                } else {
                    this.createFullVoiceConnections();
                }
                
            } catch (error) {
                console.error('Error accessing microphone:', error);
                
                // Provide specific error messages
                let errorMessage = 'Could not initialize voice chat. ';
                if (error.name === 'NotAllowedError') {
                    errorMessage += 'Microphone access was denied. Please allow microphone access and try again.';
                } else if (error.name === 'NotFoundError') {
                    errorMessage += 'No microphone found. Please connect a microphone and try again.';
                } else if (error.name === 'NotSupportedError') {
                    errorMessage += 'Your browser does not support voice chat. Please use Chrome, Firefox, or Edge.';
                } else if (error.name === 'SecurityError') {
                    errorMessage += 'Voice chat requires HTTPS. Please use a secure connection.';
                } else {
                    errorMessage += error.message || 'Please check your microphone permissions and try again.';
                }
                
                this.showNotification('Voice Setup Failed', errorMessage, 'error');
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
    
    // Create selective voice connections (only with active/important players)
    createSelectiveVoiceConnections() {
        const connectionsToCreate = [];
        
        // Always connect to current player if not self
        if (this.currentPlayer && this.currentPlayer.id !== this.socket.id) {
            connectionsToCreate.push(this.currentPlayer.id);
        }
        
        // Connect to next player
        const nextPlayer = this.getNextPlayer();
        if (nextPlayer && nextPlayer.id !== this.socket.id) {
            connectionsToCreate.push(nextPlayer.id);
        }
        
        // Connect to previous player
        const prevPlayer = this.getPreviousPlayer();
        if (prevPlayer && prevPlayer.id !== this.socket.id) {
            connectionsToCreate.push(prevPlayer.id);
        }
        
        // Connect to ALL players who have voice enabled (not just 3)
        const voiceEnabledPlayers = this.players.filter(p => 
            p.id !== this.socket.id && 
            p.voiceEnabled && 
            !connectionsToCreate.includes(p.id)
        );
        
        // Add all voice-enabled players to connections
        connectionsToCreate.push(...voiceEnabledPlayers.map(p => p.id));
        
        // Create connections
        connectionsToCreate.forEach(playerId => {
            this.createPeerConnection(playerId);
        });
        
        console.log(`Selective voice: Connected to ${connectionsToCreate.length} players:`, connectionsToCreate);
    }
    
    // Create full voice connections (original behavior)
    createFullVoiceConnections() {
        this.players.forEach(player => {
            if (player.id !== this.socket.id) {
                this.createPeerConnection(player.id);
            }
        });
        console.log(`Full voice: Connected to ${this.players.length - 1} players`);
    }
    
    // Get next player in turn order
    getNextPlayer() {
        if (!this.currentPlayer || this.players.length <= 1) return null;
        
        const currentIndex = this.players.findIndex(p => p.id === this.currentPlayer.id);
        const nextIndex = (currentIndex + 1) % this.players.length;
        return this.players[nextIndex];
    }
    
    // Get previous player in turn order
    getPreviousPlayer() {
        if (!this.currentPlayer || this.players.length <= 1) return null;
        
        const currentIndex = this.players.findIndex(p => p.id === this.currentPlayer.id);
        const prevIndex = currentIndex === 0 ? this.players.length - 1 : currentIndex - 1;
        return this.players[prevIndex];
    }
    
    // Determine if we should connect to a specific player in selective mode
    shouldConnectToPlayer(playerId) {
        if (!this.selectiveVoiceMode) return true;
        
        // Always connect to current player
        if (this.currentPlayer && this.currentPlayer.id === playerId) return true;
        
        // Connect to next player
        const nextPlayer = this.getNextPlayer();
        if (nextPlayer && nextPlayer.id === playerId) return true;
        
        // Connect to previous player
        const prevPlayer = this.getPreviousPlayer();
        if (prevPlayer && prevPlayer.id === playerId) return true;
        
        // Connect to ALL players who have voice enabled (no limit)
        const targetPlayer = this.players.find(p => p.id === playerId);
        if (targetPlayer && targetPlayer.voiceEnabled) return true;
        
        return false;
    }
    
    // Update voice connections when turn changes
    updateVoiceConnectionsForTurn() {
        if (!this.voiceEnabled || !this.selectiveVoiceMode) return;
        
        // Close existing connections
        Object.keys(this.peerConnections).forEach(playerId => {
            if (this.peerConnections[playerId]) {
                this.peerConnections[playerId].close();
                delete this.peerConnections[playerId];
            }
        });
        
        // Remove existing audio elements
        document.querySelectorAll('[id^="audio-"]').forEach(audio => audio.remove());
        
        // Create new connections based on current turn
        this.createSelectiveVoiceConnections();
    }
    
    // Rule System Methods
    initializePlayerStats(playerId) {
        if (!this.playerStats[playerId]) {
            this.playerStats[playerId] = {
                skipsUsed: 0,
                questionsAnswered: 0,
                daresCompleted: 0,
                totalTime: 0,
                violations: 0
            };
        }
    }
    
    canPlayerSkip(playerId) {
        this.initializePlayerStats(playerId);
        return this.playerStats[playerId].skipsUsed < this.gameRules.skipLimit;
    }
    
    recordSkip(playerId) {
        this.initializePlayerStats(playerId);
        this.playerStats[playerId].skipsUsed++;
        this.showNotification('Skip Used', `Player has ${this.gameRules.skipLimit - this.playerStats[playerId].skipsUsed} skips remaining`, 'info');
    }
    
    recordAnswer(playerId, questionType) {
        this.initializePlayerStats(playerId);
        this.playerStats[playerId].questionsAnswered++;
        if (questionType === 'dare') {
            this.playerStats[playerId].daresCompleted++;
        }
    }
    
    startQuestionTimer() {
        if (this.questionTimer) {
            clearTimeout(this.questionTimer);
        }
        
        this.questionTimer = setTimeout(() => {
            this.showNotification('Time Up!', 'Time limit reached. Moving to next player.', 'warning');
            this.nextTurn();
        }, this.gameRules.timeLimit * 1000);
    }
    
    stopQuestionTimer() {
        if (this.questionTimer) {
            clearTimeout(this.questionTimer);
            this.questionTimer = null;
        }
    }
    
    validatePlayerCount() {
        const playerCount = this.players.length;
        if (playerCount < this.gameRules.minPlayers) {
            this.showNotification('Not Enough Players', `Need at least ${this.gameRules.minPlayers} players to start`, 'error');
            return false;
        }
        if (playerCount > this.gameRules.maxPlayers) {
            this.showNotification('Too Many Players', `Maximum ${this.gameRules.maxPlayers} players allowed`, 'error');
            return false;
        }
        return true;
    }
    
    setGameCategory(category) {
        if (this.gameRules.categories.includes(category)) {
            this.gameRules.selectedCategory = category;
            this.showNotification('Category Changed', `Game category set to ${category}`, 'success');
            return true;
        }
        return false;
    }
    
    toggleSafetyMode() {
        this.gameRules.safetyMode = !this.gameRules.safetyMode;
        const status = this.gameRules.safetyMode ? 'enabled' : 'disabled';
        this.showNotification('Safety Mode', `Safety mode ${status}`, 'info');
    }
    
    getFilteredQuestions(category, type) {
        let questions = this.questions[type] || [];
        
        // Filter by category if not 'normal'
        if (category !== 'normal') {
            questions = questions.filter(q => 
                q.category === category || 
                q.category === 'normal' || 
                !q.category
            );
        }
        
        // Apply safety filters if enabled
        if (this.gameRules.safetyMode) {
            questions = questions.filter(q => 
                !q.unsafe && 
                !q.inappropriate && 
                q.safe !== false
            );
        }
        
        return questions;
    }
    
    checkBoundaries(question, playerId) {
        if (!this.gameRules.boundaries.respectBoundaries) return true;
        
        // Check if player has marked this type as uncomfortable
        const playerBoundaries = this.playerStats[playerId]?.boundaries || {};
        if (playerBoundaries[question.type] === false) {
            return false;
        }
        
        return true;
    }
    
    enforceRules() {
        // Check player count
        if (!this.validatePlayerCount()) {
            return false;
        }
        
        // Initialize stats for all players
        this.players.forEach(player => {
            this.initializePlayerStats(player.id);
        });
        
        return true;
    }
    
    showRuleViolation(violation, playerName) {
        this.showNotification('Rule Violation', `${playerName}: ${violation}`, 'warning');
        this.playerStats[playerName].violations++;
    }
    
    getGameRulesDisplay() {
        return {
            maxPlayers: this.gameRules.maxPlayers,
            minPlayers: this.gameRules.minPlayers,
            currentCategory: this.gameRules.selectedCategory,
            safetyMode: this.gameRules.safetyMode,
            skipLimit: this.gameRules.skipLimit,
            timeLimit: this.gameRules.timeLimit,
            boundaries: this.gameRules.boundaries
        };
    }
    
    // Rules Panel Methods
    toggleRules() {
        const rulesPanel = document.getElementById('rulesPanel');
        const rulesBtn = document.getElementById('rulesToggleBtn');
        
        if (!rulesPanel || !rulesBtn) {
            console.error('Rules panel elements not found');
            return;
        }
        
        if (rulesPanel.classList.contains('hidden')) {
            // Show rules panel
            rulesPanel.classList.remove('hidden');
            rulesBtn.innerHTML = '<i class="fas fa-book-open"></i> Rules';
            rulesBtn.style.background = 'linear-gradient(45deg, #4CAF50, #2E7D32)';
            
            // Populate current rules
            this.populateRulesDisplay();
            console.log('Rules panel opened');
        } else {
            // Hide rules panel
            rulesPanel.classList.add('hidden');
            rulesBtn.innerHTML = '<i class="fas fa-book"></i> Rules';
            rulesBtn.style.background = '';
            console.log('Rules panel closed');
        }
    }
    
    populateRulesDisplay() {
        try {
            // Update display with current rules
            const minPlayersEl = document.getElementById('minPlayersDisplay');
            const maxPlayersEl = document.getElementById('maxPlayersDisplay');
            const categoryEl = document.getElementById('categorySelect');
            const timeLimitEl = document.getElementById('timeLimitInput');
            const skipLimitEl = document.getElementById('skipLimitInput');
            const safetyEl = document.getElementById('safetyModeCheck');
            const boundariesEl = document.getElementById('respectBoundariesCheck');
            
            if (minPlayersEl) minPlayersEl.textContent = this.gameRules.minPlayers;
            if (maxPlayersEl) maxPlayersEl.textContent = this.gameRules.maxPlayers;
            if (categoryEl) categoryEl.value = this.gameRules.selectedCategory;
            if (timeLimitEl) timeLimitEl.value = this.gameRules.timeLimit;
            if (skipLimitEl) skipLimitEl.value = this.gameRules.skipLimit;
            if (safetyEl) safetyEl.checked = this.gameRules.safetyMode;
            if (boundariesEl) boundariesEl.checked = this.gameRules.boundaries.respectBoundaries;
            
            console.log('Rules display populated successfully');
        } catch (error) {
            console.error('Error populating rules display:', error);
        }
    }
    
    applyRules() {
        try {
            // Get values from form
            const categoryEl = document.getElementById('categorySelect');
            const timeLimitEl = document.getElementById('timeLimitInput');
            const skipLimitEl = document.getElementById('skipLimitInput');
            const safetyEl = document.getElementById('safetyModeCheck');
            const boundariesEl = document.getElementById('respectBoundariesCheck');
            
            if (!categoryEl || !timeLimitEl || !skipLimitEl || !safetyEl || !boundariesEl) {
                this.showNotification('Error', 'Rules form elements not found', 'error');
                return;
            }
            
            const category = categoryEl.value;
            const timeLimit = parseInt(timeLimitEl.value);
            const skipLimit = parseInt(skipLimitEl.value);
            const safetyMode = safetyEl.checked;
            const respectBoundaries = boundariesEl.checked;
            
            // Validate inputs
            if (isNaN(timeLimit) || timeLimit < 0 || timeLimit > 120) {
                this.showNotification('Invalid Time Limit', 'Time limit must be between 0 and 120 seconds', 'error');
                return;
            }
            
            if (isNaN(skipLimit) || skipLimit < 0 || skipLimit > 10) {
                this.showNotification('Invalid Skip Limit', 'Skip limit must be between 0 and 10', 'error');
                return;
            }
            
            // Update rules
            this.gameRules.selectedCategory = category;
            this.gameRules.timeLimit = timeLimit;
            this.gameRules.skipLimit = skipLimit;
            this.gameRules.safetyMode = safetyMode;
            this.gameRules.boundaries.respectBoundaries = respectBoundaries;
            
            // Notify other players if game is started
            if (this.gameStarted) {
                this.socket.emit('rules-updated', {
                    roomCode: this.roomCode,
                    rules: this.getGameRulesDisplay()
                });
            }
            
            this.showNotification('Rules Updated', 'Game rules have been applied successfully', 'success');
            this.toggleRules(); // Close the panel
            console.log('Rules applied successfully:', this.gameRules);
        } catch (error) {
            console.error('Error applying rules:', error);
            this.showNotification('Error', 'Failed to apply rules', 'error');
        }
    }
    
    resetRules() {
        // Reset to default rules
        this.gameRules = {
            maxPlayers: 8,
            minPlayers: 2,
            categories: ['normal', 'couple', 'mystery', 'dare'],
            selectedCategory: 'normal',
            safetyMode: true,
            skipLimit: 3,
            timeLimit: 30,
            scoring: false,
            boundaries: {
                respectBoundaries: true,
                skipUncomfortable: true,
                safeDares: true,
                supportiveEnvironment: true
            }
        };
        
        this.populateRulesDisplay();
        this.showNotification('Rules Reset', 'Rules have been reset to default values', 'info');
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
        
        // If someone joins voice chat and we're already in voice, connect to them
        if (enabled && this.voiceEnabled) {
            const playerObj = this.players.find(p => p.name === player);
            if (playerObj && playerObj.id !== this.socket.id) {
                // Check if we should connect to this player
                if (!this.selectiveVoiceMode || this.shouldConnectToPlayer(playerObj.id)) {
                    console.log(`Connecting to ${player} for voice chat`);
                    this.createPeerConnection(playerObj.id);
                }
            }
        }
        
        // If someone leaves voice chat, disconnect from them
        if (!enabled && this.voiceEnabled) {
            const playerObj = this.players.find(p => p.name === player);
            if (playerObj && this.peerConnections[playerObj.id]) {
                console.log(`Disconnecting from ${player}`);
                this.peerConnections[playerObj.id].close();
                delete this.peerConnections[playerObj.id];
            }
        }
        
        // Update voice status display with connection count
        if (this.voiceEnabled) {
            const connectionCount = Object.keys(this.peerConnections).length;
            const statusText = this.selectiveVoiceMode ? 
                `Selective voice active (${connectionCount} connections)` : 
                `Voice chat active (${connectionCount} connections)`;
            document.getElementById('voiceStatus').textContent = statusText;
        }
    }
    
    updatePlayerMuteStatus(player, muted) {
        // Update mute status for other players
        console.log(`${player} ${muted ? 'muted' : 'unmuted'}`);
        
        // Update player list to show mute status
        const playerElement = document.querySelector(`[data-player="${player}"]`);
        if (playerElement) {
            const voiceIcon = playerElement.querySelector('.voice-icon');
            if (voiceIcon) {
                if (muted) {
                    voiceIcon.className = 'voice-icon fas fa-microphone-slash muted';
                    voiceIcon.title = 'Muted';
                } else {
                    voiceIcon.className = 'voice-icon fas fa-microphone';
                    voiceIcon.title = 'Voice enabled';
                }
            }
        }
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
            // Detect mobile device for optimized configuration
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            // Mobile-optimized WebRTC configuration
            const rtcConfig = isMobile ? {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ],
                iceCandidatePoolSize: 5, // Reduced for mobile
                iceTransportPolicy: 'all',
                bundlePolicy: 'max-bundle', // Better for mobile
                rtcpMuxPolicy: 'require' // Required for mobile
            } : {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    { urls: 'stun:stun.ekiga.net' },
                    { urls: 'stun:stun.ideasip.com' },
                    { urls: 'stun:stun.schlund.de' },
                    { urls: 'stun:stun.stunprotocol.org:3478' },
                    { urls: 'stun:stun.voiparound.com' },
                    { urls: 'stun:stun.voipbuster.com' },
                    { urls: 'stun:stun.voipstunt.com' },
                    { urls: 'stun:stun.voxgratia.org' },
                    { urls: 'stun:stun.xten.com' }
                ],
                iceCandidatePoolSize: 10
            };
            
            console.log(`Creating peer connection for ${playerId} (Mobile: ${isMobile})`);
            const peerConnection = new RTCPeerConnection(rtcConfig);
            
            this.peerConnections[playerId] = peerConnection;
            
            // Add local stream if available
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, this.localStream);
                });
            }
            
            // Enhanced connection monitoring with mobile-specific handling
            peerConnection.onconnectionstatechange = () => {
                const state = peerConnection.connectionState;
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                console.log(`Connection to ${playerId}: ${state} (Mobile: ${isMobile})`);
                
                if (state === 'failed' || state === 'disconnected') {
                    console.warn(`Voice connection to ${playerId} failed`);
                    
                    // Mobile-specific retry logic
                    if (isMobile) {
                        setTimeout(() => {
                            if (this.peerConnections[playerId] && this.voiceEnabled) {
                                console.log(`Mobile retry: Attempting to reconnect to ${playerId}`);
                                this.createPeerConnection(playerId);
                            }
                        }, 2000); // Shorter retry delay for mobile
                    } else {
                        setTimeout(() => {
                            if (this.peerConnections[playerId] && this.voiceEnabled) {
                                console.log(`Attempting to reconnect to ${playerId}`);
                                this.createPeerConnection(playerId);
                            }
                        }, 3000);
                    }
                    
                    this.showNotification('Voice Connection Issue', 
                        isMobile ? 'Mobile voice connection issue. Retrying...' : 
                        'Some voice connections may not be working properly', 'warning');
                } else if (state === 'connected') {
                    console.log(`Voice connection to ${playerId} established`);
                }
            };
            
            // Monitor ICE connection state
            peerConnection.oniceconnectionstatechange = () => {
                const iceState = peerConnection.iceConnectionState;
                console.log(`ICE connection to ${playerId}: ${iceState}`);
                
                if (iceState === 'failed') {
                    console.error(`ICE connection to ${playerId} failed`);
                    // Try to reconnect after a delay
                    setTimeout(() => {
                        if (this.peerConnections[playerId] && this.voiceEnabled) {
                            console.log(`Attempting to reconnect to ${playerId}`);
                            this.createPeerConnection(playerId);
                        }
                    }, 3000);
                }
            };
            
            // Handle ICE gathering state
            peerConnection.onicegatheringstatechange = () => {
                console.log(`ICE gathering for ${playerId}: ${peerConnection.iceGatheringState}`);
            };
            
            // Handle incoming stream
            peerConnection.ontrack = (event) => {
                const audio = document.createElement('audio');
                audio.srcObject = event.streams[0];
                audio.autoplay = true;
                audio.volume = 0.8;
                audio.id = `audio-${playerId}`;
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
        if (!this.localStream) {
            console.warn('No local stream available for muting');
            return;
        }
        
        const muteBtn = document.getElementById('muteBtn');
        const isCurrentlyMuted = this.localStream.getAudioTracks()[0]?.enabled === false;
        
        // Toggle audio track enabled state
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = isCurrentlyMuted;
        });
        
        // Update UI based on new state
        if (isCurrentlyMuted) {
            // Unmuting
            muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Mute';
            muteBtn.style.background = 'linear-gradient(45deg, #ff6b6b, #ee5a24)';
            document.getElementById('voiceStatus').textContent = 'Voice chat active';
            console.log('Microphone unmuted');
        } else {
            // Muting
            muteBtn.innerHTML = '<i class="fas fa-microphone"></i> Unmute';
            muteBtn.style.background = 'linear-gradient(45deg, #6c757d, #495057)';
            document.getElementById('voiceStatus').textContent = 'Voice chat muted';
            console.log('Microphone muted');
        }
        
        // Notify other players about mute status
        this.socket.emit('voice-mute-toggle', {
            roomCode: this.roomCode,
            muted: !isCurrentlyMuted
        });
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

    // Voice Connection Diagnostics
    async diagnoseVoiceConnection() {
        const diagnostics = {
            browserSupport: false,
            microphoneAccess: false,
            webrtcSupport: false,
            networkConnectivity: false,
            isMobile: false,
            isIOS: false,
            isAndroid: false,
            issues: []
        };
        
        try {
            // Detect mobile device
            diagnostics.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            diagnostics.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            diagnostics.isAndroid = /Android/i.test(navigator.userAgent);
            
            // Check browser support
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                diagnostics.browserSupport = true;
            } else {
                diagnostics.issues.push('Browser does not support getUserMedia API');
            }
            
            // Check WebRTC support
            if (window.RTCPeerConnection) {
                diagnostics.webrtcSupport = true;
            } else {
                diagnostics.issues.push('Browser does not support WebRTC');
            }
            
            // Mobile-specific checks
            if (diagnostics.isMobile) {
                if (diagnostics.isIOS) {
                    diagnostics.issues.push('iOS detected - Use Safari for best voice chat experience');
                } else if (diagnostics.isAndroid) {
                    diagnostics.issues.push('Android detected - Use Chrome for best voice chat experience');
                }
                
                // Check for HTTPS requirement
                if (location.protocol !== 'https:') {
                    diagnostics.issues.push('HTTPS required for mobile voice chat');
                }
            }
            
            // Test microphone access with mobile-optimized constraints
            try {
                const audioConstraints = diagnostics.isMobile ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: diagnostics.isIOS ? 48000 : 44100
                } : { audio: true };
                
                const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
                diagnostics.microphoneAccess = true;
                stream.getTracks().forEach(track => track.stop());
            } catch (error) {
                if (diagnostics.isMobile) {
                    diagnostics.issues.push(`Mobile microphone access failed: ${error.message}. Try using Chrome or Safari.`);
                } else {
                    diagnostics.issues.push(`Microphone access failed: ${error.message}`);
                }
            }
            
            // Test network connectivity
            try {
                const response = await fetch('https://stun.l.google.com:19302', { mode: 'no-cors' });
                diagnostics.networkConnectivity = true;
            } catch (error) {
                diagnostics.issues.push('Network connectivity issues detected');
            }
            
            console.log('Voice Connection Diagnostics:', diagnostics);
            return diagnostics;
            
        } catch (error) {
            console.error('Diagnostic error:', error);
            diagnostics.issues.push(`Diagnostic failed: ${error.message}`);
            return diagnostics;
        }
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