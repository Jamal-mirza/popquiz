import { getDb } from "../firebase";
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  getDocs, 
  writeBatch, 
  deleteDoc 
} from "firebase/firestore";
import { lyricsData } from "../data/lyricsData";

// Generate a random 6-character room code
export function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No confusing chars (I, O, 0, 1)
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate 20 random question IDs based on selected genres
export function generateQuestionIds(selectedGenres) {
  const filtered = lyricsData.filter(song => selectedGenres.includes(song.genre));
  const pool = filtered.length >= 20 ? filtered : lyricsData; // Fallback if not enough matching
  
  // Shuffle and pick 20
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 20).map(s => s.id);
}

// SIMULATED MOCK DATABASE STATE (For Offline / Bot Mode)
let mockRoomData = null;
let mockPlayersData = {}; // playerId -> playerObj
let mockRoomListeners = [];
let mockPlayersListeners = [];
let botSimulationIntervals = [];

function notifyMockRoomListeners() {
  mockRoomListeners.forEach(cb => cb(mockRoomData ? { ...mockRoomData } : null));
}

function notifyMockPlayersListeners() {
  const playersList = Object.values(mockPlayersData).sort((a, b) => a.joinedAt - b.joinedAt);
  mockPlayersListeners.forEach(cb => cb(playersList));
}

// Clean up bot simulation timers
function clearBotSimulation() {
  botSimulationIntervals.forEach(clearInterval);
  botSimulationIntervals = [];
}

// Simulated Bot actions
function runBotSimulation(roomId) {
  clearBotSimulation();

  if (!mockRoomData || mockRoomData.status !== "playing") return;

  const currentQuestionIdx = mockRoomData.currentQuestionIndex;
  const questionIds = mockRoomData.questionIds;
  const currentQuestion = lyricsData.find(s => s.id === questionIds[currentQuestionIdx]);

  const bots = Object.values(mockPlayersData).filter(p => p.isBot);

  bots.forEach(bot => {
    // Modify status to 'typing' after random delay (1 to 4 seconds)
    const typingTimeout = setTimeout(() => {
      if (mockRoomData && mockRoomData.status === "playing" && mockRoomData.currentQuestionIndex === currentQuestionIdx) {
        mockPlayersData[bot.id].status = "typing";
        notifyMockPlayersListeners();
      }
    }, 1000 + Math.random() * 3000);

    // Submit answer after typing delay (4 to 12 seconds)
    const submitTimeout = setTimeout(() => {
      if (mockRoomData && mockRoomData.status === "playing" && mockRoomData.currentQuestionIndex === currentQuestionIdx) {
        // Probability of getting answer correct depends on genre & random choice
        // Let's say bots are pretty good but not perfect (60-80% success)
        const isCorrect = Math.random() < 0.70;
        
        mockPlayersData[bot.id].status = "submitted";
        mockPlayersData[bot.id].currentRoundAnswer = isCorrect;
        mockPlayersData[bot.id].score += isCorrect ? 100 : 0;
        
        notifyMockPlayersListeners();
        
        // Check if all players (including human) have submitted
        checkAndTriggerMockLeaderboard();
      }
    }, 5000 + Math.random() * 7000);

    botSimulationIntervals.push(typingTimeout, submitTimeout);
  });
}

function checkAndTriggerMockLeaderboard() {
  if (!mockRoomData) return;
  const players = Object.values(mockPlayersData);
  const allSubmitted = players.every(p => p.status === "submitted" || p.status === "left");
  
  if (allSubmitted && mockRoomData.status === "playing") {
    clearBotSimulation();
    mockRoomData.status = "leaderboard";
    notifyMockRoomListeners();
  }
}

// PUBLIC UNIFIED SERVICE INTERFACE
export const gameService = {
  // CREATE ROOM
  async createRoom(username, playerId, selectedGenres, isOnline) {
    const roomId = generateRoomCode();
    const questionIds = generateQuestionIds(selectedGenres);

    if (isOnline) {
      const db = getDb();
      if (!db) throw new Error("Firebase database not initialized. Configure Firebase first.");

      const roomRef = doc(db, "rooms", roomId);
      await setDoc(roomRef, {
        id: roomId,
        creatorId: playerId,
        status: "lobby",
        genres: selectedGenres,
        questionIds: questionIds,
        currentQuestionIndex: 0,
        timerStart: null,
        updatedAt: new Date()
      });

      const playerRef = doc(db, "rooms", roomId, "players", playerId);
      await setDoc(playerRef, {
        id: playerId,
        name: username.trim(),
        score: 0,
        status: "idle",
        currentRoundAnswer: null,
        joinedAt: new Date(),
        isBot: false
      });

      return roomId;
    } else {
      // Mock mode initialization
      clearBotSimulation();
      mockRoomData = {
        id: roomId,
        creatorId: playerId,
        status: "lobby",
        genres: selectedGenres,
        questionIds: questionIds,
        currentQuestionIndex: 0,
        timerStart: null,
        updatedAt: new Date()
      };

      mockPlayersData = {};
      mockPlayersData[playerId] = {
        id: playerId,
        name: username.trim(),
        score: 0,
        status: "idle",
        currentRoundAnswer: null,
        joinedAt: new Date(),
        isBot: false
      };

      // Add two bots automatically to make lobby feel like a multiplayer room
      const bot1Id = "bot-1";
      const bot2Id = "bot-2";
      mockPlayersData[bot1Id] = {
        id: bot1Id,
        name: "LyricalWizard",
        score: 0,
        status: "idle",
        currentRoundAnswer: null,
        joinedAt: new Date(Date.now() + 100),
        isBot: true
      };
      mockPlayersData[bot2Id] = {
        id: bot2Id,
        name: "VibeMaster",
        score: 0,
        status: "idle",
        currentRoundAnswer: null,
        joinedAt: new Date(Date.now() + 200),
        isBot: true
      };

      return roomId;
    }
  },

  // JOIN ROOM
  async joinRoom(username, roomId, playerId, isOnline) {
    const cleanedRoomId = roomId.trim().toUpperCase();

    if (isOnline) {
      const db = getDb();
      if (!db) throw new Error("Firebase database not initialized.");

      const roomRef = doc(db, "rooms", cleanedRoomId);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        throw new Error("Room code not found. Please double check the code.");
      }

      const room = roomSnap.data();
      if (room.status !== "lobby") {
        throw new Error("The game in this room has already started!");
      }

      const playerRef = doc(db, "rooms", cleanedRoomId, "players", playerId);
      await setDoc(playerRef, {
        id: playerId,
        name: username.trim(),
        score: 0,
        status: "idle",
        currentRoundAnswer: null,
        joinedAt: new Date(),
        isBot: false
      });

      return cleanedRoomId;
    } else {
      // Mock mode join
      if (!mockRoomData || mockRoomData.id !== cleanedRoomId) {
        throw new Error("Room code not found in offline mode.");
      }
      if (mockRoomData.status !== "lobby") {
        throw new Error("Game has already started.");
      }

      mockPlayersData[playerId] = {
        id: playerId,
        name: username.trim(),
        score: 0,
        status: "idle",
        currentRoundAnswer: null,
        joinedAt: new Date(),
        isBot: false
      };

      notifyMockPlayersListeners();
      return cleanedRoomId;
    }
  },

  // SUBSCRIBE TO ROOM UPDATE
  listenToRoom(roomId, isOnline, callback) {
    if (isOnline) {
      const db = getDb();
      if (!db) return () => {};

      return onSnapshot(doc(db, "rooms", roomId), (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data());
        } else {
          callback(null);
        }
      });
    } else {
      mockRoomListeners.push(callback);
      // Immediate push
      callback(mockRoomData);
      return () => {
        mockRoomListeners = mockRoomListeners.filter(cb => cb !== callback);
      };
    }
  },

  // SUBSCRIBE TO PLAYERS LIST
  listenToPlayers(roomId, isOnline, callback) {
    if (isOnline) {
      const db = getDb();
      if (!db) return () => {};

      const playersColl = collection(db, "rooms", roomId, "players");
      return onSnapshot(playersColl, (snap) => {
        const list = [];
        snap.forEach((doc) => {
          list.push(doc.data());
        });
        // Sort by joinedAt to keep order stable
        list.sort((a, b) => {
          const t1 = a.joinedAt?.seconds ? a.joinedAt.seconds * 1000 : new Date(a.joinedAt).getTime();
          const t2 = b.joinedAt?.seconds ? b.joinedAt.seconds * 1000 : new Date(b.joinedAt).getTime();
          return t1 - t2;
        });
        callback(list);
      });
    } else {
      mockPlayersListeners.push(callback);
      // Immediate push
      const list = Object.values(mockPlayersData).sort((a, b) => a.joinedAt - b.joinedAt);
      callback(list);
      return () => {
        mockPlayersListeners = mockPlayersListeners.filter(cb => cb !== callback);
      };
    }
  },

  // SUBMIT PLAYER ANSWERS
  async submitAnswers(roomId, playerId, isOnline, isCorrect, scoreEarned) {
    if (isOnline) {
      const db = getDb();
      if (!db) return;

      const playerRef = doc(db, "rooms", roomId, "players", playerId);
      const playerSnap = await getDoc(playerRef);
      if (playerSnap.exists()) {
        const currentScore = playerSnap.data().score || 0;
        await updateDoc(playerRef, {
          status: "submitted",
          currentRoundAnswer: isCorrect,
          score: currentScore + scoreEarned
        });
      }
    } else {
      // Mock mode submit
      if (mockPlayersData[playerId]) {
        mockPlayersData[playerId].status = "submitted";
        mockPlayersData[playerId].currentRoundAnswer = isCorrect;
        mockPlayersData[playerId].score += scoreEarned;
        notifyMockPlayersListeners();
        checkAndTriggerMockLeaderboard();
      }
    }
  },

  // UPDATE NICKNAME STATUS (e.g. typing)
  async updatePlayerStatus(roomId, playerId, isOnline, status) {
    if (isOnline) {
      const db = getDb();
      if (!db) return;
      await updateDoc(doc(db, "rooms", roomId, "players", playerId), { status });
    } else {
      if (mockPlayersData[playerId] && mockPlayersData[playerId].status !== "submitted") {
        mockPlayersData[playerId].status = status;
        notifyMockPlayersListeners();
      }
    }
  },

  // START GAME
  async startGame(roomId, isOnline) {
    if (isOnline) {
      const db = getDb();
      if (!db) return;

      const batch = writeBatch(db);
      
      // Update room state
      batch.update(doc(db, "rooms", roomId), {
        status: "playing",
        currentQuestionIndex: 0,
        timerStart: Date.now(),
        updatedAt: new Date()
      });

      // Fetch and reset players
      const playersSnap = await getDocs(collection(db, "rooms", roomId, "players"));
      playersSnap.forEach(pDoc => {
        batch.update(doc(db, "rooms", roomId, "players", pDoc.id), {
          status: "idle",
          currentRoundAnswer: null,
          score: 0 // Reset scores to 0 when starting fresh
        });
      });

      await batch.commit();
    } else {
      clearBotSimulation();
      mockRoomData.status = "playing";
      mockRoomData.currentQuestionIndex = 0;
      mockRoomData.timerStart = Date.now();
      
      Object.keys(mockPlayersData).forEach(id => {
        mockPlayersData[id].status = "idle";
        mockPlayersData[id].currentRoundAnswer = null;
        mockPlayersData[id].score = 0;
      });

      notifyMockRoomListeners();
      notifyMockPlayersListeners();
      runBotSimulation(roomId);
    }
  },

  // MANUALLY TRIGGER LEADERBOARD TRANSITION
  async showLeaderboard(roomId, isOnline) {
    if (isOnline) {
      const db = getDb();
      if (!db) return;
      
      await updateDoc(doc(db, "rooms", roomId), {
        status: "leaderboard"
      });
    } else {
      clearBotSimulation();
      if (mockRoomData) {
        mockRoomData.status = "leaderboard";
        notifyMockRoomListeners();
      }
    }
  },

  // ADVANCE TO NEXT QUESTION
  async advanceQuestion(roomId, isOnline, nextQuestionIndex, isGameOver) {
    if (isOnline) {
      const db = getDb();
      if (!db) return;

      const batch = writeBatch(db);

      if (isGameOver) {
        batch.update(doc(db, "rooms", roomId), {
          status: "finished",
          updatedAt: new Date()
        });
      } else {
        batch.update(doc(db, "rooms", roomId), {
          status: "playing",
          currentQuestionIndex: nextQuestionIndex,
          timerStart: Date.now(),
          updatedAt: new Date()
        });

        // Reset player round statuses
        const playersSnap = await getDocs(collection(db, "rooms", roomId, "players"));
        playersSnap.forEach(pDoc => {
          batch.update(doc(db, "rooms", roomId, "players", pDoc.id), {
            status: "idle",
            currentRoundAnswer: null
          });
        });
      }

      await batch.commit();
    } else {
      clearBotSimulation();
      if (isGameOver) {
        mockRoomData.status = "finished";
        notifyMockRoomListeners();
      } else {
        mockRoomData.status = "playing";
        mockRoomData.currentQuestionIndex = nextQuestionIndex;
        mockRoomData.timerStart = Date.now();

        Object.keys(mockPlayersData).forEach(id => {
          if (mockPlayersData[id].status !== "left") {
            mockPlayersData[id].status = "idle";
            mockPlayersData[id].currentRoundAnswer = null;
          }
        });

        notifyMockRoomListeners();
        notifyMockPlayersListeners();
        runBotSimulation(roomId);
      }
    }
  },

  // RESET ROOM FOR A NEW PLAY-AGAIN ROUND
  async resetRoom(roomId, isOnline, newQuestionIds) {
    if (isOnline) {
      const db = getDb();
      if (!db) return;

      const batch = writeBatch(db);
      
      batch.update(doc(db, "rooms", roomId), {
        status: "lobby",
        currentQuestionIndex: 0,
        questionIds: newQuestionIds,
        timerStart: null,
        updatedAt: new Date()
      });

      const playersSnap = await getDocs(collection(db, "rooms", roomId, "players"));
      playersSnap.forEach(pDoc => {
        batch.update(doc(db, "rooms", roomId, "players", pDoc.id), {
          status: "idle",
          currentRoundAnswer: null,
          score: 0
        });
      });

      await batch.commit();
    } else {
      clearBotSimulation();
      mockRoomData.status = "lobby";
      mockRoomData.currentQuestionIndex = 0;
      mockRoomData.questionIds = newQuestionIds;
      mockRoomData.timerStart = null;

      Object.keys(mockPlayersData).forEach(id => {
        mockPlayersData[id].status = "idle";
        mockPlayersData[id].currentRoundAnswer = null;
        mockPlayersData[id].score = 0;
      });

      notifyMockRoomListeners();
      notifyMockPlayersListeners();
    }
  },

  // LEAVE ROOM
  async leaveRoom(roomId, playerId, isOnline, isCreator) {
    if (isOnline) {
      const db = getDb();
      if (!db) return;

      const playerRef = doc(db, "rooms", roomId, "players", playerId);
      await deleteDoc(playerRef);

      // If creator leaves, we close the room by deleting it, or changing status
      if (isCreator) {
        await updateDoc(doc(db, "rooms", roomId), {
          status: "finished",
          creatorLeft: true
        });
      }
    } else {
      clearBotSimulation();
      if (mockPlayersData[playerId]) {
        if (isCreator) {
          // Reset mock room
          mockRoomData = null;
          mockPlayersData = {};
          notifyMockRoomListeners();
          notifyMockPlayersListeners();
        } else {
          mockPlayersData[playerId].status = "left";
          notifyMockPlayersListeners();
          checkAndTriggerMockLeaderboard();
        }
      }
    }
  }
};
