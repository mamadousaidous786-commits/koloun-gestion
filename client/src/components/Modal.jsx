import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

// Fenêtre : s'ouvre depuis le bas sur téléphone, au centre sur ordinateur
export default function Modal({ titre, onClose, children, large = false }) {
  useEffect(() => {
    const surEchap = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', surEchap);
    return () => document.removeEventListener('keydown', surEchap);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full ${large ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-base">{titre}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <FiX size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
