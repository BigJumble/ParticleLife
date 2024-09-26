export class Renderer {
    static #canvas: HTMLCanvasElement;

    static WIDTH = window.innerWidth;
    static HEIGHT = window.innerHeight;
    static POINT_SIZE = 10; // Set the desired point size

    static #device: GPUDevice;
    static #context: GPUCanvasContext;

    static #presentationFormat: GPUTextureFormat;
    static #shaderModule: GPUShaderModule;
    static #backgroundShaderModule: GPUShaderModule;

    static #uniformBuffer: GPUBuffer;
    static #vertexBufferA: GPUBuffer;
    static #vertexBufferB: GPUBuffer;

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

    static #numVertices = 1000; // This should remain the same if you have 1000 particles

    static #step: number = 0;
    static isDrawing: boolean = false;

    static #multisampleTexture: GPUTexture;
    static #multisampleView: GPUTextureView;

    static resize() {
        this.WIDTH = window.innerWidth;
        this.HEIGHT = window.innerHeight;
        this.#canvas.width = this.WIDTH;
        this.#canvas.height = this.HEIGHT;

        // Update the uniform buffer with new dimensions
        this.#device.queue.writeBuffer(
            this.#uniformBuffer,
            0,
            new Float32Array([this.WIDTH, this.HEIGHT, this.POINT_SIZE, 0])
        );

        // Recreate the multisampled texture with new dimensions
        this.#multisampleTexture.destroy();
        this.#initializeMultisampleTexture();
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

        this.#initializeMultisampleTexture();
        this.#initializeBuffers();
        this.#initializePipelines();
        this.#initializeBindGroups();
    }

    static #initializeMultisampleTexture() {
        this.#multisampleTexture = this.#device.createTexture({
            size: { width: this.WIDTH, height: this.HEIGHT },
            sampleCount: 4,
            format: this.#presentationFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.#multisampleView = this.#multisampleTexture.createView();
    }

    static #initializeBuffers() {
        this.#uniformBuffer = this.#device.createBuffer({
            label: "Uniform buffer",
            size: 16, // Increased size to accommodate point size
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.#device.queue.writeBuffer(
            this.#uniformBuffer,
            0,
            new Float32Array([this.WIDTH, this.HEIGHT, this.POINT_SIZE, 0]) // Added point size, 0 for padding
        );

        const vertexData = new Float32Array(this.#numVertices * 2);
        for (let i = 0; i < this.#numVertices; i++) {
            vertexData[i * 2] = Math.random() * this.WIDTH;
            vertexData[i * 2 + 1] = Math.random() * this.HEIGHT;
        }

        this.#vertexBufferA = this.#device.createBuffer({
            label: "Vertex buffer A",
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
        });

        new Float32Array(this.#vertexBufferA.getMappedRange()).set(vertexData);
        this.#vertexBufferA.unmap();

        this.#vertexBufferB = this.#device.createBuffer({
            label: "Vertex buffer B",
            size: vertexData.byteLength,
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
                count: 4,
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
                count: 4, // Add this line to enable multisampling
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
            ],
        });

        this.#renderBindGroupB = this.#device.createBindGroup({
            label: "Render bind group B",
            layout: this.#renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferB } },
            ],
        });

        this.#computeBindGroupA = this.#device.createBindGroup({
            label: "Compute bind group A",
            layout: this.#computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferA } },
                { binding: 2, resource: { buffer: this.#vertexBufferB } },
            ],
        });

        this.#computeBindGroupB = this.#device.createBindGroup({
            label: "Compute bind group B",
            layout: this.#computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferB } },
                { binding: 2, resource: { buffer: this.#vertexBufferA } },
            ],
        });


    }


    static update(deltaTime: number) {
        const commandEncoder = this.#device.createCommandEncoder({
            label: "Point list command encoder"
        });

        const computePass = commandEncoder.beginComputePass({
            label: "Point list compute pass"
        });
        computePass.setPipeline(this.#computePipeline);
        computePass.setBindGroup(0, this.#step % 2 === 0 ? this.#computeBindGroupA : this.#computeBindGroupB);
        computePass.dispatchWorkgroups(Math.ceil(this.#numVertices / 256));
        computePass.end();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            label: "Point list render pass",
            colorAttachments: [
                {
                    view: this.#multisampleView,
                    resolveTarget: this.#context.getCurrentTexture().createView(),
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
        renderPass.draw(this.#numVertices * 6); // Draw 6 vertices per particle, with this.#numVertices instances

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
