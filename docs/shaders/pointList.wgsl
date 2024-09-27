struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texCoord: vec2<f32>,
    @location(1) center: vec2<f32>,
    @location(2) color: vec4<f32>,
}

struct Uniforms {
    screenSize: vec2<f32>,
    pointSize: f32,
    deltaTime: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct Particle {
    position: vec2<f32>,
    velocity: vec2<f32>,
}

@group(0) @binding(1) var<storage, read> particlesSrc: array<Particle>;
@group(0) @binding(2) var<storage, read_write> particlesDst: array<Particle>;
@group(0) @binding(3) var<storage, read> colors: array<vec4<f32>>;

fn calculateWrappedDistance(pos1: vec2<f32>, pos2: vec2<f32>) -> vec2<f32> {
    // make 8 candidates for pos2, wrapped around the screen
    let candidates = array<vec2<f32>, 8>(
        vec2<f32>(pos2.x + uniforms.screenSize.x, pos2.y),
        vec2<f32>(pos2.x - uniforms.screenSize.x, pos2.y),
        vec2<f32>(pos2.x, pos2.y + uniforms.screenSize.y),
        vec2<f32>(pos2.x, pos2.y - uniforms.screenSize.y),
        vec2<f32>(pos2.x + uniforms.screenSize.x, pos2.y + uniforms.screenSize.y),
        vec2<f32>(pos2.x - uniforms.screenSize.x, pos2.y + uniforms.screenSize.y),
        vec2<f32>(pos2.x + uniforms.screenSize.x, pos2.y - uniforms.screenSize.y),
        vec2<f32>(pos2.x - uniforms.screenSize.x, pos2.y - uniforms.screenSize.y)
    );

    var wrappedDiff = pos2 - pos1;
    for (var i = 0u; i < 8u; i++) {
        let candidateDiff = candidates[i] - pos1;
        if (dot(candidateDiff, candidateDiff) < dot(wrappedDiff, wrappedDiff)) {
            wrappedDiff = candidateDiff;
        }
    }

    return wrappedDiff;
}

@compute @workgroup_size(256)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= arrayLength(&particlesSrc)) {
        return;
    }

    var particle = particlesSrc[index];
    var force = vec2<f32>(0.0, 0.0);
    let color = colors[index];
    
    // Particle Life simulation
    for (var i = 0u; i < arrayLength(&particlesSrc); i++) {
        if (i == index) {
            continue;
        }

        let other = particlesSrc[i];
        let diff: vec2<f32> = calculateWrappedDistance(particle.position, other.position);
        let distSq = dot(diff, diff);

        if (distSq < uniforms.pointSize*uniforms.pointSize) {
            continue;
        }

        let dist = sqrt(distSq);
        let direction = diff / dist;

        // Isometric force calculation
        let strength = calculateIsometricForce(dist, colors[index], colors[i]);
        force += direction * strength;
    }

    // Update velocity and position
    particle.velocity += force * uniforms.deltaTime;
    particle.velocity *= 0.99; // Damping
    particle.position += particle.velocity * uniforms.deltaTime;

    // Wrap the particle position
    particle.position = (particle.position + uniforms.screenSize) % uniforms.screenSize;
    
    // Write to the destination buffer
    particlesDst[index] = particle;
}

fn calculateIsometricForce(dist: f32, color1: vec4<f32>, color2: vec4<f32>) -> f32 {
    let redChaseYellow = 100.0;
    let optimalDistance = 150.0;
    let repulsionStrength = 500.0;

    // Check if color1 is red (chasing) and color2 is yellow (being chased)
    let isRedChasingYellow = color1.r > 0.7 && color1.g < 0.3 && color1.b < 0.3 &&
                             color2.r > 0.7 && color2.g > 0.7 && color2.b < 0.3;

    if (isRedChasingYellow) {
        // Red chases yellow
        return -redChaseYellow / (dist + 1.0);
    } else {
        // Other particles maintain distance
        let distanceForce = (dist - optimalDistance) / optimalDistance;
        return distanceForce * repulsionStrength / (dist + 1.0);
    }
}

fn rgb_to_hsv(rgb: vec3<f32>) -> vec3<f32> {
    let v = max(max(rgb.r, rgb.g), rgb.b);
    let c = v - min(min(rgb.r, rgb.g), rgb.b);
    let s = select(0.0, c / v, v != 0.0);
    
    var h: f32;
    if (c == 0.0) {
        h = 0.0;
    } else if (v == rgb.r) {
        h = (rgb.g - rgb.b) / c;
    } else if (v == rgb.g) {
        h = 2.0 + (rgb.b - rgb.r) / c;
    } else {
        h = 4.0 + (rgb.r - rgb.g) / c;
    }
    
    h = (h / 6.0 + 1.0) % 1.0;
    return vec3<f32>(h, s, v);
}

@vertex
fn vertexMain(
    @builtin(vertex_index) vertexIndex: u32
) -> VertexOutput {
    let cornerIndex = vertexIndex % 6u;
    
    let instanceIndex = vertexIndex / 6u;
    let particle = particlesSrc[instanceIndex];
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