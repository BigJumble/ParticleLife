/// <reference types="@webgpu/types" />

import { useEffect, useRef } from 'react';

// GPU stuff
import { initWebGPU } from './functions/initWebGPU.ts';
import { createBackgroundShader } from './shaders/backgroundShader.ts';
import { createParticleLifeShader } from './shaders/particleLifeShader.ts';
import { initBuffers } from './functions/initBuffers.ts';
import { NUM_PARTICLES, POINT_SIZE, NUM_COLORS } from './functions/constants.ts';



// Stop Hot Module Reloading, it's too annoying pressing F5
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate()
  })
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dimensions = useRef({ width: window.innerWidth, height: window.innerHeight });

  const device = useRef<GPUDevice | null>(null);
  const context = useRef<GPUCanvasContext | null>(null);
  const presentationFormat = useRef<GPUTextureFormat | null>(null);

  const backgroundShaderModule = useRef<GPUShaderModule | null>(null);
  const particleLifeShaderModule = useRef<GPUShaderModule | null>(null);

  const uniformBuffer = useRef<GPUBuffer | null>(null);
  const particleBuffer = useRef<GPUBuffer | null>(null);
  const colorBuffer = useRef<GPUBuffer | null>(null);
  const colorTableBuffer = useRef<GPUBuffer | null>(null);
  const forceTableBuffer = useRef<GPUBuffer | null>(null);


  const renderPipeline = useRef<GPURenderPipeline | null>(null);
  const backgroundPipeline = useRef<GPURenderPipeline | null>(null);
  const particleLifePipeline = useRef<GPUComputePipeline | null>(null);

  const renderBindGroupLayout = useRef<GPUBindGroupLayout | null>(null);
  const computeBindGroupLayout = useRef<GPUBindGroupLayout | null>(null);

  const renderBindGroup = useRef<GPUBindGroup | null>(null);
  const computeBindGroup = useRef<GPUBindGroup | null>(null);




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
    backgroundShaderModule.current = createBackgroundShader(device.current);
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
        count: 1, // Set sampleCount to 1 to disable MSAA
      },
    });

    backgroundPipeline.current = device.current.createRenderPipeline({
      label: "backgroundPipeline",
      layout: "auto",
      vertex: {
        module: backgroundShaderModule.current,
        entryPoint: "vertexMain",
      },
      fragment: { 
        module: backgroundShaderModule.current,
        entryPoint: "fragmentMain",
        targets: [{
          format: presentationFormat.current,
        }],
      },
      primitive: {
        topology: "triangle-list",
      },
      multisample: {
        count: 1, // Set sampleCount to 1 to disable MSAA
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

    // auto layout
    renderBindGroupLayout.current = renderPipeline.current.getBindGroupLayout(0);
    computeBindGroupLayout.current = particleLifePipeline.current.getBindGroupLayout(0);

    renderBindGroup.current = device.current.createBindGroup({
      label: "Render bind group",
      layout: renderBindGroupLayout.current,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer.current } },
        { binding: 1, resource: { buffer: particleBuffer.current } },
        { binding: 3, resource: { buffer: colorBuffer.current } },
        { binding: 4, resource: { buffer: colorTableBuffer.current } },
      ]
    })

    computeBindGroup.current = device.current.createBindGroup({
      label: "Compute bind group",
      layout: computeBindGroupLayout.current,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer.current } },
        { binding: 2, resource: { buffer: particleBuffer.current } },
        { binding: 3, resource: { buffer: colorBuffer.current } },
        { binding: 5, resource: { buffer: forceTableBuffer.current } },
      ]
    })
    
  }


  const update = (timestamp: number) => {
    const deltaTime = (timestamp - lastTime.current) / 1000;
    lastTime.current = timestamp;
    //console.log(deltaTime);


    // Update deltaTime in uniform buffer
    device.current!.queue.writeBuffer(
        uniformBuffer.current!,
        16, // Offset for deltaTime (after screenSize and pointSize)
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

    // Render particles
    renderPass.setPipeline(renderPipeline.current!);
    renderPass.setBindGroup(0, renderBindGroup.current);
    renderPass.draw(NUM_PARTICLES * 3); // Draw 6 vertices per particle, with NUM_CIRCLES instances

    renderPass.end();

    device.current!.queue.submit([commandEncoder.finish()]);



    animationFrame.current = requestAnimationFrame(update);
  };

  function updateUniforms() {
    if (device.current && uniformBuffer.current) {
      const uniformData = new Float32Array([dimensions.current.width, dimensions.current.height, POINT_SIZE, NUM_COLORS, 0]);
      device.current.queue.writeBuffer(uniformBuffer.current, 0, uniformData);
    }
  } 

  const resize = () => {
    dimensions.current.width = window.innerWidth;
    dimensions.current.height = window.innerHeight;
    canvasRef.current!.width = dimensions.current.width;
    canvasRef.current!.height = dimensions.current.height;
    updateUniforms();
  };

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
    <>
      {!navigator.gpu && (
        <p style={{ position: 'absolute', zIndex: 1, color: 'red' }}>
          WebGPU is not supported in this browser. Please try Chrome, Edge, or Opera.
        </p>
      )}
      <canvas ref={canvasRef} id="canvas" />
    </>
  );
}

export default App;
