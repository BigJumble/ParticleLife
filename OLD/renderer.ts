export class Renderer {
    static #canvas: HTMLCanvasElement;

    static WIDTH = window.innerWidth;
    static HEIGHT = window.innerHeight;
    static POINT_SIZE = 3; // Set the desired point size
    static NUM_CIRCLES = 1000; 


    static #device: GPUDevice;
    static #context: GPUCanvasContext;

    static #presentationFormat: GPUTextureFormat;
    static #shaderModule: GPUShaderModule;
    static #backgroundShaderModule: GPUShaderModule;

    static #uniformBuffer: GPUBuffer;
    static #vertexBufferA: GPUBuffer;
    static #vertexBufferB: GPUBuffer;
    static #colorBuffer: GPUBuffer;

    static #renderPipeline: GPURenderPipeline;
    static #computePipeline: GPUComputePipeline;
    static #backgroundPipeline: GPURenderPipeline;

    static #renderBindGroupLayout: GPUBindGroupLayout;
    static #computeBindGroupLayout: GPUBindGroupLayout;
    // static #backgroundBindGroupLayout: GPUBindGroupLayout;

    static #renderBindGroupA: GPUBindGroup;
    static #renderBindGroupB: GPUBindGroup;
    static #computeBindGroupA: GPUBindGroup;
    static #computeBindGroupB: GPUBindGroup;
    // static #backgroundBindGroup: GPUBindGroup;



    static #step: number = 0;
    static isDrawing: boolean = false;


    static resize(pointsize: number = this.POINT_SIZE) {
        this.WIDTH = window.innerWidth;
        this.HEIGHT = window.innerHeight;
        this.#canvas.width = this.WIDTH;
        this.#canvas.height = this.HEIGHT;

        // Update the uniform buffer with new dimensions
        this.#device.queue.writeBuffer(
            this.#uniformBuffer,
            0,
            new Float32Array([this.WIDTH, this.HEIGHT, pointsize, 0])
        );

    }

    static async init() {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }

        this.#device = await adapter.requestDevice();
        this.#canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
        this.#canvas.width = this.WIDTH;
        this.#canvas.height = this.HEIGHT;

        this.#context = this.#canvas.getContext("webgpu") as GPUCanvasContext;

        this.#presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        this.#context.configure({
            device: this.#device,
            format: this.#presentationFormat,

        });

        this.#shaderModule = this.#device.createShaderModule({
            label: "Point list shader",
            code: await this.#getShaderCode('./shaders/pointList.wgsl'),
        });

        this.#backgroundShaderModule = this.#device.createShaderModule({
            label: "Background shader",
            code: await this.#getShaderCode('./shaders/background.wgsl'),
        });


        this.#initializeBuffers();
        this.#initializePipelines();
        this.#initializeBindGroups();
    }



    static #initializeBuffers() {
        this.#uniformBuffer = this.#device.createBuffer({
            label: "Uniform buffer",
            size: 16, // Increased size to accommodate deltaTime
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.#device.queue.writeBuffer(
            this.#uniformBuffer,
            0,
            new Float32Array([this.WIDTH, this.HEIGHT, this.POINT_SIZE, 0]) // 0 for initial deltaTime
        );

        const particleData = new Float32Array(this.NUM_CIRCLES * 4); // 2 for position, 2 for velocity
        for (let i = 0; i < this.NUM_CIRCLES; i++) {
            particleData[i * 4] = Math.random() * this.WIDTH;
            particleData[i * 4 + 1] = Math.random() * this.HEIGHT;
            particleData[i * 4 + 2] = 0; // Initial velocity x
            particleData[i * 4 + 3] = 0; // Initial velocity y
        }

        this.#vertexBufferA = this.#device.createBuffer({
            label: "Particle buffer A",
            size: particleData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
        });

        new Float32Array(this.#vertexBufferA.getMappedRange()).set(particleData);
        this.#vertexBufferA.unmap();

        const colorData = new Float32Array(this.NUM_CIRCLES * 4);
        for (let i = 0; i < this.NUM_CIRCLES; i++) {
            // Generate vibrant colors using HSL
            const hue = Math.random() * 360; // Full hue range
            const saturation = 1; // High saturation (70-100%)
            const lightness = 0.5; // Medium to high lightness (50-70%)

            // Convert HSL to RGB
            const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
            const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
            const m = lightness - c / 2;
            let r, g, b;
            if (hue < 60) {
                [r, g, b] = [c, x, 0];
            } else if (hue < 120) {
                [r, g, b] = [x, c, 0];
            } else if (hue < 180) {
                [r, g, b] = [0, c, x];
            } else if (hue < 240) {
                [r, g, b] = [0, x, c];
            } else if (hue < 300) {
                [r, g, b] = [x, 0, c];
            } else {
                [r, g, b] = [c, 0, x];
            }
            // colorData[i * 4] = 0;
            // colorData[i * 4 + 1] =  0;
            // colorData[i * 4 + 2] =  1;
            colorData[i * 4] = r + m;
            colorData[i * 4 + 1] =  g + m;
            colorData[i * 4 + 2] =  b + m;
            colorData[i * 4 + 3] = 1.0// alpha;
        }

        this.#colorBuffer = this.#device.createBuffer({
            label: "Color buffer",
            size: colorData.byteLength,
            usage: GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
        });

        new Float32Array(this.#colorBuffer.getMappedRange()).set(colorData);
        this.#colorBuffer.unmap();

        this.#vertexBufferB = this.#device.createBuffer({
            label: "Particle buffer B",
            size: particleData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
        });



    }

    static #initializePipelines() {
        this.#renderPipeline = this.#device.createRenderPipeline({
            label: "Render pipeline",
            layout: "auto",
            vertex: {
                module: this.#shaderModule,
                entryPoint: "vertexMain",
            },
            fragment: {
                module: this.#shaderModule,
                entryPoint: "fragmentMain",
                targets: [{
                    format: this.#presentationFormat,
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

        this.#computePipeline = this.#device.createComputePipeline({
            label: "Compute pipeline",
            layout: "auto",
            compute: {
                module: this.#shaderModule,
                entryPoint: "computeMain",
            },
        });

        this.#backgroundPipeline = this.#device.createRenderPipeline({
            label: "Background pipeline",
            layout: "auto",
            vertex: {
                module: this.#backgroundShaderModule,
                entryPoint: "vertexMain",
            },
            fragment: {
                module: this.#backgroundShaderModule,
                entryPoint: "fragmentMain",
                targets: [{
                    format: this.#presentationFormat,
                }],
            },
            primitive: {
                topology: "triangle-list",
            },
            multisample: {
                count: 1, // Set sampleCount to 1 to disable MSAA
            },
        });
    }

    static #initializeBindGroups() {
        this.#renderBindGroupLayout = this.#renderPipeline.getBindGroupLayout(0);
        this.#computeBindGroupLayout = this.#computePipeline.getBindGroupLayout(0);
        // this.#backgroundBindGroupLayout = this.#backgroundPipeline.getBindGroupLayout(0);

        this.#renderBindGroupA = this.#device.createBindGroup({
            label: "Render bind group A",
            layout: this.#renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferA } },
                { binding: 3, resource: { buffer: this.#colorBuffer } },
            ],
        });

        this.#renderBindGroupB = this.#device.createBindGroup({
            label: "Render bind group B",
            layout: this.#renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferB } },
                { binding: 3, resource: { buffer: this.#colorBuffer } },
            ],
        });

        this.#computeBindGroupA = this.#device.createBindGroup({
            label: "Compute bind group A",
            layout: this.#computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferA } },
                { binding: 2, resource: { buffer: this.#vertexBufferB } },
                { binding: 3, resource: { buffer: this.#colorBuffer } }, // Add this line
            ],
        });

        this.#computeBindGroupB = this.#device.createBindGroup({
            label: "Compute bind group B",
            layout: this.#computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferB } },
                { binding: 2, resource: { buffer: this.#vertexBufferA } },
                { binding: 3, resource: { buffer: this.#colorBuffer } }, // Add this line
            ],
        });


    }


    static update(deltaTime: number) {
        // Update deltaTime in uniform buffer
        this.#device.queue.writeBuffer(
            this.#uniformBuffer,
            12, // Offset for deltaTime (after screenSize and pointSize)
            new Float32Array([deltaTime])
        );

        const commandEncoder = this.#device.createCommandEncoder({
            label: "Point list command encoder"
        });

        const computePass = commandEncoder.beginComputePass({
            label: "Point list compute pass"
        });
        computePass.setPipeline(this.#computePipeline);
        computePass.setBindGroup(0, this.#step % 2 === 0 ? this.#computeBindGroupA : this.#computeBindGroupB);
        computePass.dispatchWorkgroups(Math.ceil(this.NUM_CIRCLES / 256));
        computePass.end();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            label: "Point list render pass",
            colorAttachments: [
                {
                    view: this.#context.getCurrentTexture().createView(), // Use the current texture view directly
                    loadOp: "clear",
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    storeOp: "store",
                },
            ],
        };

        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);

                // Render background
        renderPass.setPipeline(this.#backgroundPipeline);
        renderPass.draw(6); // Draw 2 triangles for a fullscreen quad

        // Render particles
        renderPass.setPipeline(this.#renderPipeline);
        renderPass.setBindGroup(0, this.#step % 2 === 0 ? this.#renderBindGroupB : this.#renderBindGroupA);
        renderPass.setVertexBuffer(0, this.#step % 2 === 0 ? this.#vertexBufferB : this.#vertexBufferA);
        renderPass.draw(this.NUM_CIRCLES * 6); // Draw 6 vertices per particle, with this.NUM_CIRCLES instances



        renderPass.end();

        this.#device.queue.submit([commandEncoder.finish()]);

        this.#step++;
    }

    static async #getShaderCode(dir: string): Promise<string> {
        const response = await fetch(dir);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    }
}

(window as any).Renderer = Renderer;