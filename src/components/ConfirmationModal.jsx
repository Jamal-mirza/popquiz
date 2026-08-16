import React, { useEffect, useRef } from "react";

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirm", cancelText = "Cancel" }) {
  const modalRef = useRef(null);

  // Close on Escape press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap: focus confirm button when opened
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const confirmButton = modalRef.current.querySelector(".modal-confirm-btn");
      if (confirmButton) {
        confirmButton.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop confirmation-backdrop" onClick={onClose}>
      <div 
        className="modal-content confirmation-card glass-card animate-pop" 
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <h3 id="confirm-title" className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="secondary-btn" onClick={onClose}>
            {cancelText}
          </button>
          <button className="primary-btn danger-btn modal-confirm-btn" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
