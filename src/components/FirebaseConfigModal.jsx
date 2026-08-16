import React, { useState, useEffect } from "react";
import { initFirebase, isFirebaseConfigured, clearFirebaseConfig } from "../firebase";

export default function FirebaseConfigModal({ isOpen, onClose, onConfigSaved }) {
  const [apiKey, setApiKey] = useState("");
  const [authDomain, setAuthDomain] = useState("");
  const [projectId, setProjectId] = useState("");
  const [storageBucket, setStorageBucket] = useState("");
  const [messagingSenderId, setMessagingSenderId] = useState("");
  const [appId, setAppId] = useState("");

  const [rawJson, setRawJson] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    setIsConfigured(isFirebaseConfigured());
    const saved = localStorage.getItem("firebase_config");
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setApiKey(config.apiKey || "");
        setAuthDomain(config.authDomain || "");
        setProjectId(config.projectId || "");
        setStorageBucket(config.storageBucket || "");
        setMessagingSenderId(config.messagingSenderId || "");
        setAppId(config.appId || "");
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen]);

  // Handle parsing a pasted JS/JSON block from Firebase console
  const handleParseRawJson = () => {
    setError("");
    try {
      // Look for keys and values using a regex if it's a raw js object
      let parsed = {};
      
      // Attempt 1: Direct JSON parsing
      try {
        parsed = JSON.parse(rawJson.trim());
      } catch (jsonErr) {
        // Attempt 2: Regex extraction from Firebase JS SDK config snippet
        const extractKeyVal = (key) => {
          const regex = new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`);
          const match = rawJson.match(regex);
          return match ? match[1] : null;
        };

        parsed = {
          apiKey: extractKeyVal("apiKey"),
          authDomain: extractKeyVal("authDomain"),
          projectId: extractKeyVal("projectId"),
          storageBucket: extractKeyVal("storageBucket"),
          messagingSenderId: extractKeyVal("messagingSenderId"),
          appId: extractKeyVal("appId")
        };
      }

      if (!parsed.apiKey || !parsed.projectId || !parsed.appId) {
        throw new Error("Missing required fields (apiKey, projectId, appId).");
      }

      setApiKey(parsed.apiKey || "");
      setAuthDomain(parsed.authDomain || "");
      setProjectId(parsed.projectId || "");
      setStorageBucket(parsed.storageBucket || "");
      setMessagingSenderId(parsed.messagingSenderId || "");
      setAppId(parsed.appId || "");
      setRawJson("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError("Could not parse config snippet. Ensure it contains apiKey, projectId, and appId.");
    }
  };

  const handleSave = () => {
    setError("");
    if (!apiKey || !projectId || !appId) {
      setError("Please fill out API Key, Project ID, and App ID fields.");
      return;
    }

    const config = {
      apiKey: apiKey.trim(),
      authDomain: authDomain.trim(),
      projectId: projectId.trim(),
      storageBucket: storageBucket.trim(),
      messagingSenderId: messagingSenderId.trim(),
      appId: appId.trim()
    };

    const successInit = initFirebase(config);
    if (successInit) {
      localStorage.setItem("firebase_config", JSON.stringify(config));
      setIsConfigured(true);
      setSuccess(true);
      if (onConfigSaved) onConfigSaved();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } else {
      setError("Firebase initialization failed with this config. Check console for details.");
    }
  };

  const handleClear = () => {
    clearFirebaseConfig();
    setApiKey("");
    setAuthDomain("");
    setProjectId("");
    setStorageBucket("");
    setMessagingSenderId("");
    setAppId("");
    setIsConfigured(false);
    if (onConfigSaved) onConfigSaved();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card">
        <div className="modal-header">
          <h2>Firebase Setup (Online Multiplayer)</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <p className="modal-description">
          To play with friends online, enter your Firebase Web App configuration credentials. 
          If blank, the game falls back to <strong>Practice Mode with Bots</strong>.
        </p>

        {isConfigured && (
          <div className="badge-configured">
            <span className="dot active"></span> Firebase Connected
          </div>
        )}

        <div className="modal-tabs">
          <div className="tab-pane">
            <div className="form-group">
              <label>Paste Firebase Config Snippet (JSON or JS object)</label>
              <textarea
                placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "popquiz-...",\n  appId: "1:..."\n};`}
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                rows={5}
                className="snippet-textarea"
              />
              <button 
                type="button" 
                className="secondary-btn btn-sm" 
                onClick={handleParseRawJson}
                disabled={!rawJson}
              >
                Auto-Parse Snippet
              </button>
            </div>

            <hr className="divider" />

            <div className="form-grid">
              <div className="form-group">
                <label>API Key *</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                />
              </div>
              <div className="form-group">
                <label>Project ID *</label>
                <input
                  type="text"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="popquiz-12345"
                />
              </div>
              <div className="form-group">
                <label>App ID *</label>
                <input
                  type="text"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="1:1234567890:web:abcde..."
                />
              </div>
              <div className="form-group">
                <label>Auth Domain</label>
                <input
                  type="text"
                  value={authDomain}
                  onChange={(e) => setAuthDomain(e.target.value)}
                  placeholder="popquiz-12345.firebaseapp.com"
                />
              </div>
              <div className="form-group">
                <label>Storage Bucket</label>
                <input
                  type="text"
                  value={storageBucket}
                  onChange={(e) => setStorageBucket(e.target.value)}
                  placeholder="popquiz-12345.appspot.com"
                />
              </div>
              <div className="form-group">
                <label>Messaging Sender ID</label>
                <input
                  type="text"
                  value={messagingSenderId}
                  onChange={(e) => setMessagingSenderId(e.target.value)}
                  placeholder="1234567890"
                />
              </div>
            </div>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">Settings Saved Successfully!</div>}

        <div className="modal-actions">
          {isConfigured && (
            <button className="danger-btn" onClick={handleClear}>
              Disconnect Firebase
            </button>
          )}
          <div className="right-actions">
            <button className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-btn" onClick={handleSave}>
              Save Config
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
