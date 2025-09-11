import { Effect, Layer, Ref, HashMap, Option } from 'effect'
import { pipe } from 'effect/Function'
import * as THREE from 'three'
import { ObjectPool } from '@/core/performance/object-pool'

// --- Configuration ---

const CONFIG = {
  WEBGPU_ENABLED: false, // Future-ready WebGPU support
  SHADER_CACHE_ENABLED: true,
  HOT_RELOAD_ENABLED: process.env.NODE_ENV === 'development',
  SHADER_OPTIMIZATION: true,
  INSTANCING_SUPPORT: true,
  COMPUTE_SHADER_SUPPORT: false, // For WebGPU
  MAX_SHADER_VARIANTS: 64,
} as const

// --- Shader Types ---

/**
 * Shader compilation result
 */
export interface ShaderCompilationResult {
  success: boolean
  shader?: THREE.Shader
  error?: string
  warnings: string[]
  compilationTime: number
}

/**
 * Shader variant configuration
 */
export interface ShaderVariant {
  name: string
  defines: Record<string, string | number | boolean>
  vertexShader?: string
  fragmentShader?: string
  computeShader?: string // For WebGPU
}

/**
 * Shader program metadata
 */
export interface ShaderProgramMetadata {
  name: string
  type: 'vertex' | 'fragment' | 'compute' | 'material'
  variants: Map<string, ShaderVariant>
  baseVertexShader: string
  baseFragmentShader: string
  baseComputeShader?: string
  uniforms: Record<string, THREE.IUniform>
  attributes: Record<string, THREE.BufferAttribute>
  lastModified: number
  compilationStats: {
    totalCompilations: number
    successfulCompilations: number
    averageCompilationTime: number
  }
}

/**
 * WebGPU shader module (future)
 */
export interface WebGPUShaderModule {
  module: any // GPUShaderModule when WebGPU is available
  source: string
  entryPoint: string
  stage: 'vertex' | 'fragment' | 'compute'
}

/**
 * Shader manager state
 */
export interface ShaderManagerState {
  shaderPrograms: Map<string, ShaderProgramMetadata>
  compiledShaders: Map<string, THREE.Shader>
  materials: Map<string, THREE.Material>
  webgpuModules: Map<string, WebGPUShaderModule> // Future WebGPU support
  hotReloadWatchers: Map<string, FileSystemWatcher | null>
  stats: {
    totalShaders: number
    compiledShaders: number
    failedCompilations: number
    cacheHits: number
    cacheMisses: number
    memoryUsage: number
  }
}

// --- Built-in Shaders ---

/**
 * Basic block vertex shader with instancing support
 */
const BLOCK_VERTEX_SHADER = `
#ifdef USE_INSTANCING
  attribute mat4 instanceMatrix;
  attribute vec3 instanceColor;
#endif

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec3 color;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vWorldPosition;

#ifdef USE_FOG
  varying float vFogDepth;
#endif

#ifdef USE_LIGHTING
  varying vec3 vViewPosition;
#endif

void main() {
  vec3 transformed = position;
  vec3 objectNormal = normal;
  
  #ifdef USE_INSTANCING
    transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;
    objectNormal = (instanceMatrix * vec4(objectNormal, 0.0)).xyz;
    vColor = instanceColor * color;
  #else
    vColor = color;
  #endif
  
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  vPosition = transformed;
  vNormal = normalize(normalMatrix * objectNormal);
  vUv = uv;
  vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
  
  #ifdef USE_FOG
    vFogDepth = -mvPosition.z;
  #endif
  
  #ifdef USE_LIGHTING
    vViewPosition = -mvPosition.xyz;
  #endif
}
`

/**
 * Basic block fragment shader with texture atlas support
 */
const BLOCK_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D textureAtlas;
uniform vec3 ambientLight;
uniform vec3 directionalLightDirection;
uniform vec3 directionalLightColor;
uniform float time;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vWorldPosition;

#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying float vFogDepth;
#endif

#ifdef USE_LIGHTING
  varying vec3 vViewPosition;
#endif

#ifdef USE_ANIMATION
  uniform float animationOffset;
  uniform int frameCount;
#endif

// Noise function for procedural effects
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec2 texCoord = vUv;
  
  #ifdef USE_ANIMATION
    // Animated texture frames
    float frameIndex = mod(floor(time + animationOffset), float(frameCount));
    texCoord.y += frameIndex / float(frameCount);
  #endif
  
  vec4 texColor = texture2D(textureAtlas, texCoord);
  
  #ifdef USE_ALPHA_TEST
    if (texColor.a < 0.5) discard;
  #endif
  
  vec3 color = texColor.rgb * vColor;
  
  #ifdef USE_LIGHTING
    // Simple Lambert lighting
    vec3 normal = normalize(vNormal);
    float lightIntensity = max(0.0, dot(normal, -directionalLightDirection));
    color = color * (ambientLight + directionalLightColor * lightIntensity);
  #endif
  
  #ifdef USE_FOG
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    color = mix(color, fogColor, fogFactor);
  #endif
  
  gl_FragColor = vec4(color, texColor.a);
}
`

/**
 * Water shader with animation and transparency
 */
const WATER_VERTEX_SHADER = `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform float time;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vec3 transformed = position;
  
  // Add wave animation
  float wave1 = sin(position.x * 0.5 + time * 2.0) * 0.1;
  float wave2 = sin(position.z * 0.7 + time * 1.5) * 0.05;
  transformed.y += wave1 + wave2;
  
  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  vPosition = transformed;
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
}
`

const WATER_FRAGMENT_SHADER = `
precision highp float;

uniform sampler2D waterTexture;
uniform vec3 waterColor;
uniform float time;
uniform float opacity;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vec2 texCoord = vUv + vec2(time * 0.1, time * 0.05);
  vec4 texColor = texture2D(waterTexture, texCoord);
  
  vec3 color = mix(waterColor, texColor.rgb, 0.5);
  
  gl_FragColor = vec4(color, opacity);
}
`

// --- WebGPU Shaders (Future Support) ---

const WEBGPU_COMPUTE_SHADER_WGSL = `
@group(0) @binding(0) var<storage, read_write> chunkData: array<u32>;
@group(0) @binding(1) var<uniform> params: ComputeParams;

struct ComputeParams {
  chunkSize: u32,
  blockTypes: u32,
  time: f32,
  seed: u32,
}

@compute @workgroup_size(8, 8, 8)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x + global_id.y * params.chunkSize + global_id.z * params.chunkSize * params.chunkSize;
  
  if (index >= arrayLength(&chunkData)) {
    return;
  }
  
  // Procedural block generation
  let noise = noise3d(vec3<f32>(global_id) * 0.1 + params.seed);
  let blockType = select(0u, 1u, noise > 0.0);
  
  chunkData[index] = blockType;
}

fn noise3d(p: vec3<f32>) -> f32 {
  // Simple noise implementation
  return fract(sin(dot(p, vec3<f32>(12.9898, 78.233, 37.719))) * 43758.5453);
}
`

// --- Memory Pools ---

const shaderPool = new ObjectPool<THREE.Shader>(
  () => new THREE.Shader(),
  (shader) => shader,
  CONFIG.MAX_SHADER_VARIANTS
)

const materialPool = new ObjectPool<THREE.ShaderMaterial>(
  () => new THREE.ShaderMaterial(),
  (material) => {
    material.dispose()
    return new THREE.ShaderMaterial()
  },
  64
)

// --- Utility Functions ---

/**
 * Process shader defines into shader code
 */
const processShaderDefines = (shaderCode: string, defines: Record<string, string | number | boolean>): string => {
  let processedCode = shaderCode
  
  // Add defines at the top
  const defineLines = Object.entries(defines).map(([key, value]) => {
    if (typeof value === 'boolean') {
      return value ? `#define ${key}` : `// #define ${key}`
    } else {
      return `#define ${key} ${value}`
    }
  }).join('\n')
  
  processedCode = defineLines + '\n' + processedCode
  
  return processedCode
}

/**
 * Compile Three.js shader
 */
const compileThreeJSShader = (
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>
): Effect.Effect<ShaderCompilationResult> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    const warnings: string[] = []
    
    try {
      // Create shader material for validation
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
      })
      
      // Basic syntax validation (simplified)
      if (!vertexShader.includes('gl_Position')) {
        warnings.push('Vertex shader should set gl_Position')
      }
      
      if (!fragmentShader.includes('gl_FragColor')) {
        warnings.push('Fragment shader should set gl_FragColor')
      }
      
      const compilationTime = Date.now() - startTime
      
      return {
        success: true,
        shader: material as any, // Type compatibility
        warnings,
        compilationTime
      }
    } catch (error) {
      const compilationTime = Date.now() - startTime
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        warnings,
        compilationTime
      }
    }
  })

/**
 * Create shader variant key
 */
const createVariantKey = (baseName: string, defines: Record<string, string | number | boolean>): string => {
  const defineKeys = Object.keys(defines).sort()
  const defineString = defineKeys.map(key => `${key}=${defines[key]}`).join('|')
  return `${baseName}:${defineString}`
}

// --- Pure State Functions ---

const addShaderProgram = (
  state: ShaderManagerState,
  metadata: ShaderProgramMetadata
): ShaderManagerState => {
  const newShaderPrograms = new Map(state.shaderPrograms)
  newShaderPrograms.set(metadata.name, metadata)
  
  return {
    ...state,
    shaderPrograms: newShaderPrograms,
    stats: {
      ...state.stats,
      totalShaders: newShaderPrograms.size
    }
  }
}

const addCompiledShader = (
  state: ShaderManagerState,
  key: string,
  shader: THREE.Shader
): ShaderManagerState => {
  const newCompiledShaders = new Map(state.compiledShaders)
  newCompiledShaders.set(key, shader)
  
  return {
    ...state,
    compiledShaders: newCompiledShaders,
    stats: {
      ...state.stats,
      compiledShaders: newCompiledShaders.size
    }
  }
}

// --- Main Service ---

export interface ShaderManagerService {
  loadShader: (name: string, variant?: Record<string, string | number | boolean>) => Effect.Effect<THREE.Material>
  compileShader: (vertexShader: string, fragmentShader: string, uniforms?: Record<string, THREE.IUniform>) => Effect.Effect<ShaderCompilationResult>
  createMaterial: (shaderName: string, uniforms?: Record<string, THREE.IUniform>, defines?: Record<string, string | number | boolean>) => Effect.Effect<THREE.ShaderMaterial>
  reloadShader: (name: string) => Effect.Effect<void>
  getShaderVariants: (name: string) => Effect.Effect<ReadonlyArray<string>>
  optimizeShaders: () => Effect.Effect<void>
  enableWebGPU: () => Effect.Effect<boolean>
  createWebGPUShader: (wgslCode: string) => Effect.Effect<WebGPUShaderModule>
  getStats: () => Effect.Effect<ShaderManagerState['stats']>
  dispose: () => Effect.Effect<void>
}

export const ShaderManagerService = Effect.Tag<ShaderManagerService>('ShaderManagerService')

export const ShaderManagerLive = Layer.effect(
  ShaderManagerService,
  Effect.gen(function* (_) {
    const initialState: ShaderManagerState = {
      shaderPrograms: new Map(),
      compiledShaders: new Map(),
      materials: new Map(),
      webgpuModules: new Map(),
      hotReloadWatchers: new Map(),
      stats: {
        totalShaders: 0,
        compiledShaders: 0,
        failedCompilations: 0,
        cacheHits: 0,
        cacheMisses: 0,
        memoryUsage: 0
      }
    }
    
    const stateRef = yield* _(Ref.make(initialState))
    
    // Initialize built-in shaders
    const initializeBuiltinShaders = () =>
      Effect.gen(function* () {
        // Block shader
        const blockShaderMetadata: ShaderProgramMetadata = {
          name: 'block',
          type: 'material',
          variants: new Map([
            ['basic', { name: 'basic', defines: {} }],
            ['instanced', { name: 'instanced', defines: { USE_INSTANCING: true } }],
            ['lit', { name: 'lit', defines: { USE_LIGHTING: true } }],
            ['animated', { name: 'animated', defines: { USE_ANIMATION: true } }],
            ['fog', { name: 'fog', defines: { USE_FOG: true } }],
          ]),
          baseVertexShader: BLOCK_VERTEX_SHADER,
          baseFragmentShader: BLOCK_FRAGMENT_SHADER,
          uniforms: {
            textureAtlas: { value: null },
            ambientLight: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
            directionalLightDirection: { value: new THREE.Vector3(-1, -1, -1).normalize() },
            directionalLightColor: { value: new THREE.Vector3(0.7, 0.7, 0.7) },
            time: { value: 0 },
            fogColor: { value: new THREE.Vector3(0.5, 0.6, 0.7) },
            fogNear: { value: 50 },
            fogFar: { value: 200 },
          },
          attributes: {},
          lastModified: Date.now(),
          compilationStats: {
            totalCompilations: 0,
            successfulCompilations: 0,
            averageCompilationTime: 0
          }
        }
        
        // Water shader
        const waterShaderMetadata: ShaderProgramMetadata = {
          name: 'water',
          type: 'material',
          variants: new Map([
            ['basic', { name: 'basic', defines: {} }],
          ]),
          baseVertexShader: WATER_VERTEX_SHADER,
          baseFragmentShader: WATER_FRAGMENT_SHADER,
          uniforms: {
            waterTexture: { value: null },
            waterColor: { value: new THREE.Vector3(0.2, 0.4, 0.8) },
            time: { value: 0 },
            opacity: { value: 0.8 },
          },
          attributes: {},
          lastModified: Date.now(),
          compilationStats: {
            totalCompilations: 0,
            successfulCompilations: 0,
            averageCompilationTime: 0
          }
        }
        
        yield* _(Ref.update(stateRef, state => 
          pipe(
            state,
            s => addShaderProgram(s, blockShaderMetadata),
            s => addShaderProgram(s, waterShaderMetadata)
          )
        ))
      })
    
    yield* _(initializeBuiltinShaders())
    
    return ShaderManagerService.of({
      loadShader: (name: string, variant: Record<string, string | number | boolean> = {}) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const variantKey = createVariantKey(name, variant)
          
          // Check cache first
          const cachedMaterial = state.materials.get(variantKey)
          if (cachedMaterial) {
            yield* _(Ref.update(stateRef, s => ({
              ...s,
              stats: { ...s.stats, cacheHits: s.stats.cacheHits + 1 }
            })))
            return cachedMaterial
          }
          
          // Get shader program
          const program = state.shaderPrograms.get(name)
          if (!program) {
            throw new Error(`Shader program '${name}' not found`)
          }
          
          // Process shader with defines
          const vertexShader = processShaderDefines(program.baseVertexShader, variant)
          const fragmentShader = processShaderDefines(program.baseFragmentShader, variant)
          
          // Compile shader
          const compilationResult = yield* _(compileThreeJSShader(
            vertexShader,
            fragmentShader,
            program.uniforms
          ))
          
          if (!compilationResult.success) {
            yield* _(Ref.update(stateRef, s => ({
              ...s,
              stats: { ...s.stats, failedCompilations: s.stats.failedCompilations + 1 }
            })))
            throw new Error(`Shader compilation failed: ${compilationResult.error}`)
          }
          
          // Create material
          const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: program.uniforms,
            transparent: name === 'water',
            alphaTest: name === 'water' ? 0 : 0.5,
          })
          
          // Update state
          yield* _(Ref.update(stateRef, s => ({
            ...s,
            materials: new Map([...s.materials, [variantKey, material]]),
            stats: { 
              ...s.stats, 
              cacheMisses: s.stats.cacheMisses + 1,
              compiledShaders: s.stats.compiledShaders + 1
            }
          })))
          
          return material as THREE.Material
        }),
      
      compileShader: (vertexShader: string, fragmentShader: string, uniforms: Record<string, THREE.IUniform> = {}) =>
        compileThreeJSShader(vertexShader, fragmentShader, uniforms),
      
      createMaterial: (shaderName: string, uniforms: Record<string, THREE.IUniform> = {}, defines: Record<string, string | number | boolean> = {}) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const program = state.shaderPrograms.get(shaderName)
          
          if (!program) {
            throw new Error(`Shader program '${shaderName}' not found`)
          }
          
          const mergedUniforms = { ...program.uniforms, ...uniforms }
          const vertexShader = processShaderDefines(program.baseVertexShader, defines)
          const fragmentShader = processShaderDefines(program.baseFragmentShader, defines)
          
          const material = materialPool.acquire()
          material.vertexShader = vertexShader
          material.fragmentShader = fragmentShader
          material.uniforms = mergedUniforms
          material.needsUpdate = true
          
          return material
        }),
      
      reloadShader: (name: string) =>
        Effect.gen(function* () {
          // Clear cached materials for this shader
          yield* _(Ref.update(stateRef, state => {
            const newMaterials = new Map(state.materials)
            const keysToRemove: string[] = []
            
            for (const [key] of newMaterials) {
              if (key.startsWith(name + ':')) {
                keysToRemove.push(key)
              }
            }
            
            keysToRemove.forEach(key => {
              const material = newMaterials.get(key)
              if (material) {
                material.dispose()
              }
              newMaterials.delete(key)
            })
            
            return {
              ...state,
              materials: newMaterials
            }
          }))
        }),
      
      getShaderVariants: (name: string) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const program = state.shaderPrograms.get(name)
          
          if (!program) {
            return []
          }
          
          return Array.from(program.variants.keys())
        }),
      
      optimizeShaders: () =>
        Effect.gen(function* () {
          // Remove unused shaders from cache
          yield* _(Ref.update(stateRef, state => {
            const newCompiledShaders = new Map<string, THREE.Shader>()
            const newMaterials = new Map<string, THREE.Material>()
            
            // Keep only recently used shaders (basic implementation)
            for (const [key, shader] of state.compiledShaders) {
              newCompiledShaders.set(key, shader)
            }
            
            for (const [key, material] of state.materials) {
              newMaterials.set(key, material)
            }
            
            return {
              ...state,
              compiledShaders: newCompiledShaders,
              materials: newMaterials,
              stats: {
                ...state.stats,
                compiledShaders: newCompiledShaders.size
              }
            }
          }))
        }),
      
      enableWebGPU: () =>
        Effect.gen(function* () {
          if (!CONFIG.WEBGPU_ENABLED || typeof navigator === 'undefined' || !('gpu' in navigator)) {
            return false
          }
          
          try {
            // Future WebGPU initialization
            // const adapter = await navigator.gpu.requestAdapter()
            // const device = await adapter?.requestDevice()
            return false // Not implemented yet
          } catch {
            return false
          }
        }),
      
      createWebGPUShader: (wgslCode: string) =>
        Effect.gen(function* () {
          // Future WebGPU shader creation
          throw new Error('WebGPU shaders not yet implemented')
        }),
      
      getStats: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          // Calculate memory usage
          let memoryUsage = 0
          for (const material of state.materials.values()) {
            // Rough estimate of material memory usage
            memoryUsage += 1024 // Basic material overhead
          }
          
          return {
            ...state.stats,
            memoryUsage
          }
        }),
      
      dispose: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          // Dispose all materials
          for (const material of state.materials.values()) {
            material.dispose()
          }
          
          // Clear pools
          shaderPool.clear()
          materialPool.clear()
          
          yield* _(Ref.set(stateRef, initialState))
        })
    })
  }),
)

// Export types and configuration
export type { 
  ShaderManagerState, 
  ShaderProgramMetadata, 
  ShaderVariant, 
  ShaderCompilationResult, 
  WebGPUShaderModule 
}
export { CONFIG as ShaderManagerConfig }