import { useEffect, useRef } from 'react';



export function useWebGPU(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const webGPUState = useRef({
    device: null as GPUDevice | null,
    context: null as GPUCanvasContext | null,
    presentationFormat: null as GPUTextureFormat | null,
  });

  const getShaderCode = async (dir: string): Promise<string> => {
    const response = await fetch(dir);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  };



  useEffect(() => {
    const initWebGPU = async () => {
      if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
      }

      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
      }

      const newDevice = await adapter.requestDevice();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const newContext = canvas.getContext("webgpu") as GPUCanvasContext;
      const newPresentationFormat = navigator.gpu.getPreferredCanvasFormat();

      newContext.configure({
        device: newDevice,
        format: newPresentationFormat,
      });

      webGPUState.current = ({
        device: newDevice,
        context: newContext,
        presentationFormat: newPresentationFormat,
      });
    };

    initWebGPU();
  }, [canvasRef]);

  return webGPUState;
};