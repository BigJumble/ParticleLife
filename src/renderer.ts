export class Renderer {
    static #canvas: HTMLCanvasElement;

    static WIDTH = 128;
    static HEIGHT = 128;
    static POINT_SIZE = 10; // Set the desired point size

    static #device: GPUDevice;
    static #context: GPUCanvasContext;

    static #presentationFormat: GPUTextureFormat;
    static #shaderModule: GPUShaderModule;

    static #uniformBuffer: GPUBuffer;
    static #vertexBufferA: GPUBuffer;
    static #vertexBufferB: GPUBuffer;
    static #uniformDrawBuffer: GPUBuffer;

    static #renderPipeline: GPURenderPipeline;
    static #computePipeline: GPUComputePipeline;

    static #renderBindGroupLayout: GPUBindGroupLayout;
    static #computeBindGroupLayout: GPUBindGroupLayout;

    static #renderBindGroupA: GPUBindGroup;
    static #renderBindGroupB: GPUBindGroup;
    static #computeBindGroupA: GPUBindGroup;
    static #computeBindGroupB: GPUBindGroup;

    static #numVertices: number = 1000; // Adjust this based on your needs

    static #step: number = 0;
    static isDrawing: boolean = false;

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
            code: await this.#getShaderCode('./shaders/pointList.wgsl'),
        });

        this.#initializeBuffers();
        this.#initializePipelines();
        this.#initializeBindGroups();
    }

    static #initializeBuffers() {
        this.#uniformBuffer = this.#device.createBuffer({
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
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
            mappedAtCreation: true,
        });

        new Float32Array(this.#vertexBufferA.getMappedRange()).set(vertexData);
        this.#vertexBufferA.unmap();

        this.#vertexBufferB = this.#device.createBuffer({
            size: vertexData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE,
        });

        this.#uniformDrawBuffer = this.#device.createBuffer({
            size: 8,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    static #initializePipelines() {
        this.#renderPipeline = this.#device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: this.#shaderModule,
                entryPoint: "vertexMain",
                buffers: [{
                    arrayStride: 8,
                    attributes: [{
                        shaderLocation: 0,
                        offset: 0,
                        format: "float32x2",
                    }],
                }],
            },
            fragment: {
                module: this.#shaderModule,
                entryPoint: "fragmentMain",
                targets: [{ format: this.#presentationFormat }],
            },
            primitive: {
                topology: "point-list",
            },
        });

        this.#computePipeline = this.#device.createComputePipeline({
            layout: "auto",
            compute: {
                module: this.#shaderModule,
                entryPoint: "computeMain",
            },
        });
    }

    static #initializeBindGroups() {
        this.#renderBindGroupLayout = this.#renderPipeline.getBindGroupLayout(0);
        this.#computeBindGroupLayout = this.#computePipeline.getBindGroupLayout(0);

        this.#renderBindGroupA = this.#device.createBindGroup({
            layout: this.#renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferA } },
            ],
        });

        this.#renderBindGroupB = this.#device.createBindGroup({
            layout: this.#renderBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferB } },
            ],
        });

        this.#computeBindGroupA = this.#device.createBindGroup({
            layout: this.#computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferA } },
                { binding: 2, resource: { buffer: this.#vertexBufferB } },
            ],
        });

        this.#computeBindGroupB = this.#device.createBindGroup({
            layout: this.#computeBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.#uniformBuffer } },
                { binding: 1, resource: { buffer: this.#vertexBufferB } },
                { binding: 2, resource: { buffer: this.#vertexBufferA } },
            ],
        });
    }

    static setPaintPos(screenMouseX: number, screenMouseY: number) {
        // This method is not used in the pointList shader, so we can remove it or leave it empty
    }

    static update(deltaTime: number) {
        const commandEncoder = this.#device.createCommandEncoder();

        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(this.#computePipeline);
        computePass.setBindGroup(0, this.#step % 2 === 0 ? this.#computeBindGroupA : this.#computeBindGroupB);
        computePass.dispatchWorkgroups(Math.ceil(this.#numVertices / 256));
        computePass.end();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: this.#context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                    storeOp: "store",
                },
            ],
        };

        const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
        renderPass.setPipeline(this.#renderPipeline);
        renderPass.setBindGroup(0, this.#step % 2 === 0 ? this.#renderBindGroupB : this.#renderBindGroupA);
        renderPass.setVertexBuffer(0, this.#step % 2 === 0 ? this.#vertexBufferB : this.#vertexBufferA);
        renderPass.draw(this.#numVertices);
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
