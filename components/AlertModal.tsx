import React from 'react';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-slate-100">
        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic mb-4">{title}</h3>
        <div className="text-slate-600 font-medium mb-8 leading-relaxed">{message}</div>
        <div className="flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-3 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/30"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
