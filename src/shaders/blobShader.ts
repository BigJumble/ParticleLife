/// <reference types="@webgpu/types" />

export function createBlobShader(device: GPUDevice) {
    return device.createShaderModule({
        label: "blobShader",
        code: /* wgsl */`
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texCoord: vec2f,
};

@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var textureSampler: sampler;

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
    output.texCoord = (pos[vertexIndex] + 1.0) / 2.0;
    return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    let texSize = textureDimensions(inputTexture);
    let texelSize = 1.0 / vec2f(f32(texSize.x), f32(texSize.y));
    

    // gaussian blur, with alpha weighting
    var spreadColor = vec4f(0.0);
    let spreadRadius = 20;
    let fadeStrength = 0.95; // Controls how much the color fades as it spreads
    var totalWeight = 0.0;
    
    for (var y = -spreadRadius; y <= spreadRadius; y++) {
        for (var x = -spreadRadius; x <= spreadRadius; x++) {   
            let offset = vec2f(f32(x), f32(y)) * texelSize;
            let distance = length(vec2f(f32(x), f32(y)));
            var weight = 1.0 - (distance / f32(spreadRadius));
            weight = max(0.0, weight); // Ensure weight is non-negative
            
            let sampleColor = textureSample(inputTexture, textureSampler, input.texCoord + offset);
            let alphaFactor = pow(fadeStrength, distance);
            let fadedColor = vec4f(sampleColor.rgb, sampleColor.a * alphaFactor);   
            weight *= fadedColor.a;
            
            spreadColor += fadedColor * weight;
            totalWeight += weight;
        }
    }

    // Normalize
    if (totalWeight > 0.0) {
        spreadColor /= totalWeight;
    }
    if (spreadColor.a > 0.65) {
        spreadColor.a = 1.0;
    }

    //mix black with spreadColor based on spreadColor.a
    spreadColor = mix(vec4f(0.0), spreadColor, spreadColor.a);
    

    
    // // Threshold
    // let threshold = 0.1;
    // if (spreadColor.a < threshold) {
    //     spreadColor = vec4f(0.0);
    // }
    // else {
    //     spreadColor.a = 1.0;
    // }
    return spreadColor;
}`

    });
}