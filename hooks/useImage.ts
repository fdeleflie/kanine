import { useState, useEffect } from 'react';
import { get } from 'idb-keyval';

export const useImage = (imageRef?: string) => {
  const [image, setImage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!imageRef) {
      setImage(undefined);
      return;
    }
    
    if (imageRef.startsWith('data:image/')) {
      setImage(imageRef);
    } else {
      get(imageRef).then((val) => setImage(val as string)).catch(console.error);
    }
  }, [imageRef]);

  return image;
};
