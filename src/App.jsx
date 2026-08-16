import React, { useState, useEffect } from "react";
import JoinCreate from "./components/JoinCreate";
import GameRoom from "./components/GameRoom";
import { getDb } from "./firebase";
import { gameService } from "./utils/gameService";

export default function App() {
  const [screen, setScreen] = useState("portal"); // "portal" or "game"
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [username, setUsername] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [globalError, setGlobalError] = useState("");

  useEffect(() => {
    // Generate or load a persistent player ID for this browser tab
    let savedPid = sessionStorage.getItem("popquiz_player_id");
    if (!savedPid) {
      savedPid = crypto.randomUUID();
      sessionStorage.setItem("popquiz_player_id", savedPid);
    }
    setPlayerId(savedPid);

    // Initialize Firebase client on startup if configured
    getDb();
  }, []);

  const handleEnterRoom = async ({ username, action, genres, isOnline, roomId: enteredRoomId }) => {
    setGlobalError("");
    try {
      if (action === "create") {
        const newRoomId = await gameService.createRoom(username, playerId, genres, isOnline);
        setUsername(username);
        setRoomId(newRoomId);
        setIsOnline(isOnline);
        setScreen("game");
      } else if (action === "join") {
        const cleanedRoomId = await gameService.joinRoom(username, enteredRoomId, playerId, isOnline);
        setUsername(username);
        setRoomId(cleanedRoomId);
        setIsOnline(isOnline);
        setScreen("game");
      }
    } catch (err) {
      console.error(err);
      throw new Error(err.message || "Failed to enter room.");
    }
  };

  const handleLeaveRoom = () => {
    setRoomId(null);
    setIsOnline(false);
    setScreen("portal");
  };

  return (
    <main className="app-viewport">
      {screen === "portal" ? (
        <JoinCreate onEnterRoom={handleEnterRoom} />
      ) : (
        <GameRoom
          roomId={roomId}
          playerId={playerId}
          username={username}
          isOnline={isOnline}
          onLeave={handleLeaveRoom}
        />
      )}
    </main>
  );
}
