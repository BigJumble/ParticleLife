/// <reference types="@webgpu/types" />

export function createParticleLifeShader(device: GPUDevice) {
    return device.createShaderModule({
        label: "particleLifeShader",
        code: /* wgsl */`
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
    @location(1) color: vec4<f32>,
}

struct Uniforms {
    screenSize: vec2<f32>,
    pointSize: f32,
    colorsCount: u32,
    deltaTime: f32,
}

struct Particle {
    position: vec2<f32>,
    velocity: vec2<f32>,
}

struct ColorForceRow {
    force: f32,
    padding: f32,
    padding2: f32,
    padding3: f32,
}


@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> particlesRead: array<Particle>;
@group(0) @binding(2) var<storage, read_write> particlesReadWrite: array<Particle>;
@group(0) @binding(3) var<storage, read> colorIds: array<u32>;
@group(0) @binding(4) var<uniform> colorTable: array<vec4<f32>, 20>;
@group(0) @binding(5) var<uniform> colorForceTable: array<array<vec4<f32>, 20>, 20>;

@compute @workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&particlesReadWrite)) {
        return;
    }

    var particle = particlesReadWrite[index];
    var force = vec2<f32>(0.0, 0.0);
    let colorId = colorIds[index];
    
    // Particle Life simulation
    for (var i = 0u; i < arrayLength(&particlesReadWrite); i++) {
        if (i == index) {
            continue;
        }

        let other = particlesReadWrite[i];
        let diff: vec2<f32> = other.position - particle.position;
        let distSq = dot(diff, diff);
        let dist = sqrt(distSq);

        if (dist < 1.0) {
            continue;
        }

        let direction = diff / dist;

        // Force calculation using force table and distance
        let otherColorId = colorIds[i];
        let strength = calculateForce(dist, colorId, otherColorId);
        force += direction * strength;
    }

    // Update velocity and position
    particle.velocity += force * uniforms.deltaTime*100;
    particle.velocity *= 0.99; // Damping
    particle.position += particle.velocity * uniforms.deltaTime;

    // Wrap the particle position
    particle.position = (particle.position + uniforms.screenSize) % uniforms.screenSize;
    
    // Write to the destination buffer
    particlesReadWrite[index] = particle;
}

fn calculateForce(distance: f32, colorId1: u32, colorId2: u32) -> f32 {
    // Get base force from the table
    let baseForce = colorForceTable[colorId1][colorId2].x;
    
    // Adjust force based on distance
    let maxDistance = uniforms.pointSize * 20.0;
    var forceFalloff: f32;
    if (distance < uniforms.pointSize * 10.0) {
        // Linear interpolation from -1 at distance 0 to 0 at distance 10*pointSize
        forceFalloff = -1.0 + distance / (uniforms.pointSize * 10.0);
    } else if (distance < maxDistance) {
        // Quadratic falloff from 0 at distance 10*pointSize to 1 at distance 20*pointSize
        let t = (distance - uniforms.pointSize * 10.0) / (uniforms.pointSize * 10.0);
        forceFalloff = t * t;
    } else {
        forceFalloff = 0.0;
    }
    
    return baseForce * forceFalloff;
}

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    let instanceIndex = vertexIndex / 3u;
    let particle = particlesRead[instanceIndex];
    let center = particle.position;
    
    // Define a single equilateral triangle that fits a circle of radius 1
    let triangleVertices = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 2.0),
        vec2<f32>(-1.732, -1.0),
        vec2<f32>(1.732, -1.0)
    );
    
    let vertexOffset = triangleVertices[vertexIndex % 3u] * uniforms.pointSize;
    let worldPos = center + vertexOffset;
    let ndcPos = (worldPos / uniforms.screenSize) * 2.0 - 1.0;
    
    var output: VertexOutput;
    output.position = vec4<f32>(ndcPos, 0.0, 1.0);
    output.texCoord = triangleVertices[vertexIndex % 3u] * 0.5 + 0.5;
    output.color = colorTable[colorIds[instanceIndex]];
    
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let diff = input.texCoord - vec2<f32>(0.5, 0.5);
    let distSquared = dot(diff, diff);
    
    if (distSquared > 0.25) {
        discard;
    }
    
    let pixelWidth = 0.8 / uniforms.pointSize;
    let innerRadius = 0.5 - pixelWidth;
    let innerRadiusSquared = innerRadius * innerRadius;

    let alpha = 1.0 - smoothstep(innerRadiusSquared, 0.25, distSquared);
    
    return vec4<f32>(input.color.xyz, alpha);
}
`
});}