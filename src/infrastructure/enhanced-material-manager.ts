import { MaterialManager } from '@/runtime/services'
import { Effect, Layer, Ref } from 'effect'

import { MaterialNotFoundError } from '@/core/errors'
import * as THREE from 'three'
import { ObjectPool } from '@/core/performance/object-pool'

// --- Configuration ---

const CONFIG = {
  WEBGPU_ENABLED: false, // Future WebGPU support
  MATERIAL_CACHING: true,
  INSTANCING_SUPPORT: true,
  SHADER_VARIANTS: true,
  DYNAMIC_LOADING: true,
  OPTIMIZATION_ENABLED: true,
  MAX_MATERIALS: 256,
  CACHE_TIMEOUT: 300000, // 5 minutes
} as const

// --- Enhanced Material Types ---

/**
 * Material configuration with advanced features
 */
export interface MaterialConfig {
  name: string
  type: 'standard' | 'basic' | 'phong' | 'shader' | 'webgpu'
  shader?: string
  textures?: {
    diffuse?: string
    normal?: string
    roughness?: string
    metalness?: string
    emission?: string
    alpha?: string
  }
  properties?: {
    metalness?: number
    roughness?: number
    opacity?: number
    transparent?: boolean
    alphaTest?: number
    depthWrite?: boolean
    depthTest?: boolean
    cullFace?: boolean
  }
  features?: {
    vertexColors?: boolean
    instancing?: boolean
    lighting?: boolean
    fog?: boolean
    shadows?: boolean
    animation?: boolean
  }
  webgpu?: {
    vertexShader?: string
    fragmentShader?: string
    computeShader?: string
    bindGroupLayout?: any // GPUBindGroupLayout when available
  }
}

/**
 * Material variant for different use cases
 */
export interface MaterialVariant {
  name: string
  baseMaterial: string
  overrides: Partial<MaterialConfig>
  defines: Record<string, string | number | boolean>
  uniformOverrides?: Record<string, any>
}

/**
 * Enhanced material with metadata
 */
export interface EnhancedMaterial {
  material: THREE.Material
  config: MaterialConfig
  variant?: MaterialVariant
  lastUsed: number
  usageCount: number
  memoryUsage: number
  isOptimized: boolean
  isDirty: boolean
}

/**
 * WebGPU material (future support)
 */
export interface WebGPUMaterial {
  pipeline: any // GPURenderPipeline when available
  bindGroup: any // GPUBindGroup when available
  vertexShader: string
  fragmentShader: string
  uniforms: Map<string, any>
  textures: Map<string, any>
}

/**
 * Material manager state
 */
export interface MaterialManagerState {
  materials: Map<string, EnhancedMaterial>
  webgpuMaterials: Map<string, WebGPUMaterial>
  materialConfigs: Map<string, MaterialConfig>
  variants: Map<string, MaterialVariant>
  materialCache: Map<string, THREE.Material>
  stats: {
    totalMaterials: number
    cachedMaterials: number
    webgpuMaterials: number
    memoryUsage: number
    cacheHits: number
    cacheMisses: number
  }
}

// --- Material Configurations ---

const MATERIAL_CONFIGS: Record<string, MaterialConfig> = {
  chunk: {
    name: 'chunk',
    type: 'standard',
    properties: {
      metalness: 0,
      roughness: 1,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    },
    features: {
      vertexColors: true,
      instancing: true,
      lighting: true,
      fog: true,
      shadows: true,
    },
  },
  water: {
    name: 'water',
    type: 'standard',
    properties: {
      metalness: 0,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      depthTest: true,
    },
    features: {
      lighting: true,
      fog: true,
      animation: true,
    },
  },
  glass: {
    name: 'glass',
    type: 'standard',
    properties: {
      metalness: 0,
      roughness: 0.1,
      transparent: true,
      opacity: 0.3,
    },
    features: {
      lighting: true,
      shadows: false,
    },
  },
  terrain: {
    name: 'terrain',
    type: 'standard',
    properties: {
      metalness: 0,
      roughness: 0.8,
    },
    features: {
      instancing: true,
      lighting: true,
      fog: true,
    },
  },
  // Future WebGPU materials
  webgpu_terrain: {
    name: 'webgpu_terrain',
    type: 'webgpu',
    webgpu: {
      vertexShader: 'terrain_vertex.wgsl',
      fragmentShader: 'terrain_fragment.wgsl',
    },
  },
}

// --- Memory Pools ---

const materialPool = new ObjectPool<THREE.Material>(
  () => new THREE.MeshStandardMaterial(),
  (material: THREE.Material) => {
    material.dispose()
    return new THREE.MeshStandardMaterial()
  },
  CONFIG.MAX_MATERIALS
)

const uniformsPool = new ObjectPool<Record<string, THREE.IUniform>>(
  () => ({}),
  (uniforms: Record<string, THREE.IUniform>) => {
    Object.keys(uniforms).forEach(key => delete uniforms[key])
    return uniforms
  },
  64
)

// --- Utility Functions ---

/**
 * Create Three.js material from config
 */
const createThreeJSMaterial = (
  config: MaterialConfig,
  variant?: MaterialVariant
): THREE.Material => {
  const finalConfig = variant ? { ...config, ...variant.overrides } : config
  
  switch (finalConfig.type) {
    case 'standard':
      const standardMaterial = new THREE.MeshStandardMaterial()
      
      // Apply properties
      if (finalConfig.properties) {
        Object.assign(standardMaterial, finalConfig.properties)
      }
      
      // Apply features
      if (finalConfig.features?.vertexColors) {
        standardMaterial.vertexColors = true
      }
      
      return standardMaterial
      
    case 'basic':
      const basicMaterial = new THREE.MeshBasicMaterial()
      if (finalConfig.properties) {
        Object.assign(basicMaterial, finalConfig.properties)
      }
      return basicMaterial
      
    case 'phong':
      const phongMaterial = new THREE.MeshPhongMaterial()
      if (finalConfig.properties) {
        Object.assign(phongMaterial, finalConfig.properties)
      }
      return phongMaterial
      
    case 'shader':
      // For now, fallback to standard material
      return new THREE.MeshStandardMaterial()
      
    case 'webgpu':
      // Future WebGPU material creation
      throw new Error('WebGPU materials not yet implemented')
      
    default:
      throw new Error(`Unknown material type: ${finalConfig.type}`)
  }
}

/**
 * Calculate material memory usage
 */
const calculateMaterialMemory = (material: THREE.Material): number => {
  let size = 1024 // Base material size
  
  if (material instanceof THREE.ShaderMaterial) {
    size += material.fragmentShader.length + material.vertexShader.length
    
    // Count uniforms
    Object.values(material.uniforms).forEach(uniform => {
      if (uniform.value instanceof THREE.Texture) {
        const texture = uniform.value
        if (texture.image) {
          size += texture.image.width * texture.image.height * 4 // RGBA
        }
      }
    })
  }
  
  // Count textures
  const material_any = material as any
  ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'].forEach(prop => {
    const texture = material_any[prop]
    if (texture instanceof THREE.Texture && texture.image) {
      size += texture.image.width * texture.image.height * 4
    }
  })
  
  return size
}

// --- Enhanced Service Implementation ---

export const EnhancedMaterialManagerLive = Layer.effect(
  MaterialManager,
  Effect.gen(function* (_) {
    const initialState: MaterialManagerState = {
      materials: new Map(),
      webgpuMaterials: new Map(),
      materialConfigs: new Map(Object.entries(MATERIAL_CONFIGS)),
      variants: new Map(),
      materialCache: new Map(),
      stats: {
        totalMaterials: 0,
        cachedMaterials: 0,
        webgpuMaterials: 0,
        memoryUsage: 0,
        cacheHits: 0,
        cacheMisses: 0,
      }
    }
    
    const stateRef = yield* _(Ref.make(initialState))
    
    // Preload essential materials
    const preloadEssentials = () =>
      Effect.gen(function* () {
        const essentials = ['chunk', 'water', 'glass']
        yield* _(Effect.all(
          essentials.map(name => 
            Effect.gen(function* () {
              const materialManager = yield* Effect.Service(MaterialManager)
              return yield* materialManager.getMaterial(name)
            }).pipe(Effect.catchAll(() => Effect.void))
          ),
          { concurrency: 4 }
        ))
      })
    
    yield* _(preloadEssentials())
    
    return {
      getMaterial: (name: string, variant?: string) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const cacheKey = variant ? `${name}:${variant}` : name
          
          // Check cache first
          const cachedMaterial = state.materialCache.get(cacheKey)
          if (cachedMaterial && CONFIG.MATERIAL_CACHING) {
            yield* _(Ref.update(stateRef, s => ({
              ...s,
              stats: { ...s.stats, cacheHits: s.stats.cacheHits + 1 }
            })))
            return cachedMaterial
          }
          
          // Get material config
          const config = state.materialConfigs.get(name)
          if (!config) {
            throw new MaterialNotFoundError(name)
          }
          
          // Get variant if specified
          const variantConfig = variant ? state.variants.get(`${name}:${variant}`) : undefined
          
          // Create material
          const material = createThreeJSMaterial(config, variantConfig)
          
          // Create enhanced material
          const enhancedMaterial: EnhancedMaterial = {
            material,
            config,
            variant: variantConfig,
            lastUsed: Date.now(),
            usageCount: 1,
            memoryUsage: calculateMaterialMemory(material),
            isOptimized: false,
            isDirty: false,
          }
          
          // Update state
          yield* _(Ref.update(stateRef, s => ({
            ...s,
            materials: new Map([...s.materials, [cacheKey, enhancedMaterial]]),
            materialCache: new Map([...s.materialCache, [cacheKey, material]]),
            stats: {
              ...s.stats,
              totalMaterials: s.stats.totalMaterials + 1,
              cachedMaterials: s.stats.cachedMaterials + 1,
              cacheMisses: s.stats.cacheMisses + 1,
              memoryUsage: s.stats.memoryUsage + enhancedMaterial.memoryUsage,
            }
          })))
          
          return material
        }),
      
      createMaterialVariant: (name: string, variantName: string, overrides: Partial<MaterialConfig>, defines: Record<string, any> = {}) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const baseConfig = state.materialConfigs.get(name)
          
          if (!baseConfig) {
            throw new MaterialNotFoundError(name)
          }
          
          const variant: MaterialVariant = {
            name: variantName,
            baseMaterial: name,
            overrides,
            defines,
          }
          
          yield* _(Ref.update(stateRef, s => ({
            ...s,
            variants: new Map([...s.variants, [`${name}:${variantName}`, variant]])
          })))
        }),
      
      updateMaterialUniforms: (name: string, uniforms: Record<string, any>) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const enhanced = state.materials.get(name)
          
          if (!enhanced) {
            throw new MaterialNotFoundError(name)
          }
          
          if (enhanced.material instanceof THREE.ShaderMaterial) {
            Object.entries(uniforms).forEach(([key, value]) => {
              if (enhanced.material.uniforms[key]) {
                enhanced.material.uniforms[key].value = value
              }
            })
            
            enhanced.isDirty = true
            enhanced.lastUsed = Date.now()
          }
        }),
      
      optimizeMaterials: () =>
        Effect.gen(function* () {
          yield* _(Ref.update(stateRef, state => {
            const currentTime = Date.now()
            const newMaterials = new Map<string, EnhancedMaterial>()
            const newCache = new Map<string, THREE.Material>()
            let totalMemory = 0
            
            // Remove unused materials
            for (const [key, enhanced] of state.materials) {
              const timeSinceLastUse = currentTime - enhanced.lastUsed
              
              if (timeSinceLastUse < CONFIG.CACHE_TIMEOUT || enhanced.usageCount > 10) {
                newMaterials.set(key, enhanced)
                newCache.set(key, enhanced.material)
                totalMemory += enhanced.memoryUsage
              } else {
                // Dispose old material
                enhanced.material.dispose()
              }
            }
            
            return {
              ...state,
              materials: newMaterials,
              materialCache: newCache,
              stats: {
                ...state.stats,
                totalMaterials: newMaterials.size,
                cachedMaterials: newCache.size,
                memoryUsage: totalMemory,
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
            return false // Not implemented yet
          } catch {
            return false
          }
        }),
      
      getStats: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          return state.stats
        }),
      
      dispose: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          
          // Dispose all materials
          for (const enhanced of state.materials.values()) {
            enhanced.material.dispose()
          }
          
          // Clear pools
          materialPool.clear()
          uniformsPool.clear()
          
          yield* _(Ref.set(stateRef, initialState))
        }),
    }
  }),
)

// Export types and configuration
export type { 
  MaterialManagerState, 
  MaterialConfig, 
  MaterialVariant, 
  EnhancedMaterial, 
  WebGPUMaterial 
}
export { CONFIG as MaterialManagerConfig, MATERIAL_CONFIGS }