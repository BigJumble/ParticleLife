/// <reference types="@webgpu/types" />

interface WebGPUState {
  device: GPUDevice;
  context: GPUCanvasContext;
  presentationFormat: GPUTextureFormat;
}

export async function initWebGPU(canvasRef: React.RefObject<HTMLCanvasElement>): Promise<WebGPUState | undefined> {
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported on this browser.");
  }

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) {
    throw new Error("No appropriate GPUAdapter found.");
  }

  const newDevice = await adapter.requestDevice();
  const canvas = canvasRef.current;
  if (!canvas) return undefined;

  const newContext = canvas.getContext("webgpu") as GPUCanvasContext;
  const newPresentationFormat = navigator.gpu.getPreferredCanvasFormat();

  newContext.configure({
    device: newDevice,
    format: newPresentationFormat,
  });

  return {
    device: newDevice,
    context: newContext,
    presentationFormat: newPresentationFormat,
  };
};