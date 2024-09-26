struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) pointCoord: vec2<f32>,
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

@compute @workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&verticesSrc)) {
        return;
    }

    var vertex = verticesSrc[index];

    // Move the point down
    vertex.position.y -= 0.01;

    // Loop back to bottom if outside the window
    if (vertex.position.y < 0.0) {
        vertex.position.y = uniforms.screenSize.y;
    }


    // Write to the destination buffer
    verticesDst[index] = vertex;
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let vertex = verticesSrc[vertexIndex];
    var output: VertexOutput;
    output.position = vec4<f32>(vertex.position / uniforms.screenSize*2.0-1.0, 0.0, 1.0);
    output.pointCoord = vertex.position;
    
    // Set the point size directly
    let pointSize = uniforms.pointSize;
    
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // let center = vec2<f32>(0.5, 0.5);
    // let coord = input.pointCoord / uniforms.pointSize;
    // let dist = distance(center, coord);
    
    // if (dist > 10) {
    //     discard;
    // }
    
    // // Smooth circle edge
    let alpha = 1.0;// 1.0 - smoothstep(0.45, 0.5, dist);
    
    return vec4<f32>(1.0, 0.0, 0.0, alpha); // Red circle
}
