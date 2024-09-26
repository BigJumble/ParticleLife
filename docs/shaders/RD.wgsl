struct Particle {
    a : f32,
    b : f32,
};

struct Uniforms {
    width : u32,
    height : u32,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<uniform> cursor : vec2<f32>;
@group(0) @binding(2) var<storage, read> bufferSrc : array<Particle>;
@group(0) @binding(3) var<storage, read_write> bufferDst : array<Particle>;


@compute @workgroup_size(8, 8)
fn computeDraw(@builtin(global_invocation_id) id : vec3<u32>) {
    let i = id.x;
    let j = id.y;

    let index: u32 = i + j * uniforms.width;

    // Get particle position
    let particlePos = vec2<f32>(id.xy);

    // Calculate distance to the cursor
    let dist = (particlePos.x - cursor.x)*(particlePos.x - cursor.x)+(particlePos.y - cursor.y)*(particlePos.y - cursor.y);

    if (dist < 1250) {
        bufferDst[index].b = 1.0;
    }
}

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) id : vec3<u32>) {
    let i = id.x;
    let j = id.y;

    let width: u32 = uniforms.width;
    let index: u32 = i + j * width;

    let current = bufferSrc[index];
    
    let xnor = f32(id.x)/f32(uniforms.width);
    let ynor = f32(id.y)/f32(uniforms.height);

    // Reaction-diffusion model: Gray-Scott
    let feed: f32 = mix(0.02, 0.07, xnor);
    let kill: f32 = mix(0.05, 0.07, ynor);
    let diffusionA: f32 = mix(0.8, 1.2, xnor);
    let diffusionB: f32 = mix(0.3, 0.7, xnor);

    // let lapA = bufferSrc[(i + 1) % width + j * width].a
    //          + bufferSrc[(i - 1 + width) % width + j * width].a
    //          + bufferSrc[i + ((j + 1) % width) * width].a
    //          + bufferSrc[i + ((j - 1 + width) % width) * width].a
    //          - 4.0 * current.a;

    // let lapB = bufferSrc[(i + 1) % width + j * width].b
    //          + bufferSrc[(i - 1 + width) % width + j * width].b
    //          + bufferSrc[i + ((j + 1) % width) * width].b
    //          + bufferSrc[i + ((j - 1 + width) % width) * width].b
    //          - 4.0 * current.b;

    var lapA:f32 = 0.0;
    var lapB:f32 = 0.0;

    // Right neighbor
    if (i + 1 < width) {
        lapA += bufferSrc[(i + 1) + j * width].a;
        lapB += bufferSrc[(i + 1) + j * width].b;
    }

    // Left neighbor
    if (i - 1 >= 0) {
        lapA += bufferSrc[(i - 1) + j * width].a;
        lapB += bufferSrc[(i - 1) + j * width].b;
    }

    // Bottom neighbor
    if (j + 1 < width) {
        lapA += bufferSrc[i + (j + 1) * width].a;
        lapB += bufferSrc[i + (j + 1) * width].b;
    }

    // Top neighbor
    if (j - 1 >= 0) {
        lapA += bufferSrc[i + (j - 1) * width].a;
        lapB += bufferSrc[i + (j - 1) * width].b;
    }

    // Subtract center value
    lapA -= 4.0 * current.a;
    lapB -= 4.0 * current.b;

    let newA = current.a + (diffusionA * lapA - current.a * current.b * current.b + feed * (1.0 - current.a)) * 0.1;
    let newB = current.b + (diffusionB * lapB + current.a * current.b * current.b - (kill + feed) * current.b) * 0.1;

    bufferDst[index].a = newA;
    bufferDst[index].b = newB;
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4<f32> {
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, 1.0)
    );
    return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
}

@fragment
fn fragmentMain(@builtin(position) pos : vec4<f32>) -> @location(0) vec4<f32> {
    let cellX = u32(pos.x);
    let cellY = u32(pos.y);
    let index = cellY * uniforms.width + cellX;
    let cellState = f32(bufferSrc[index].b);

    return vec4<f32>(cellState, cellState, cellState, 1.0);
}