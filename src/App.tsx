/// <reference types="@webgpu/types" />

import { useState, useEffect, useRef } from 'react';
import { useWebGPU } from './useWebGPU.ts';
import { useResize } from './useResize.ts'; // Add this import

const NUM_CIRCLES = 1000;
const POINT_SIZE = 3;

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimensions = useResize();
  const webGPUState = useWebGPU(canvasRef);
  const animationFrame = useRef(0);
  const lastTime = useRef(0);
  // Remove the useEffect for resize event listener (it's now in the custom hook)

  const update = (timestamp: number) => {
    const deltaTime = timestamp - lastTime.current;
    lastTime.current = timestamp;
    // console.log(deltaTime);

    animationFrame.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    animationFrame.current = requestAnimationFrame(update);


    return () => {
      cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  return (
    <>
      {!navigator.gpu && (
        <p style={{ position: 'absolute', zIndex: 1, color: 'red' }}>
          WebGPU is not supported in this browser. Please try Chrome, Edge, or Opera.
        </p>
      )}
      <canvas ref={canvasRef} id="canvas" width={dimensions.width} height={dimensions.height} />
    </>
  );
}

export default App;
