/// <reference types="@webgpu/types" />

import { useEffect, useRef } from 'react';

// GPU stuff
import { initWebGPU } from './functions/initWebGPU.ts';
import { createBlobShader } from './shaders/blobShader.ts';
import { createParticleLifeShader } from './shaders/particleLifeShader.ts';
import { initBuffers } from './functions/initBuffers.ts';
import { NUM_PARTICLES, POINT_SIZE, NUM_COLORS } from './functions/constants.ts';

// Stop Hot Module Reloading, it's too annoying pressing F5
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate()
  })
}

function Simulation({ forceTable }: { forceTable: number[][] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimensions = useRef({ width: window.innerWidth, height: window.innerHeight });

  const device = useRef<GPUDevice | null>(null);
  const context = useRef<GPUCanvasContext | null>(null);
  const presentationFormat = useRef<GPUTextureFormat | null>(null);

  const blobShaderModule = useRef<GPUShaderModule | null>(null);
  const particleLifeShaderModule = useRef<GPUShaderModule | null>(null);

  const uniformBuffer = useRef<GPUBuffer | null>(null);
  const particleBuffer = useRef<GPUBuffer | null>(null);
  const colorBuffer = useRef<GPUBuffer | null>(null);
  const colorTableBuffer = useRef<GPUBuffer | null>(null);
  const forceTableBuffer = useRef<GPUBuffer | null>(null);
  const particleTexture = useRef<GPUTexture | null>(null);
  const particleTextureView = useRef<GPUTextureView | null>(null);

  const renderPipeline = useRef<GPURenderPipeline | null>(null);
  const blobPipeline = useRef<GPURenderPipeline | null>(null);
  const particleLifePipeline = useRef<GPUComputePipeline | null>(null);

  const renderBindGroupLayout = useRef<GPUBindGroupLayout | null>(null);
  const computeBindGroupLayout = useRef<GPUBindGroupLayout | null>(null);
  const blobBindGroupLayout = useRef<GPUBindGroupLayout | null>(null);

  const renderBindGroup = useRef<GPUBindGroup | null>(null);
  const computeBindGroup = useRef<GPUBindGroup | null>(null);
  const blobBindGroup = useRef<GPUBindGroup | null>(null);

  const animationFrame = useRef(0);
  const lastTime = useRef(0);

  async function init() {
    const webGPUState = await initWebGPU(canvasRef);
    if (!webGPUState) {
      return;
    }
    device.current = webGPUState.device;
    context.current = webGPUState.context;
    presentationFormat.current = webGPUState.presentationFormat;
    blobShaderModule.current = createBlobShader(device.current);
    particleLifeShaderModule.current = createParticleLifeShader(device.current);

    // Create buffers
    const buffers = initBuffers(device.current, dimensions.current);
    uniformBuffer.current = buffers.uniformBuffer;
    updateUniforms();
    particleBuffer.current = buffers.particleBuffer;
    colorTableBuffer.current = buffers.colorTableBuffer;
    colorBuffer.current = buffers.colorBuffer;
    forceTableBuffer.current = buffers.forceTableBuffer;


    // init pipelines
    renderPipeline.current = device.current.createRenderPipeline({
      label: "Render pipeline",
      layout: "auto",
      vertex: {
        module: particleLifeShaderModule.current,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: particleLifeShaderModule.current,
        entryPoint: "fragmentMain",
        targets: [{
          format: presentationFormat.current,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
            },
            alpha: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
            },
          },
        }],
      },
      primitive: {
        topology: "triangle-list",
      },
      multisample: {
        count: 1,
      },
    });

    blobPipeline.current = device.current.createRenderPipeline({
      label: "blobPipeline",
      layout: "auto",
      vertex: {
        module: blobShaderModule.current,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: blobShaderModule.current,
        entryPoint: "fragmentMain",
        targets: [{
          format: presentationFormat.current,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
            },
            alpha: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
            },
          },
        }],
      },
      primitive: {
        topology: "triangle-list",
      },
      multisample: {
        count: 1,
      },
    });

    particleLifePipeline.current = device.current.createComputePipeline({
      label: "particleLifePipeline",
      layout: "auto",
      compute: {
        module: particleLifeShaderModule.current,
        entryPoint: "computeMain",
      },
    });

    // init bind groups
    renderBindGroupLayout.current = renderPipeline.current.getBindGroupLayout(0);
    computeBindGroupLayout.current = particleLifePipeline.current.getBindGroupLayout(0);
    blobBindGroupLayout.current = blobPipeline.current.getBindGroupLayout(0);

    renderBindGroup.current = device.current.createBindGroup({
      label: "Render bind group",
      layout: renderBindGroupLayout.current,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer.current } },
        { binding: 1, resource: { buffer: particleBuffer.current } },
        { binding: 3, resource: { buffer: colorBuffer.current } },
        { binding: 4, resource: { buffer: colorTableBuffer.current } },
      ]
    });

    computeBindGroup.current = device.current.createBindGroup({
      label: "Compute bind group",
      layout: computeBindGroupLayout.current,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer.current } },
        { binding: 2, resource: { buffer: particleBuffer.current } },
        { binding: 3, resource: { buffer: colorBuffer.current } },
        { binding: 5, resource: { buffer: forceTableBuffer.current } },
      ]
    });

    createParticleTexture();

  }

  const update = (timestamp: number) => {
    const deltaTime = (timestamp - lastTime.current) / 1000;
    lastTime.current = timestamp;

    device.current!.queue.writeBuffer(
      uniformBuffer.current!,
      16,
      new Float32Array([deltaTime])
    );

    const commandEncoder = device.current!.createCommandEncoder({
      label: "Point list command encoder"
    });

    const computePass = commandEncoder.beginComputePass({
      label: "Point list compute pass"
    });
    computePass.setPipeline(particleLifePipeline.current!);
    computePass.setBindGroup(0, computeBindGroup.current);
    computePass.dispatchWorkgroups(Math.ceil(NUM_PARTICLES / 256));
    computePass.end();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      label: "Point list render pass",
      colorAttachments: [
        {
          view: context.current!.getCurrentTexture().createView(),
          loadOp: "clear",
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          storeOp: "store",
        },
      ],
    };

    const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
    renderPass.setPipeline(renderPipeline.current!);
    renderPass.setBindGroup(0, renderBindGroup.current);
    renderPass.draw(NUM_PARTICLES * 3);
    renderPass.end();

    // const blobPassDescriptor: GPURenderPassDescriptor = {
    //   label: "Blob render pass",
    //   colorAttachments: [
    //     {
    //       view: context.current!.getCurrentTexture().createView(),
    //       loadOp: "clear",
    //       clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
    //       storeOp: "store",
    //     },
    //   ],
    // };

    // const blobPass = commandEncoder.beginRenderPass(blobPassDescriptor);
    // blobPass.setPipeline(blobPipeline.current!);
    // blobPass.setBindGroup(0, blobBindGroup.current);
    // blobPass.draw(6);
    // blobPass.end();

    device.current!.queue.submit([commandEncoder.finish()]);

    animationFrame.current = requestAnimationFrame(update);
  };

  function updateUniforms() {
    if (device.current && uniformBuffer.current) {
      const uniformData = new Float32Array([dimensions.current.width, dimensions.current.height, POINT_SIZE, NUM_COLORS, 0]);
      device.current.queue.writeBuffer(uniformBuffer.current, 0, uniformData);
    }
  }

  function createParticleTexture() {
    particleTexture.current = device.current!.createTexture({
      size: [dimensions.current.width, dimensions.current.height],
      format: presentationFormat.current!,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    particleTextureView.current = particleTexture.current!.createView();
    blobBindGroup.current = device.current!.createBindGroup({
      label: "Blob bind group",
      layout: blobBindGroupLayout.current!,
      entries: [
        { binding: 0, resource: particleTextureView.current! },
        { binding: 1, resource: device.current!.createSampler() },
      ]
    });
  }

  const resize = () => {
    dimensions.current.width = window.innerWidth;
    dimensions.current.height = window.innerHeight;
    canvasRef.current!.width = dimensions.current.width;
    canvasRef.current!.height = dimensions.current.height;
    updateUniforms();
    createParticleTexture();


  };

  useEffect(() => {
    updateForceTable(forceTable);
  }, [forceTable]);

  function updateForceTable(forceTable: number[][]) {
    if (forceTableBuffer.current && device.current) {
      const forceTableData = new Float32Array(20 * 20 * 4);
      for (let i = 0; i < forceTable.length; i++) {
        for (let j = 0; j < forceTable[i].length; j++) {
          const index = (i * 20 + j) * 4;
          forceTableData[index] = forceTable[i][j];
          forceTableData[index + 1] = 0.0;  // Padding
          forceTableData[index + 2] = 0.0;  // Padding
          forceTableData[index + 3] = 0.0;  // Padding
        }
      }
      device.current.queue.writeBuffer(forceTableBuffer.current, 0, forceTableData);
    }
  }

  useEffect(() => {
    (async () => {
      await init();
      if (context.current) {
        animationFrame.current = requestAnimationFrame(update);
        resize();
        window.addEventListener('resize', resize);
      }
    })();

    return () => {
      cancelAnimationFrame(animationFrame.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (

      <canvas ref={canvasRef} id="canvas" />

  );
}

export default Simulation;
