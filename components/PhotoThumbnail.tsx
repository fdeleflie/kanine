import React from 'react';
import { useImage } from '../hooks/useImage';
import { X } from 'lucide-react';

interface PhotoThumbnailProps {
  imageRef?: string;
  alt: string;
  onRemove?: () => void;
}

export const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({ imageRef, alt, onRemove }) => {
  const image = useImage(imageRef);

  if (!imageRef) return null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        {onRemove && (
          <button onClick={onRemove} className="text-red-400 hover:text-red-600 p-1">
            <X size={12}/>
          </button>
        )}
      </div>
      {image ? (
        <img src={image} className="w-16 h-16 object-cover rounded-xl border border-slate-200" alt={alt} />
      ) : (
        <div className="w-16 h-16 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
          <span className="text-[10px] text-slate-400">...</span>
        </div>
      )}
    </div>
  );
};
