/// <reference types="@webgpu/types" />
import { NUM_PARTICLES, NUM_COLORS } from './constants';

export function initBuffers(device: GPUDevice, dimensions: { width: number; height: number }) {

  const uniformBuffer = device.createBuffer({
    label: "uniforms",
    size: 24,
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



  const colorTableData = new Float32Array(Math.max(NUM_COLORS, 20) * 4);
  for (let i = 0; i < NUM_COLORS; i++) {
    colorTableData[i * 4] = Math.random();
    colorTableData[i * 4 + 1] = Math.random();
    colorTableData[i * 4 + 2] = Math.random();
    colorTableData[i * 4 + 3] = 1;
  }

  const colorTableBuffer = device.createBuffer({
    label: "colorTable",
    size: colorTableData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });

  new Float32Array(colorTableBuffer.getMappedRange()).set(colorTableData);
  colorTableBuffer.unmap();

  // Create color buffer
  const colorData = new Uint32Array(NUM_PARTICLES);
  for (let i = 0; i < NUM_PARTICLES; i++) {
    colorData[i] = Math.floor(Math.random() * NUM_COLORS);
  }

  const colorBuffer = device.createBuffer({
    label: "colors",
    size: colorData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });

  new Uint32Array(colorBuffer.getMappedRange()).set(colorData);
  colorBuffer.unmap();

  //make force table uniform
  const forceTableData = new Float32Array(20 * 20 * 4);


  // Initialize force table with random values for the NUM_COLORS x NUM_COLORS square
  for (let i = 0; i < NUM_COLORS; i++) {
    for (let j = 0; j < NUM_COLORS; j++) {
      const index = (i * 20 + j) * 4;  // Use 20 as stride due to uniform buffer limitation
      forceTableData[index] = Math.random() * 2 - 1;  // Random value between -1 and 1
      forceTableData[index + 1] = 0.0;  // Padding
      forceTableData[index + 2] = 0.0;  // Padding
      forceTableData[index + 3] = 0.0;  // Padding
    }
  }

  // Make 0 attracted to 1, 1 to 2, 2 to 3, ..., (NUM_COLORS-1) to 0
  for (let i = 0; i < NUM_COLORS; i++) {
    const attractIndex = (i * 20 + ((i + 1) % NUM_COLORS)) * 4;
    const repelIndex = (((i + 1) % NUM_COLORS) * 20 + i) * 4;
    forceTableData[attractIndex] = -2.0;  // Attraction
    forceTableData[repelIndex] = 1.0;     // Repulsion
  }
  // make same colors repel
  for (let i = 0; i < NUM_COLORS; i++) {
    const repelIndex = (i * 20 + i) * 4;
    forceTableData[repelIndex] = 1.0;  // Repulsion
  }



  const forceTableBuffer = device.createBuffer({
    label: "forceTable",
    size: forceTableData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });

  new Float32Array(forceTableBuffer.getMappedRange()).set(forceTableData);
  forceTableBuffer.unmap();


  return { particleBuffer, colorBuffer, uniformBuffer, colorTableBuffer, forceTableBuffer };
}
