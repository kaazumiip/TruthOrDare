const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory storage for rooms and questions
const rooms = new Map();
const questions = {
  truth: [
    "What's the most embarrassing thing you've ever done?",
    "If you could be invisible for a day, what would you do?",
    "What's your biggest fear?",
    "Who was your first crush?",
    "What's the worst lie you've ever told?",
    "If you could change one thing about yourself, what would it be?",
    "What's the most childish thing you still do?",
    "What's your most embarrassing nickname?",
    "What's the weirdest dream you've ever had?",
    "If you could ask anyone one question, who would it be and what would you ask?",
    "What's the most expensive thing you've ever broken?",
    "What's your most embarrassing social media post?",
    "What's the weirdest food combination you actually enjoy?",
    "What's the most ridiculous thing you've ever cried about?",
    "What's your most embarrassing autocorrect fail?"
  ],
  dare: [
    "Do 20 jumping jacks",
    "Sing your favorite song out loud",
    "Do your best impression of a celebrity",
    "Dance for 30 seconds without music",
    "Tell a joke and make everyone laugh",
    "Do 10 push-ups",
    "Speak in an accent for the next 3 rounds",
    "Do a cartwheel or handstand",
    "Call someone and sing 'Happy Birthday' to them",
    "Do your best animal impression",
    "Do 15 squats",
    "Sing the alphabet backwards",
    "Do a TikTok dance",
    "Speak only in rhymes for the next 2 rounds",
    "Do 10 burpees",
    "Imitate everyone in the room for 1 minute"
  ]
};

// Room management
class Room {
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    this.players = new Map();
    this.gameStarted = false;
    this.currentPlayerIndex = 0;
    this.currentQuestion = null;
    this.questionType = null;
    this.usedQuestions = new Set();
  }

  addPlayer(socketId, playerName) {
    this.players.set(socketId, {
      id: socketId,
      name: playerName,
      isHost: socketId === this.hostId,
      score: 0
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (socketId === this.hostId && this.players.size > 0) {
      // Transfer host to another player
      const newHost = this.players.keys().next().value;
      this.hostId = newHost;
      this.players.get(newHost).isHost = true;
    }
  }

  getPlayerList() {
    return Array.from(this.players.values());
  }

  getCurrentPlayer() {
    const playerList = this.getPlayerList();
    return playerList[this.currentPlayerIndex] || null;
  }

  nextPlayer() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.size;
    this.currentQuestion = null;
    this.questionType = null;
  }

  getRandomQuestion(type) {
    const availableQuestions = questions[type].filter(q => !this.usedQuestions.has(q));
    if (availableQuestions.length === 0) {
      // Reset used questions if all have been used
      this.usedQuestions.clear();
      return questions[type][Math.floor(Math.random() * questions[type].length)];
    }
    const question = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    this.usedQuestions.add(question);
    return question;
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create room
  socket.on('create-room', (data) => {
    const roomCode = generateRoomCode();
    const room = new Room(roomCode, socket.id);
    room.addPlayer(socket.id, data.playerName);
    rooms.set(roomCode, room);
    
    socket.join(roomCode);
    socket.emit('room-created', { roomCode, playerName: data.playerName });
    console.log(`Room created: ${roomCode} by ${data.playerName}`);
  });

  // Join room
  socket.on('join-room', (data) => {
    const { roomCode, playerName } = data;
    console.log(`Attempting to join room: ${roomCode}`);
    console.log(`Available rooms:`, Array.from(rooms.keys()));
    const room = rooms.get(roomCode);
    
    if (!room) {
      console.log(`Room ${roomCode} not found in rooms map`);
      socket.emit('room-error', { message: 'Room not found' });
      return;
    }
    
    if (room.gameStarted) {
      socket.emit('room-error', { message: 'Game has already started' });
      return;
    }
    
    room.addPlayer(socket.id, playerName);
    socket.join(roomCode);
    
    // Notify all players in the room
    io.to(roomCode).emit('player-joined', {
      player: { id: socket.id, name: playerName, isHost: false },
      players: room.getPlayerList()
    });
    
    socket.emit('room-joined', { roomCode, players: room.getPlayerList() });
    console.log(`${playerName} joined room ${roomCode}`);
  });

 // Start game
socket.on('start-game', (data) => {
  const room = rooms.get(data.roomCode);
  if (!room || socket.id !== room.hostId) return;

  // Store game rules if provided
  if (data.rules) {
    room.gameRules = data.rules;
  }

  // mark game started
  room.gameStarted = true;

  // Set the first player as current player
  const playerList = room.getPlayerList();
  if (playerList.length > 0) {
    room.currentPlayerIndex = 0;
  }
  
  const currentPlayer = room.getCurrentPlayer();

  io.to(data.roomCode).emit('game-started', {
    currentPlayer: currentPlayer,
    players: room.getPlayerList(),
    rules: room.gameRules || {}
  });

  console.log(`Game started in room ${data.roomCode} with current player:`, currentPlayer);
});


  // Select truth or dare
  socket.on('select-challenge', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room || !room.gameStarted) return;
    
    const currentPlayer = room.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) return;
    
    const question = room.getRandomQuestion(data.type);
    room.currentQuestion = question;
    room.questionType = data.type;
    
    io.to(data.roomCode).emit('challenge-selected', {
      type: data.type,
      question: question,
      player: currentPlayer
    });
  });

  // Next player
  socket.on('next-player', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room || !room.gameStarted) return;
    
    const currentPlayer = room.getCurrentPlayer();
    if (currentPlayer.id !== socket.id) return;
    
    room.nextPlayer();
    io.to(data.roomCode).emit('player-changed', {
      currentPlayer: room.getCurrentPlayer(),
      players: room.getPlayerList()
    });
  });

  // Chat message
  socket.on('chat-message', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player) return;
    
    io.to(data.roomCode).emit('chat-message', {
      player: player.name,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });

  // Voice toggle
  socket.on('voice-toggle', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player) return;
    
    // Update player's voice status
    player.voiceEnabled = data.enabled;
    player.selectiveVoiceMode = data.selectiveMode || false;
    
    io.to(data.roomCode).emit('voice-status', {
      player: player.name,
      enabled: data.enabled,
      selectiveMode: data.selectiveMode || false
    });
  });

  // Voice mute toggle
  socket.on('voice-mute-toggle', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player) return;
    
    // Update player's mute status
    player.voiceMuted = data.muted;
    
    io.to(data.roomCode).emit('voice-mute-status', {
      player: player.name,
      muted: data.muted
    });
  });

  // Kick player (host only)
  socket.on('kick-player', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room || socket.id !== room.hostId) return;
    
    const targetPlayer = Array.from(room.players.values())
      .find(p => p.name === data.playerName && !p.isHost);
    
    if (targetPlayer) {
      const targetSocket = io.sockets.sockets.get(targetPlayer.id);
      if (targetSocket) {
        targetSocket.emit('kicked', { reason: 'Kicked by host' });
        targetSocket.disconnect();
      }
      
      room.removePlayer(targetPlayer.id);
      io.to(data.roomCode).emit('player-left', {
        player: data.playerName,
        players: room.getPlayerList()
      });
      
      console.log(`Player ${data.playerName} kicked from room ${data.roomCode}`);
    }
  });

  // Transfer host (host only)
  socket.on('transfer-host', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room || socket.id !== room.hostId) return;
    
    const newHost = Array.from(room.players.values())
      .find(p => p.name === data.playerName && !p.isHost);
    
    if (newHost) {
      // Update host status
      room.players.get(socket.id).isHost = false;
      room.players.get(newHost.id).isHost = true;
      room.hostId = newHost.id;
      
      io.to(data.roomCode).emit('host-transferred', {
        newHost: data.playerName,
        players: room.getPlayerList()
      });
      
      console.log(`Host transferred to ${data.playerName} in room ${data.roomCode}`);
    }
  });

  // Rules updated
  socket.on('rules-updated', (data) => {
    const room = rooms.get(data.roomCode);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player || !player.isHost) return;
    
    // Update room rules
    room.gameRules = data.rules;
    
    // Notify all players
    io.to(data.roomCode).emit('rules-updated', {
      rules: data.rules,
      updatedBy: player.name
    });
    
    console.log(`Rules updated in room ${data.roomCode} by ${player.name}`);
  });

  // WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    socket.to(data.to).emit('webrtc-offer', {
      from: socket.id,
      offer: data.offer
    });
  });

  socket.on('webrtc-answer', (data) => {
    socket.to(data.to).emit('webrtc-answer', {
      from: socket.id,
      answer: data.answer
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    socket.to(data.to).emit('webrtc-ice-candidate', {
      from: socket.id,
      candidate: data.candidate
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Find and remove player from room
    for (const [roomCode, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        room.removePlayer(socket.id);
        
        if (room.players.size === 0) {
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} deleted (no players)`);
        } else {
          io.to(roomCode).emit('player-left', {
            player: player.name,
            players: room.getPlayerList()
          });
        }
        break;
      }
    }
  });
});

// Generate unique room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

// API endpoints for question management
app.get('/api/questions', (req, res) => {
  res.json(questions);
});

app.post('/api/questions/truth', (req, res) => {
  const { question } = req.body;
  if (question && question.trim()) {
    questions.truth.push(question.trim());
    res.json({ success: true, message: 'Truth question added' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid question' });
  }
});

app.post('/api/questions/dare', (req, res) => {
  const { question } = req.body;
  if (question && question.trim()) {
    questions.dare.push(question.trim());
    res.json({ success: true, message: 'Dare question added' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid question' });
  }
});

app.delete('/api/questions/truth/:index', (req, res) => {
  const index = parseInt(req.params.index);
  if (index >= 0 && index < questions.truth.length) {
    questions.truth.splice(index, 1);
    res.json({ success: true, message: 'Truth question deleted' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid index' });
  }
});

app.delete('/api/questions/dare/:index', (req, res) => {
  const index = parseInt(req.params.index);
  if (index >= 0 && index < questions.dare.length) {
    questions.dare.splice(index, 1);
    res.json({ success: true, message: 'Dare question deleted' });
  } else {
    res.status(400).json({ success: false, message: 'Invalid index' });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
});
