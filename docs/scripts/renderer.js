export class Renderer {
    static #canvas;
    static WIDTH = window.innerWidth;
    static HEIGHT = window.innerHeight;
    static POINT_SIZE = 3;
    static NUM_CIRCLES = 10000;
    static #device;
    static #context;
    static #presentationFormat;
    static #shaderModule;
    static #backgroundShaderModule;
    static #uniformBuffer;
    static #vertexBufferA;
    static #vertexBufferB;
    static #colorBuffer;
    static #renderPipeline;
    static #computePipeline;
    static #backgroundPipeline;
    static #renderBindGroupLayout;
    static #computeBindGroupLayout;
    static #renderBindGroupA;
    static #renderBindGroupB;
    static #computeBindGroupA;
    static #computeBindGroupB;
    static #step = 0;
    static isDrawing = false;
    static resize(pointsize = this.POINT_SIZE) {
        this.WIDTH = window.innerWidth;
        this.HEIGHT = window.innerHeight;
        this.#canvas.width = this.WIDTH;
        this.#canvas.height = this.HEIGHT;
        this.#device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([this.WIDTH, this.HEIGHT, pointsize, 0]));
    }
    static async init() {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        if (!adapter) {
            throw new Error("No appropriate GPUAdapter found.");
        }
        this.#device = await adapter.requestDevice();
        this.#canvas = document.getElementById("gameCanvas");
        this.#canvas.width = this.WIDTH;
        this.#canvas.height = this.HEIGHT;
        this.#context = this.#canvas.getContext("webgpu");
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
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.#device.queue.writeBuffer(this.#uniformBuffer, 0, new Float32Array([this.WIDTH, this.HEIGHT, this.POINT_SIZE, 0]));
        const vertexData = new Float32Array(this.NUM_CIRCLES * 2);
        for (let i = 0; i < this.NUM_CIRCLES; i++) {
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
        const colorData = new Float32Array(this.NUM_CIRCLES * 4);
        for (let i = 0; i < this.NUM_CIRCLES; i++) {
            const hue = Math.random() * 360;
            const saturation = 1;
            const lightness = 0.5;
            const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
            const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
            const m = lightness - c / 2;
            let r, g, b;
            if (hue < 60) {
                [r, g, b] = [c, x, 0];
            }
            else if (hue < 120) {
                [r, g, b] = [x, c, 0];
            }
            else if (hue < 180) {
                [r, g, b] = [0, c, x];
            }
            else if (hue < 240) {
                [r, g, b] = [0, x, c];
            }
            else if (hue < 300) {
                [r, g, b] = [x, 0, c];
            }
            else {
                [r, g, b] = [c, 0, x];
            }
            colorData[i * 4] = r + m;
            colorData[i * 4 + 1] = g + m;
            colorData[i * 4 + 2] = b + m;
            colorData[i * 4 + 3] = 1.0;
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
                count: 1,
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
                count: 1,
            },
        });
    }
    static #initializeBindGroups() {
        this.#renderBindGroupLayout = this.#renderPipeline.getBindGroupLayout(0);
        this.#computeBindGroupLayout = this.#computePipeline.getBindGroupLayout(0);
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
    static update(deltaTime) {
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
        const renderPassDescriptor = {
            label: "Point list render pass",
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
        renderPass.setPipeline(this.#backgroundPipeline);
        renderPass.draw(6);
        renderPass.setPipeline(this.#renderPipeline);
        renderPass.setBindGroup(0, this.#step % 2 === 0 ? this.#renderBindGroupB : this.#renderBindGroupA);
        renderPass.setVertexBuffer(0, this.#step % 2 === 0 ? this.#vertexBufferB : this.#vertexBufferA);
        renderPass.draw(this.NUM_CIRCLES * 6);
        renderPass.end();
        this.#device.queue.submit([commandEncoder.finish()]);
        this.#step++;
    }
    static async #getShaderCode(dir) {
        const response = await fetch(dir);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    }
}
window.Renderer = Renderer;
