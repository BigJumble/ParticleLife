struct Uniforms {
    width : u32,
    height : u32,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<uniform> paint : vec2<u32>;
@group(0) @binding(2) var<storage, read> cellsIn : array<u32>;
@group(0) @binding(3) var<storage, read_write> cellsOut : array<u32>;

@compute @workgroup_size(1)
fn computeDraw() {
    if (paint.x >= uniforms.width || paint.y >= uniforms.height) {
        return;
    }
    let index = paint.y * uniforms.width + paint.x;
    cellsOut[index] = 1u;
}

fn getCellState(x: u32, y: u32) -> u32 {
    let index = y * uniforms.width + x;
    return cellsIn[index];
}

fn getCellNeighbors(x: u32, y: u32) -> u32 {
    var count = 0u;
    for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) {
                continue;
            }
            let nx = (x + u32(dx) + uniforms.width) % uniforms.width;
            let ny = (y + u32(dy) + uniforms.height) % uniforms.height;
            count += getCellState(nx, ny);
        }
    }
    return count;
}

@compute @workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    
    if (x >= uniforms.width || y >= uniforms.height) {
        return;
    }
    
    let index = y * uniforms.width + x;
    let neighbors = getCellNeighbors(x, y);
    let currentState = getCellState(x, y);
    
    if (currentState == 1u) {
        if (neighbors == 2u || neighbors == 3u) {
            cellsOut[index] = 1u;
        } else {
            cellsOut[index] = 0u;
        }
    } else {
        if (neighbors == 3u) {
            cellsOut[index] = 1u;
        } else {
            cellsOut[index] = 0u;
        }
    }
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
    let cellState = f32(cellsIn[index]);
    return vec4<f32>(cellState, cellState, cellState, 1.0);
}