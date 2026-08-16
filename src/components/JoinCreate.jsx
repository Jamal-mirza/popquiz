import React, { useState, useEffect } from "react";
import { isFirebaseConfigured } from "../firebase";
import FirebaseConfigModal from "./FirebaseConfigModal";

export default function JoinCreate({ onEnterRoom }) {
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [playMode, setPlayMode] = useState("mock"); // "mock" (bots) or "firebase" (online)
  const [selectedGenres, setSelectedGenres] = useState(["pop", "hiphop", "rnb"]);
  
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if Firebase config is present
    const ready = isFirebaseConfigured();
    setFirebaseReady(ready);
    
    // Default to firebase if configured, otherwise fallback to mock bots
    if (ready) {
      setPlayMode("firebase");
    } else {
      setPlayMode("mock");
    }

    // Load last used username if available
    const savedName = localStorage.getItem("popquiz_username");
    if (savedName) {
      setUsername(savedName);
    }
  }, []);

  const toggleGenre = (genre) => {
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length > 1) {
        setSelectedGenres(selectedGenres.filter(g => g !== genre));
      } else {
        setError("You must select at least one music genre.");
        setTimeout(() => setError(""), 3000);
      }
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleCreateRoom = async () => {
    setError("");
    if (!username.trim()) {
      setError("Please enter a nickname first!");
      return;
    }
    
    localStorage.setItem("popquiz_username", username.trim());

    if (playMode === "firebase" && !isFirebaseConfigured()) {
      setError("Firebase is not set up. Please configure Firebase or play with Bots.");
      return;
    }

    try {
      onEnterRoom({
        username: username.trim(),
        action: "create",
        genres: selectedGenres,
        isOnline: playMode === "firebase",
        roomId: null
      });
    } catch (err) {
      setError(err.message || "Failed to create room.");
    }
  };

  const handleJoinRoom = async () => {
    setError("");
    if (!username.trim()) {
      setError("Please enter a nickname first!");
      return;
    }
    if (!roomCode.trim()) {
      setError("Please enter a 6-character room code.");
      return;
    }
    if (roomCode.trim().length !== 6) {
      setError("Room code must be exactly 6 characters.");
      return;
    }

    localStorage.setItem("popquiz_username", username.trim());

    if (playMode === "firebase" && !isFirebaseConfigured()) {
      setError("Firebase is not set up. Please configure Firebase or play with Bots.");
      return;
    }

    try {
      onEnterRoom({
        username: username.trim(),
        action: "join",
        genres: null,
        isOnline: playMode === "firebase",
        roomId: roomCode.trim().toUpperCase()
      });
    } catch (err) {
      setError(err.message || "Failed to join room.");
    }
  };

  return (
    <div className="portal-container">
      {/* Settings Gear for Firebase Setup */}
      <button 
        className="settings-gear-btn" 
        onClick={() => setIsConfigOpen(true)}
        title="Setup Online Multiplayer"
      >
        ⚙️ Setup Online
      </button>

      <div className="logo-section text-center">
        <h1 className="game-title animate-glow">POPQUIZ</h1>
        <p className="game-subtitle">The Ultimate Lyric Completion Game</p>
      </div>

      <div className="portal-card glass-card">
        {error && <div className="error-banner animate-shake">{error}</div>}

        {/* STEP 1: Choose Username */}
        <div className="section-group">
          <label className="section-label">1. Enter Your Nickname</label>
          <input
            type="text"
            className="nickname-input"
            placeholder="e.g. RhythmRider"
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 16))}
          />
        </div>

        {/* STEP 2: Choose Mode */}
        <div className="section-group">
          <label className="section-label">2. Select Game Mode</label>
          <div className="mode-toggle-grid">
            <button
              type="button"
              className={`mode-btn ${playMode === "mock" ? "mode-active" : ""}`}
              onClick={() => setPlayMode("mock")}
            >
              🤖 Practice with Bots
              <span className="mode-subtext">No setup required, instant play</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${playMode === "firebase" ? "mode-active" : ""} ${!firebaseReady ? "mode-disabled" : ""}`}
              onClick={() => {
                if (firebaseReady) {
                  setPlayMode("firebase");
                } else {
                  setIsConfigOpen(true);
                }
              }}
            >
              🌐 Online Multiplayer
              <span className="mode-subtext">
                {firebaseReady ? "Play with friends in real-time" : "Click to setup Firebase first"}
              </span>
            </button>
          </div>
        </div>

        {/* Split layouts: Left to Create, Right to Join */}
        <div className="portal-actions-grid">
          {/* Create Room */}
          <div className="portal-action-column create-column">
            <h3>Create a New Room</h3>
            <label className="column-label">Choose Genres:</label>
            <div className="genre-pill-container">
              <button
                type="button"
                className={`genre-pill genre-pop ${selectedGenres.includes("pop") ? "active" : ""}`}
                onClick={() => toggleGenre("pop")}
              >
                🎈 Pop
              </button>
              <button
                type="button"
                className={`genre-pill genre-hiphop ${selectedGenres.includes("hiphop") ? "active" : ""}`}
                onClick={() => toggleGenre("hiphop")}
              >
                🔥 Hip Hop
              </button>
              <button
                type="button"
                className={`genre-pill genre-rnb ${selectedGenres.includes("rnb") ? "active" : ""}`}
                onClick={() => toggleGenre("rnb")}
              >
                🌌 R&B
              </button>
            </div>
            <button className="primary-btn create-btn w-full" onClick={handleCreateRoom}>
              Create Room
            </button>
          </div>

          <div className="portal-divider-text">OR</div>

          {/* Join Room */}
          <div className="portal-action-column join-column">
            <h3>Join Existing Room</h3>
            <label className="column-label">Enter Room Code:</label>
            <input
              type="text"
              className="code-input"
              placeholder="e.g. XJ74KB"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
            />
            <button className="secondary-btn join-btn w-full" onClick={handleJoinRoom}>
              Join Room
            </button>
          </div>
        </div>
      </div>

      {/* Info Footnote */}
      <footer className="portal-footer">
        <p>Featured Songs from 2009 to 2026. Finish the lyrics to score points!</p>
      </footer>

      {/* Firebase Setup Modal */}
      <FirebaseConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfigSaved={() => setFirebaseReady(isFirebaseConfigured())}
      />
    </div>
  );
}
