import { Effect, Layer, Ref } from 'effect'

import { ObjectPool } from '@/infrastructure/performance/object-pool'
// import { WASMIntegrationService } from './wasm-integration'

// --- Configuration ---

const CONFIG = {
  WEBGPU_ENABLED: true,
  ADAPTER_POWER_PREFERENCE: 'high-performance' as GPUPowerPreference,
  REQUIRED_FEATURES: [
    'texture-compression-bc',
    'timestamp-query',
  ] as GPUFeatureName[],
  REQUIRED_LIMITS: {
    maxTextureDimension2D: 8192,
    maxBufferSize: 256 << 20, // 256MB
    maxComputeWorkgroupSizeX: 256,
    maxComputeWorkgroupSizeY: 256,
    maxComputeWorkgroupSizeZ: 64,
  },
  COMPUTE_SHADER_WORKGROUP_SIZE: 8,
  MAX_UNIFORM_BUFFERS: 16,
  MAX_STORAGE_BUFFERS: 8,
  MAX_TEXTURES: 32,
  FRAME_BUFFER_FORMAT: 'bgra8unorm' as GPUTextureFormat,
  DEPTH_FORMAT: 'depth24plus' as GPUTextureFormat,
} as const

// --- WebGPU Types ---

/**
 * WebGPU device capability
 */
export interface WebGPUCapabilities {
  isSupported: boolean
  adapterInfo?: {
    vendor: string
    architecture: string
    device: string
    description: string
  }
  features: string[]
  limits: Record<string, number>
  textureFormats: string[]
}

/**
 * WebGPU render pipeline
 */
export interface WebGPURenderPipeline {
  name: string
  pipeline: GPURenderPipeline
  bindGroupLayout: GPUBindGroupLayout
  uniformBuffer: GPUBuffer
  storageBuffers: Map<string, GPUBuffer>
  textures: Map<string, GPUTexture>
  samplers: Map<string, GPUSampler>
  lastUsed: number
  usageCount: number
}

/**
 * WebGPU compute pipeline
 */
export interface WebGPUComputePipeline {
  name: string
  pipeline: GPUComputePipeline
  bindGroupLayout: GPUBindGroupLayout
  workgroupSize: [number, number, number]
  buffers: Map<string, GPUBuffer>
  textures: Map<string, GPUTexture>
  uniformBuffer: GPUBuffer
  lastUsed: number
  usageCount: number
}

/**
 * WebGPU buffer manager
 */
export interface BufferManager {
  uniformBuffers: Map<string, GPUBuffer>
  storageBuffers: Map<string, GPUBuffer>
  indexBuffers: Map<string, GPUBuffer>
  vertexBuffers: Map<string, GPUBuffer>
  stagingBuffers: GPUBuffer[]
  memoryUsage: number
  allocationCount: number
}

/**
 * WebGPU texture manager
 */
export interface TextureManager {
  textures: Map<string, GPUTexture>
  textureViews: Map<string, GPUTextureView>
  samplers: Map<string, GPUSampler>
  textureAtlas: GPUTexture | null
  memoryUsage: number
  allocationCount: number
}

/**
 * WebGPU command encoder pool
 */
export interface CommandEncoderPool {
  available: GPUCommandEncoder[]
  inUse: Set<GPUCommandEncoder>
  maxEncoders: number
}

/**
 * WebGPU renderer state
 */
export interface WebGPURendererState {
  device: GPUDevice | null
  adapter: GPUAdapter | null
  context: GPUCanvasContext | null
  capabilities: WebGPUCapabilities
  renderPipelines: Map<string, WebGPURenderPipeline>
  computePipelines: Map<string, WebGPUComputePipeline>
  bufferManager: BufferManager
  textureManager: TextureManager
  commandEncoderPool: CommandEncoderPool
  currentFrame: number
  stats: {
    framesRendered: number
    drawCalls: number
    computeDispatches: number
    bufferUploads: number
    textureUploads: number
    memoryUsage: number
    gpuTime: number
  }
}

// --- WGSL Shaders ---

/**
 * Basic vertex shader for chunk rendering
 */
const CHUNK_VERTEX_SHADER = `
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec3<f32>,
}

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec3<f32>,
}

struct CameraUniform {
  view_proj: mat4x4<f32>,
  view_position: vec3<f32>,
}

@group(0) @binding(0) var<uniform> camera: CameraUniform;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  let world_position = input.position;
  output.clip_position = camera.view_proj * vec4<f32>(world_position, 1.0);
  output.world_position = world_position;
  output.normal = input.normal;
  output.uv = input.uv;
  output.color = input.color;
  
  return output;
}
`

/**
 * Basic fragment shader for chunk rendering
 */
const CHUNK_FRAGMENT_SHADER = `
struct FragmentInput {
  @location(0) world_position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec3<f32>,
}

struct LightingUniform {
  sun_direction: vec3<f32>,
  sun_color: vec3<f32>,
  ambient_color: vec3<f32>,
  fog_color: vec3<f32>,
  fog_start: f32,
  fog_end: f32,
}

@group(0) @binding(1) var<uniform> lighting: LightingUniform;
@group(1) @binding(0) var texture_atlas: texture_2d<f32>;
@group(1) @binding(1) var texture_sampler: sampler;

@fragment
fn fs_main(input: FragmentInput) -> @location(0) vec4<f32> {
  let texture_color = textureSample(texture_atlas, texture_sampler, input.uv);
  
  // Simple Lambert lighting
  let normal = normalize(input.normal);
  let light_intensity = max(0.0, dot(normal, -lighting.sun_direction));
  let diffuse = lighting.sun_color * light_intensity;
  let ambient = lighting.ambient_color;
  
  var final_color = texture_color.rgb * input.color * (diffuse + ambient);
  
  // Simple fog
  let distance = length(input.world_position);
  let fog_factor = smoothstep(lighting.fog_start, lighting.fog_end, distance);
  final_color = mix(final_color, lighting.fog_color, fog_factor);
  
  return vec4<f32>(final_color, texture_color.a);
}
`

/**
 * Terrain generation compute shader
 */
const TERRAIN_COMPUTE_SHADER = `
struct TerrainParams {
  chunk_x: i32,
  chunk_z: i32,
  seed: u32,
  octaves: u32,
  persistence: f32,
  lacunarity: f32,
  scale: f32,
  sea_level: f32,
  max_height: f32,
}

@group(0) @binding(0) var<storage, read_write> height_map: array<f32>;
@group(0) @binding(1) var<storage, read_write> block_data: array<u32>;
@group(0) @binding(2) var<uniform> params: TerrainParams;

fn hash(p: vec2<f32>) -> f32 {
  var h = dot(p, vec2<f32>(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

fn noise(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  
  let a = hash(i);
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));
  
  let u = f * f * (3.0 - 2.0 * f);
  
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

fn fractal_noise(p: vec2<f32>) -> f32 {
  var value = 0.0;
  var amplitude = 1.0;
  var frequency = params.scale;
  
  for (var i = 0u; i < params.octaves; i++) {
    value += noise(p * frequency) * amplitude;
    amplitude *= params.persistence;
    frequency *= params.lacunarity;
  }
  
  return value;
}

@compute @workgroup_size(8, 8)
fn cs_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let z = global_id.y;
  
  if (x >= 16u || z >= 16u) {
    return;
  }
  
  let world_x = f32(params.chunk_x * 16 + i32(x));
  let world_z = f32(params.chunk_z * 16 + i32(z));
  
  let height_noise = fractal_noise(vec2<f32>(world_x, world_z) + vec2<f32>(f32(params.seed)));
  let height = params.sea_level + height_noise * (params.max_height - params.sea_level);
  
  let height_map_index = x + z * 16u;
  height_map[height_map_index] = height;
  
  // Generate block data
  for (var y = 0u; y < 256u; y++) {
    let block_index = x + y * 16u + z * 16u * 256u;
    
    if (f32(y) <= height) {
      if (f32(y) == floor(height)) {
        block_data[block_index] = 1u; // Grass
      } else if (f32(y) > height - 3.0) {
        block_data[block_index] = 2u; // Dirt
      } else {
        block_data[block_index] = 3u; // Stone
      }
    } else {
      block_data[block_index] = 0u; // Air
    }
  }
}
`

// --- Memory Pools ---

const _bufferPool = new ObjectPool<GPUBuffer>(
  () => {
    throw new Error('Buffer pool items must be created dynamically')
  },
  (buffer) => {
    if (buffer) buffer.destroy()
  },
  64
)


// --- Utility Functions ---

/**
 * Detect WebGPU capabilities
 */
const detectWebGPUCapabilities = async (): Promise<WebGPUCapabilities> => {
  if (!navigator.gpu) {
    return {
      isSupported: false,
      features: [],
      limits: {},
      textureFormats: [],
    }
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: CONFIG.ADAPTER_POWER_PREFERENCE,
    })

    if (!adapter) {
      return {
        isSupported: false,
        features: [],
        limits: {},
        textureFormats: [],
      }
    }

    const adapterInfo = await adapter.requestAdapterInfo()
    
    return {
      isSupported: true,
      adapterInfo: {
        vendor: adapterInfo.vendor,
        architecture: adapterInfo.architecture,
        device: adapterInfo.device,
        description: adapterInfo.description,
      },
      features: Array.from(adapter.features),
      limits: Object.fromEntries(
        Object.entries(adapter.limits).map(([key, value]) => [key, Number(value)])
      ),
      textureFormats: ['bgra8unorm', 'rgba8unorm', 'depth24plus'], // Common formats
    }
  } catch (error) {
    return {
      isSupported: false,
      features: [],
      limits: {},
      textureFormats: [],
    }
  }
}

/**
 * Create WebGPU device
 */
const createWebGPUDevice = async (adapter: GPUAdapter): Promise<GPUDevice> => {
  const requiredFeatures = CONFIG.REQUIRED_FEATURES.filter(feature => 
    adapter.features.has(feature)
  )

  return await adapter.requestDevice({
    requiredFeatures,
    requiredLimits: CONFIG.REQUIRED_LIMITS,
  })
}

/**
 * Create render pipeline
 */
const createRenderPipeline = (
  device: GPUDevice,
  name: string,
  vertexShader: string,
  fragmentShader: string,
  format: GPUTextureFormat
): WebGPURenderPipeline => {
  const shaderModule = device.createShaderModule({
    code: vertexShader + '\n' + fragmentShader,
  })

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  })

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  })

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 44, // 3*4 + 3*4 + 2*4 + 3*4 = 44 bytes
        attributes: [
          { format: 'float32x3', offset: 0, shaderLocation: 0 }, // position
          { format: 'float32x3', offset: 12, shaderLocation: 1 }, // normal
          { format: 'float32x2', offset: 24, shaderLocation: 2 }, // uv
          { format: 'float32x3', offset: 32, shaderLocation: 3 }, // color
        ],
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' },
          alpha: { srcFactor: 'one', dstFactor: 'zero' },
        },
      }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: CONFIG.DEPTH_FORMAT,
    },
  })

  const uniformBuffer = device.createBuffer({
    size: 256, // Enough for camera and lighting uniforms
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  return {
    name,
    pipeline,
    bindGroupLayout,
    uniformBuffer,
    storageBuffers: new Map(),
    textures: new Map(),
    samplers: new Map(),
    lastUsed: Date.now(),
    usageCount: 0,
  }
}

/**
 * Create compute pipeline
 */
const createComputePipeline = (
  device: GPUDevice,
  name: string,
  computeShader: string
): WebGPUComputePipeline => {
  const shaderModule = device.createShaderModule({
    code: computeShader,
  })

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      },
    ],
  })

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  })

  const pipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: 'cs_main',
    },
  })

  const uniformBuffer = device.createBuffer({
    size: 64, // Terrain parameters
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  return {
    name,
    pipeline,
    bindGroupLayout,
    workgroupSize: [CONFIG.COMPUTE_SHADER_WORKGROUP_SIZE, CONFIG.COMPUTE_SHADER_WORKGROUP_SIZE, 1],
    buffers: new Map(),
    textures: new Map(),
    uniformBuffer,
    lastUsed: Date.now(),
    usageCount: 0,
  }
}

// --- Service Interface ---

export interface WebGPURendererService {
  initialize: (canvas: HTMLCanvasElement) => Effect.Effect<boolean, never, never>
  createRenderPipeline: (name: string, vertexShader: string, fragmentShader: string) => Effect.Effect<void, never, never>
  createComputePipeline: (name: string, computeShader: string) => Effect.Effect<void, never, never>
  beginFrame: () => Effect.Effect<GPUCommandEncoder, never, never>
  endFrame: (encoder: GPUCommandEncoder) => Effect.Effect<void, never, never>
  createBuffer: (name: string, size: number, usage: GPUBufferUsageFlags) => Effect.Effect<GPUBuffer, never, never>
  createTexture: (name: string, width: number, height: number, format: GPUTextureFormat) => Effect.Effect<GPUTexture, never, never>
  dispatchCompute: (pipelineName: string, workgroupsX: number, workgroupsY: number, workgroupsZ: number) => Effect.Effect<void, never, never>
  getCapabilities: () => Effect.Effect<WebGPUCapabilities, never, never>
  getStats: () => Effect.Effect<WebGPURendererState['stats'], never, never>
  dispose: () => Effect.Effect<void, never, never>
}

export const WebGPURendererService = Effect.Tag<WebGPURendererService>('WebGPURendererService')

// --- Service Implementation ---

export const WebGPURendererLive = Layer.effect(
  WebGPURendererService,
  Effect.gen(function* (_) {
    
    const initialState: WebGPURendererState = {
      device: null,
      adapter: null,
      context: null,
      capabilities: {
        isSupported: false,
        features: [],
        limits: {},
        textureFormats: [],
      },
      renderPipelines: new Map(),
      computePipelines: new Map(),
      bufferManager: {
        uniformBuffers: new Map(),
        storageBuffers: new Map(),
        indexBuffers: new Map(),
        vertexBuffers: new Map(),
        stagingBuffers: [],
        memoryUsage: 0,
        allocationCount: 0,
      },
      textureManager: {
        textures: new Map(),
        textureViews: new Map(),
        samplers: new Map(),
        textureAtlas: null,
        memoryUsage: 0,
        allocationCount: 0,
      },
      commandEncoderPool: {
        available: [],
        inUse: new Set(),
        maxEncoders: 4,
      },
      currentFrame: 0,
      stats: {
        framesRendered: 0,
        drawCalls: 0,
        computeDispatches: 0,
        bufferUploads: 0,
        textureUploads: 0,
        memoryUsage: 0,
        gpuTime: 0,
      },
    }

    const stateRef = yield* _(Ref.make(initialState))

    return {
      initialize: (canvas: HTMLCanvasElement) =>
        Effect.gen(function* () {
          if (!CONFIG.WEBGPU_ENABLED) return false

          const capabilities = yield* _(Effect.promise(() => detectWebGPUCapabilities()))
          
          if (!capabilities.isSupported) {
            yield* _(Ref.update(stateRef, s => ({ ...s, capabilities })))
            return false
          }

          const adapter = yield* _(Effect.promise(() => navigator.gpu.requestAdapter({
            powerPreference: CONFIG.ADAPTER_POWER_PREFERENCE,
          })))

          if (!adapter) return false

          const device = yield* _(Effect.promise(() => createWebGPUDevice(adapter)))
          const context = canvas.getContext('webgpu')

          if (!context) return false

          context.configure({
            device,
            format: CONFIG.FRAME_BUFFER_FORMAT,
            alphaMode: 'premultiplied',
          })

          // Create default pipelines
          const chunkRenderPipeline = createRenderPipeline(
            device,
            'chunk',
            CHUNK_VERTEX_SHADER,
            CHUNK_FRAGMENT_SHADER,
            CONFIG.FRAME_BUFFER_FORMAT
          )

          const terrainComputePipeline = createComputePipeline(
            device,
            'terrain',
            TERRAIN_COMPUTE_SHADER
          )

          yield* _(Ref.update(stateRef, s => ({
            ...s,
            device,
            adapter,
            context,
            capabilities,
            renderPipelines: new Map([['chunk', chunkRenderPipeline]]),
            computePipelines: new Map([['terrain', terrainComputePipeline]]),
          })))

          console.log('WebGPU initialized successfully')
          console.log('Adapter:', capabilities.adapterInfo)
          console.log('Features:', capabilities.features)

          return true
        }),

      createRenderPipeline: (name: string, vertexShader: string, fragmentShader: string) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          if (!state.device) {
            throw new Error('WebGPU device not initialized')
          }

          const pipeline = createRenderPipeline(
            state.device,
            name,
            vertexShader,
            fragmentShader,
            CONFIG.FRAME_BUFFER_FORMAT
          )

          yield* _(Ref.update(stateRef, s => ({
            ...s,
            renderPipelines: new Map([...s.renderPipelines, [name, pipeline]])
          })))
        }),

      createComputePipeline: (name: string, computeShader: string) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          if (!state.device) {
            throw new Error('WebGPU device not initialized')
          }

          const pipeline = createComputePipeline(state.device, name, computeShader)

          yield* _(Ref.update(stateRef, s => ({
            ...s,
            computePipelines: new Map([...s.computePipelines, [name, pipeline]])
          })))
        }),

      beginFrame: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          if (!state.device) {
            throw new Error('WebGPU device not initialized')
          }

          const encoder = state.device.createCommandEncoder()

          yield* _(Ref.update(stateRef, s => ({
            ...s,
            commandEncoderPool: {
              ...s.commandEncoderPool,
              inUse: new Set([...s.commandEncoderPool.inUse, encoder])
            }
          })))

          return encoder
        }),

      endFrame: (encoder: GPUCommandEncoder) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          if (!state.device) {
            throw new Error('WebGPU device not initialized')
          }

          const commandBuffer = encoder.finish()
          state.device.queue.submit([commandBuffer])

          yield* _(Ref.update(stateRef, s => ({
            ...s,
            currentFrame: s.currentFrame + 1,
            commandEncoderPool: {
              ...s.commandEncoderPool,
              inUse: new Set([...s.commandEncoderPool.inUse].filter(e => e !== encoder))
            },
            stats: {
              ...s.stats,
              framesRendered: s.stats.framesRendered + 1
            }
          })))
        }),

      createBuffer: (name: string, size: number, usage: GPUBufferUsageFlags) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          if (!state.device) {
            throw new Error('WebGPU device not initialized')
          }

          const buffer = state.device.createBuffer({
            size,
            usage,
            mappedAtCreation: false,
          })

          // Store in appropriate buffer manager category
          const bufferManager = state.bufferManager
          if (usage & GPUBufferUsage.UNIFORM) {
            bufferManager.uniformBuffers.set(name, buffer)
          } else if (usage & GPUBufferUsage.STORAGE) {
            bufferManager.storageBuffers.set(name, buffer)
          } else if (usage & GPUBufferUsage.INDEX) {
            bufferManager.indexBuffers.set(name, buffer)
          } else if (usage & GPUBufferUsage.VERTEX) {
            bufferManager.vertexBuffers.set(name, buffer)
          }

          yield* _(Ref.update(stateRef, s => ({
            ...s,
            bufferManager: {
              ...bufferManager,
              memoryUsage: bufferManager.memoryUsage + size,
              allocationCount: bufferManager.allocationCount + 1,
            },
            stats: {
              ...s.stats,
              bufferUploads: s.stats.bufferUploads + 1,
              memoryUsage: s.stats.memoryUsage + size,
            }
          })))

          return buffer
        }),

      createTexture: (name: string, width: number, height: number, format: GPUTextureFormat) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          if (!state.device) {
            throw new Error('WebGPU device not initialized')
          }

          const texture = state.device.createTexture({
            size: { width, height },
            format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
          })

          const textureView = texture.createView()
          const memoryUsage = width * height * 4 // Assume 4 bytes per pixel

          yield* _(Ref.update(stateRef, s => ({
            ...s,
            textureManager: {
              ...s.textureManager,
              textures: new Map([...s.textureManager.textures, [name, texture]]),
              textureViews: new Map([...s.textureManager.textureViews, [name, textureView]]),
              memoryUsage: s.textureManager.memoryUsage + memoryUsage,
              allocationCount: s.textureManager.allocationCount + 1,
            },
            stats: {
              ...s.stats,
              textureUploads: s.stats.textureUploads + 1,
              memoryUsage: s.stats.memoryUsage + memoryUsage,
            }
          })))

          return texture
        }),

      dispatchCompute: (pipelineName: string, workgroupsX: number, workgroupsY: number, workgroupsZ: number) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          if (!state.device) {
            throw new Error('WebGPU device not initialized')
          }

          const pipeline = state.computePipelines.get(pipelineName)
          if (!pipeline) {
            throw new Error(`Compute pipeline '${pipelineName}' not found`)
          }

          const encoder = state.device.createCommandEncoder()
          const computePass = encoder.beginComputePass()
          
          computePass.setPipeline(pipeline.pipeline)
          computePass.dispatchWorkgroups(workgroupsX, workgroupsY, workgroupsZ)
          computePass.end()

          const commandBuffer = encoder.finish()
          state.device.queue.submit([commandBuffer])

          pipeline.lastUsed = Date.now()
          pipeline.usageCount++

          yield* _(Ref.update(stateRef, s => ({
            ...s,
            stats: {
              ...s.stats,
              computeDispatches: s.stats.computeDispatches + 1,
            }
          })))
        }),

      getCapabilities: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          return state.capabilities
        }),

      getStats: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          return state.stats
        }),

      dispose: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))

          // Dispose all resources
          for (const buffer of state.bufferManager.uniformBuffers.values()) {
            buffer.destroy()
          }
          for (const buffer of state.bufferManager.storageBuffers.values()) {
            buffer.destroy()
          }
          for (const buffer of state.bufferManager.indexBuffers.values()) {
            buffer.destroy()
          }
          for (const buffer of state.bufferManager.vertexBuffers.values()) {
            buffer.destroy()
          }

          for (const texture of state.textureManager.textures.values()) {
            texture.destroy()
          }

          if (state.device) {
            state.device.destroy()
          }

          yield* _(Ref.set(stateRef, initialState))
        }),
    }
  })
  // .pipe(Effect.provide(WASMIntegrationService))
)

// Export types and configuration
export type { 
  WebGPURendererState, 
  WebGPUCapabilities, 
  WebGPURenderPipeline, 
  WebGPUComputePipeline,
  BufferManager,
  TextureManager 
}
export { CONFIG as WebGPURendererConfig }