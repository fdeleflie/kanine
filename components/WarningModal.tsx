import React from 'react';

interface WarningModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export const WarningModal: React.FC<WarningModalProps> = ({ isOpen, title, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-slate-100">
        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic mb-4">{title}</h3>
        <p className="text-slate-600 font-medium mb-8 leading-relaxed">{message}</p>
        <div className="flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-4 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-colors uppercase tracking-widest text-xs shadow-lg shadow-indigo-500/30"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
