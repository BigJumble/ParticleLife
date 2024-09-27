struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
    @location(1) center: vec2<f32>,
    @location(2) color: vec4<f32>,
}

struct Uniforms {
    screenSize: vec2<f32>,
    pointSize: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct Vertex {
    position: vec2<f32>,
}

@group(0) @binding(1) var<storage, read> verticesSrc: array<Vertex>;
@group(0) @binding(2) var<storage, read_write> verticesDst: array<Vertex>;
@group(0) @binding(3) var<storage, read> colors: array<vec4<f32>>;

@compute @workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&verticesSrc)) {
        return;
    }

    var vertex = verticesSrc[index];

    // Move the point down
    vertex.position.y -= (f32(index)%4.0+3.0)*0.02;

    // Loop back to bottom if outside the window
    if (vertex.position.y < 0.0) {
        vertex.position.y = uniforms.screenSize.y;
    }


    // Write to the destination buffer
    verticesDst[index] = vertex;
}

@vertex
fn vertexMain(
    @builtin(vertex_index) vertexIndex: u32
) -> VertexOutput {
    let cornerIndex = vertexIndex % 6u;
    
    let instanceIndex = vertexIndex / 6u;
    let particle = verticesSrc[instanceIndex];
    let center = particle.position;
    
    let cornerOffsets = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, 1.0)
    );
    
    let texCoords = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(0.0, 1.0)
    );
    
    let offset = cornerOffsets[cornerIndex] * uniforms.pointSize;
    let worldPos = center + offset;
    let ndcPos = (worldPos / uniforms.screenSize) * 2.0 - 1.0;
    
    var output: VertexOutput;
    output.position = vec4<f32>(ndcPos, 0.0, 1.0);
    output.texCoord = texCoords[cornerIndex];
    output.center = center;

    output.color = colors[instanceIndex];


    
    return output;
}



@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let dist = distance(input.texCoord, vec2<f32>(0.5, 0.5));
    
    if (dist > 0.5) {
        discard;
    }
    
    let pixelWidth = 0.7 / uniforms.pointSize;
    
    let innerRadius = 0.5 - pixelWidth;

    let alpha = 1.0 - smoothstep(innerRadius, 0.5, dist);
    
    return vec4<f32>(input.color.xyz, alpha);
}