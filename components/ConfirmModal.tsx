import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-slate-100">
        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic mb-4">{title}</h3>
        <div className="text-slate-600 font-medium mb-8 leading-relaxed">{message}</div>
        <div className="flex justify-end gap-4">
          <button 
            onClick={onCancel}
            className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-colors uppercase tracking-widest text-xs"
          >
            Annuler
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className="px-6 py-3 rounded-2xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors uppercase tracking-widest text-xs shadow-lg shadow-red-500/30"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};
