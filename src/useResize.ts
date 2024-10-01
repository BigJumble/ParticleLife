import { useState, useEffect } from 'react';


export function useResize() {
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const resize = () => {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    setDimensions({ width: newWidth, height: newHeight });

  };

  useEffect(() => {
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return dimensions;
}