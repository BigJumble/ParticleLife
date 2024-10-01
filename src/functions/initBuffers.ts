/// <reference types="@webgpu/types" />
import { NUM_PARTICLES } from './constants';

export function initBuffers(device: GPUDevice, dimensions: { width: number; height: number }) {

    const uniformBuffer = device.createBuffer({
        label: "uniforms",
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      
  // Create particle buffer
  const particleData = new Float32Array(NUM_PARTICLES * 4); // 2 for position, 2 for velocity
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particleData[i * 4] = Math.random() * dimensions.width;
    particleData[i * 4 + 1] = Math.random() * dimensions.height;
    particleData[i * 4 + 2] = 0; // Initial velocity x
    particleData[i * 4 + 3] = 0; // Initial velocity y
  }

  const particleBuffer = device.createBuffer({
    label: "particles",
    size: particleData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });

  new Float32Array(particleBuffer.getMappedRange()).set(particleData);
  particleBuffer.unmap();

  // Create color buffer
  const colorData = new Float32Array(NUM_PARTICLES * 4);
  for (let i = 0; i < NUM_PARTICLES; i++) {
    colorData[i * 4] = Math.random();
    colorData[i * 4 + 1] = Math.random();
    colorData[i * 4 + 2] = Math.random();
    colorData[i * 4 + 3] = 1;
  }

  const colorBuffer = device.createBuffer({
    label: "colors",
    size: colorData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });

  new Float32Array(colorBuffer.getMappedRange()).set(colorData);
  colorBuffer.unmap();

  return { particleBuffer, colorBuffer, uniformBuffer };
}
