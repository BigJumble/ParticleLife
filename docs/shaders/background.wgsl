struct VertexOutput {
    @builtin(position) position: vec4f,
    // @location(0) uv: vec2f,
};


@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var pos = array<vec2f, 6>(
        vec2f(-1.0, -1.0),
        vec2f(1.0, -1.0),
        vec2f(1.0, 1.0),
        vec2f(-1.0, -1.0),
        vec2f(1.0, 1.0),
        vec2f(-1.0, 1.0)
    );

    var output: VertexOutput;
    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    // output.uv = (pos[vertexIndex] + 1.0) * 0.5;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    // Simple gradient background
    // let color = vec3f(input.uv, 0.5);

    return vec4f(0.0, 0.0, 0.0, 1.0);
}
