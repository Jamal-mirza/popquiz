import React, { useState, useEffect, useRef } from "react";
import { gameService } from "../utils/gameService";
import { lyricsData } from "../data/lyricsData";
import { isWordCorrect, verifyAnswers } from "../utils/spelling";
import LeaderboardChart from "./LeaderboardChart";
import ConfirmationModal from "./ConfirmationModal";

export default function GameRoom({ roomId, playerId, username, isOnline, onLeave }) {
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  
  // Game Play States
  const [userAnswers, setUserAnswers] = useState([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [scoreEarned, setScoreEarned] = useState(0);
  const [timer, setTimer] = useState(30);
  const [showClue, setShowClue] = useState(false);

  // Modals
  const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);

  // Auto-advance count down on Leaderboard screen
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState(8);

  const timerIntervalRef = useRef(null);
  const autoAdvanceIntervalRef = useRef(null);
  const inputRefs = useRef([]);

  const isCreator = room && room.creatorId === playerId;

  // 1. Subscribe to Room and Players
  useEffect(() => {
    const unsubscribeRoom = gameService.listenToRoom(roomId, isOnline, (roomData) => {
      if (!roomData) {
        // Room was deleted or closed
        onLeave();
        return;
      }
      setRoom(roomData);
    });

    const unsubscribePlayers = gameService.listenToPlayers(roomId, isOnline, (playersList) => {
      setPlayers(playersList);
    });

    return () => {
      unsubscribeRoom();
      unsubscribePlayers();
      clearInterval(timerIntervalRef.current);
      clearInterval(autoAdvanceIntervalRef.current);
    };
  }, [roomId, isOnline]);

  // 2. Respond to Room Status Changes
  useEffect(() => {
    if (!room) return;

    if (room.status === "playing") {
      // Fetch current question
      const questionId = room.questionIds[room.currentQuestionIndex];
      const q = lyricsData.find(s => s.id === questionId);
      setCurrentQuestion(q);
      
      // Reset inputs for this round
      if (q) {
        setUserAnswers(Array(q.blankedWords.length).fill(""));
      }
      setHasSubmitted(false);
      setScoreEarned(0);
      setShowClue(false);
      
      // Synchronize timer
      // Compute elapsed time since the server start timestamp
      const start = room.timerStart || Date.now();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(30 - elapsed, 0);
      setTimer(remaining);

      // Start local countdown timer
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            // Handle timeout auto-submission
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Focus first input automatically after render
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 100);

    } else if (room.status === "leaderboard") {
      // Clean up gameplay timers
      clearInterval(timerIntervalRef.current);

      // Set up auto-advance timer on Leaderboard screen (8 seconds)
      setAutoAdvanceTimer(8);
      clearInterval(autoAdvanceIntervalRef.current);
      autoAdvanceIntervalRef.current = setInterval(() => {
        setAutoAdvanceTimer(prev => {
          if (prev <= 1) {
            clearInterval(autoAdvanceIntervalRef.current);
            // If creator, automatically advance to next question or end game
            if (isCreator) {
              handleNextQuestion();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } else {
      // Lobby or Finished
      clearInterval(timerIntervalRef.current);
      clearInterval(autoAdvanceIntervalRef.current);
    }
  }, [room?.status, room?.currentQuestionIndex, isCreator]);

  // 3. Monitor for all players submitted to trigger Leaderboard change (Creator only)
  useEffect(() => {
    if (!room || room.status !== "playing" || !isCreator) return;

    // Check if everyone is submitted (or left)
    const activePlayers = players.filter(p => p.status !== "left");
    const allSubmitted = activePlayers.every(p => p.status === "submitted");

    // Also safety margin: if timer is 0, or if elapsed time exceeds 33s (3s buffer for slow network)
    const start = room.timerStart || Date.now();
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const forceAdvance = elapsed >= 33;

    if (allSubmitted || forceAdvance) {
      gameService.showLeaderboard(roomId, isOnline);
    }
  }, [players, timer, room?.status, isCreator]);

  // Handle auto submit when timer runs out
  const handleAutoSubmit = () => {
    if (hasSubmitted) return;
    submitCurrentAnswers([]); // Submit with empty/partial inputs
  };

  // Submit player answers
  const submitCurrentAnswers = (overrideAnswers = null) => {
    if (hasSubmitted || !currentQuestion) return;
    setHasSubmitted(true);

    const answersToVerify = overrideAnswers || userAnswers;
    const target = currentQuestion.blankedWords;

    // Calculate spelling correctness per word
    const isCorrect = verifyAnswers(answersToVerify, target);
    const points = isCorrect ? 100 : 0;

    setScoreEarned(points);
    gameService.submitAnswers(roomId, playerId, isOnline, isCorrect, points);
  };

  const handleManualSubmit = (e) => {
    if (e) e.preventDefault();
    submitCurrentAnswers();
  };

  const handleInputChange = (index, val) => {
    if (hasSubmitted) return;
    
    const updated = [...userAnswers];
    updated[index] = val;
    setUserAnswers(updated);

    // Update typing status to other players
    if (val.trim()) {
      gameService.updatePlayerStatus(roomId, playerId, isOnline, "typing");
    }
  };

  const handleKeyDown = (index, e) => {
    // Pressing Space or Enter will advance focus to next empty blank input field
    if ((e.key === " " || e.key === "Enter") && index < userAnswers.length - 1) {
      e.preventDefault();
      if (inputRefs.current[index + 1]) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  const handleStartGame = () => {
    if (!isCreator) return;
    gameService.startGame(roomId, isOnline);
  };

  const handleNextQuestion = () => {
    if (!isCreator || !room) return;
    
    const nextIndex = room.currentQuestionIndex + 1;
    const isGameOver = nextIndex >= 20 || nextIndex >= room.questionIds.length;
    gameService.advanceQuestion(roomId, isOnline, nextIndex, isGameOver);
  };

  const handlePlayAgain = () => {
    if (!isCreator || !room) return;
    // Scramble new question IDs
    const newQuestionIds = gameService.generateQuestionIds(room.genres);
    gameService.resetRoom(roomId, isOnline, newQuestionIds);
  };

  const handleLeaveConfirm = () => {
    setIsLeaveConfirmOpen(false);
    gameService.leaveRoom(roomId, playerId, isOnline, isCreator);
    onLeave();
  };

  // Rendering Helper for active question lyrics inline
  const renderLyricsWithBlanks = () => {
    if (!currentQuestion) return null;

    return (
      <div className="lyric-sentence-container">
        <span className="lyric-text">{currentQuestion.lyricPre}</span>
        
        <div className="lyric-blanks-inline">
          {currentQuestion.blankedWords.map((word, idx) => (
            <input
              key={idx}
              ref={el => inputRefs.current[idx] = el}
              type="text"
              className={`lyric-blank-input ${hasSubmitted ? "submitted-lock" : ""}`}
              placeholder={`word ${idx + 1}`}
              value={userAnswers[idx] || ""}
              onChange={(e) => handleInputChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              disabled={hasSubmitted}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck="false"
              id={`blank-input-${idx}`}
            />
          ))}
        </div>
        
        <span className="lyric-text">{currentQuestion.lyricPost}</span>
      </div>
    );
  };

  if (!room) {
    return (
      <div className="loading-container text-center">
        <div className="spinner"></div>
        <p>Connecting to room...</p>
      </div>
    );
  }

  // ==================== VIEW 1: LOBBY ====================
  if (room.status === "lobby") {
    return (
      <div className="room-container lobby-view glass-card">
        <div className="room-header">
          <div className="room-badge">
            {isOnline ? "🌐 Online Room" : "🤖 practice room"}
          </div>
          <button className="leave-room-btn" onClick={() => setIsLeaveConfirmOpen(true)}>
            Leave Room
          </button>
        </div>

        <div className="code-display-section text-center">
          <p className="code-label">Share this code with friends:</p>
          <div className="code-number animate-pulse">{room.id}</div>
        </div>

        <div className="lobby-details-grid">
          {/* Joined Players */}
          <div className="lobby-players-section">
            <h3>Players ({players.filter(p => p.status !== "left").length})</h3>
            <div className="players-list">
              {players.filter(p => p.status !== "left").map(player => (
                <div key={player.id} className="player-lobby-item animate-pop">
                  <div className="player-avatar-placeholder">🎵</div>
                  <div className="player-lobby-name">
                    {player.name} {player.isBot && <span className="bot-tag">BOT</span>}
                    {player.id === room.creatorId && <span className="creator-tag">Host</span>}
                  </div>
                  <div className="player-lobby-status">Joined</div>
                </div>
              ))}
            </div>
          </div>

          {/* Room Settings Info */}
          <div className="lobby-settings-section">
            <h3>Game Rules</h3>
            <ul className="rules-list">
              <li><strong>Rounds:</strong> 20 Questions</li>
              <li><strong>Timer:</strong> 30 seconds per lyric</li>
              <li><strong>Genres:</strong> {room.genres ? room.genres.map(g => g.toUpperCase()).join(", ") : "All"}</li>
              <li><strong>Points:</strong> +100 for correct, +0 for incorrect</li>
              <li><strong>Typo Help:</strong> 75% similarity accepted!</li>
            </ul>

            {isCreator ? (
              <button className="primary-btn start-game-btn w-full" onClick={handleStartGame}>
                Start Game
              </button>
            ) : (
              <div className="waiting-host-banner">
                Waiting for host to start the game...
              </div>
            )}
          </div>
        </div>

        <ConfirmationModal
          isOpen={isLeaveConfirmOpen}
          onClose={() => setIsLeaveConfirmOpen(false)}
          onConfirm={handleLeaveConfirm}
          title="Leave Room?"
          message="Are you sure you want to leave this lobby?"
          confirmText="Yes, Leave"
        />
      </div>
    );
  }

  // ==================== VIEW 2: PLAYING ====================
  if (room.status === "playing") {
    // Current human player object
    const selfPlayerObj = players.find(p => p.id === playerId);
    const selfStatus = selfPlayerObj?.status || "idle";

    return (
      <div className="room-container playing-view glass-card">
        {/* Progress Bar & Header */}
        <div className="game-top-bar">
          <div className="question-count">
            Question {room.currentQuestionIndex + 1} of 20
          </div>
          <button className="leave-room-btn-playing" onClick={() => setIsLeaveConfirmOpen(true)}>
            Exit
          </button>
        </div>

        {/* 30s Timer Bar */}
        <div className="timer-wrapper">
          <div 
            className={`timer-bar ${timer < 7 ? "timer-low" : timer < 15 ? "timer-medium" : ""}`}
            style={{ width: `${(timer / 30) * 100}%` }}
          ></div>
          <span className="timer-seconds">{timer}s</span>
        </div>

        {/* Category & Artist details */}
        {currentQuestion && (
          <div className="song-card animate-pop">
            <div className="song-meta">
              <span className="badge-genre">{currentQuestion.genre.toUpperCase()}</span>
              <span className="badge-year">{currentQuestion.year}</span>
            </div>
            <h2 className="song-title">Can you complete the lyric?</h2>
            <p className="song-details-sub text-center">
              Artist: <strong>{currentQuestion.artist}</strong> | Title: <strong>{currentQuestion.song}</strong>
            </p>
          </div>
        )}

        {/* LYRICS CONTAINER */}
        <form onSubmit={handleManualSubmit} className="lyrics-form">
          {renderLyricsWithBlanks()}

          {/* CLUE DRAWER */}
          <div className="clue-section">
            {showClue ? (
              <p className="clue-text animate-fade">💡 Clue: {currentQuestion?.hint}</p>
            ) : (
              <button 
                type="button" 
                className="secondary-btn btn-sm" 
                onClick={() => setShowClue(true)}
              >
                Reveal Clue
              </button>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="submit-section text-center">
            {hasSubmitted ? (
              <div className="submitted-banner animate-pulse">
                Answers Submitted! Waiting for other players...
              </div>
            ) : (
              <button type="submit" className="primary-btn submit-lyrics-btn">
                Submit Answer
              </button>
            )}
          </div>
        </form>

        {/* Real-time Multiplayer Status Grid */}
        <div className="multiplayer-status-grid">
          <h4>Player Statuses:</h4>
          <div className="player-status-chips">
            {players.filter(p => p.status !== "left").map(p => (
              <div key={p.id} className={`status-chip chip-${p.status}`}>
                <span className="status-dot"></span>
                <span className="chip-name">{p.name}</span>
                <span className="chip-action-text">
                  {p.status === "typing" ? "Typing..." : p.status === "submitted" ? "Ready" : "Thinking..."}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ConfirmationModal
          isOpen={isLeaveConfirmOpen}
          onClose={() => setIsLeaveConfirmOpen(false)}
          onConfirm={handleLeaveConfirm}
          title="Quit Active Game?"
          message="Are you sure you want to quit the game? Your score will be lost."
          confirmText="Quit Game"
        />
      </div>
    );
  }

  // ==================== VIEW 3: ROUND LEADERBOARD ====================
  if (room.status === "leaderboard") {
    // Find correct answer details
    const questionId = room.questionIds[room.currentQuestionIndex];
    const q = lyricsData.find(s => s.id === questionId);

    return (
      <div className="room-container leaderboard-view glass-card text-center">
        <h2 className="section-title">Round Results</h2>
        
        {/* Correct lyric reveal */}
        {q && (
          <div className="answer-reveal-card animate-pop">
            <p className="reveal-label">Correct Lyric Words:</p>
            <div className="reveal-words">
              {q.blankedWords.map((word, idx) => (
                <span key={idx} className="reveal-word-pill">{word}</span>
              ))}
            </div>
            <p className="full-lyric-preview">
              "... {q.lyricPre} <strong>{q.blankedWords.join(" ")}</strong> {q.lyricPost} ..."
            </p>
          </div>
        )}

        <hr className="divider" />

        {/* CUSTOM CSS BAR CHART */}
        <h3 className="leaderboard-title">Current Leaderboard</h3>
        <LeaderboardChart players={players} />

        {/* AUTO ADVANCE BANNER */}
        <div className="leaderboard-footer">
          {isCreator ? (
            <div className="creator-advance-actions">
              <button className="primary-btn advance-btn" onClick={handleNextQuestion}>
                Next Question
              </button>
              <p className="advance-subtext">Auto-advancing in {autoAdvanceTimer}s...</p>
            </div>
          ) : (
            <div className="player-advance-actions">
              <p className="advance-subtext">Waiting for host. Next round in {autoAdvanceTimer}s...</p>
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={isLeaveConfirmOpen}
          onClose={() => setIsLeaveConfirmOpen(false)}
          onConfirm={handleLeaveConfirm}
          title="Leave Game?"
          message="Are you sure you want to leave? Your score will be lost."
          confirmText="Leave"
        />
      </div>
    );
  }

  // ==================== VIEW 4: GAME OVER ====================
  if (room.status === "finished") {
    // Sort players to find the winner
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const winner = sorted[0];

    return (
      <div className="room-container gameover-view glass-card text-center animate-fade">
        <div className="celebration-header">
          <div className="trophy-emoji animate-bounce">🏆</div>
          <h1 className="game-title">GAME OVER!</h1>
          {winner && (
            <h2 className="winner-declaration">
              Winner: <span>{winner.name}</span> with {winner.score} pts!
            </h2>
          )}
        </div>

        <hr className="divider" />

        {/* Custom CSS Bar Chart for final standings */}
        <h3 className="leaderboard-title">Final Standings</h3>
        <LeaderboardChart players={players} />

        {/* FINAL ACTIONS */}
        <div className="game-over-actions">
          {isCreator ? (
            <button className="primary-btn play-again-btn" onClick={handlePlayAgain}>
              Play Again (Reset Game)
            </button>
          ) : (
            <div className="waiting-host-playagain animate-pulse">
              Waiting for host to restart game...
            </div>
          )}
          <button className="secondary-btn leave-final-btn" onClick={() => setIsLeaveConfirmOpen(true)}>
            Leave Room
          </button>
        </div>

        <ConfirmationModal
          isOpen={isLeaveConfirmOpen}
          onClose={() => setIsLeaveConfirmOpen(false)}
          onConfirm={handleLeaveConfirm}
          title="Leave Room?"
          message="Leave the room and return to the main menu?"
          confirmText="Leave Room"
        />
      </div>
    );
  }

  return null;
}
