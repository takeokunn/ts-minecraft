/**
 * Rendering Components - Redesigned for Modern Graphics Pipeline
 * 
 * Features:
 * - GPU-optimized data structures
 * - Instanced rendering support
 * - Material system with PBR workflow
 * - Light management for deferred rendering
 * - Camera system with frustum culling
 */

import * as S from 'effect/Schema'
import * as Data from 'effect/Data'
import { RegisterComponent } from '../registry'

// ===== MESH COMPONENT =====

export const MeshGeometry = S.Union(
  S.Struct({
    type: S.Literal('box'),
    width: S.Number.pipe(S.positive()),
    height: S.Number.pipe(S.positive()),
    depth: S.Number.pipe(S.positive()),
  }),
  S.Struct({
    type: S.Literal('sphere'),
    radius: S.Number.pipe(S.positive()),
    segments: S.Number.pipe(S.int(), S.positive()),
  }),
  S.Struct({
    type: S.Literal('plane'),
    width: S.Number.pipe(S.positive()),
    height: S.Number.pipe(S.positive()),
  }),
  S.Struct({
    type: S.Literal('custom'),
    vertices: S.Array(S.Number), // Flat array: [x,y,z, x,y,z, ...]
    normals: S.Array(S.Number),
    uvs: S.Array(S.Number),
    indices: S.Array(S.Number),
  })
)

export const MeshComponent = RegisterComponent({
  id: 'mesh',
  category: 'rendering',
  priority: 2,
  dependencies: ['position'] as const,
})(
  S.Struct({
    geometry: MeshGeometry,
    // GPU buffer references
    vertexBufferId: S.optional(S.String),
    indexBufferId: S.optional(S.String),
    // Rendering state
    visible: S.Boolean,
    castShadows: S.Boolean,
    receiveShadows: S.Boolean,
    // LOD (Level of Detail) settings
    lodLevels: S.optional(S.Array(S.Struct({
      distance: S.Number.pipe(S.positive()),
      geometry: MeshGeometry,
    }))),
    // Instancing support
    isInstanced: S.Boolean,
    instanceCount: S.optional(S.Number.pipe(S.int(), S.positive())),
  })
)

export type MeshComponent = S.Schema.Type<typeof MeshComponent>
export type MeshGeometry = S.Schema.Type<typeof MeshGeometry>

// ===== MATERIAL COMPONENT =====

export const TextureDescriptor = S.Struct({
  url: S.String,
  format: S.Literal('RGB', 'RGBA', 'DEPTH', 'NORMAL'),
  minFilter: S.Literal('NEAREST', 'LINEAR', 'NEAREST_MIPMAP_NEAREST', 'LINEAR_MIPMAP_NEAREST', 'NEAREST_MIPMAP_LINEAR', 'LINEAR_MIPMAP_LINEAR'),
  magFilter: S.Literal('NEAREST', 'LINEAR'),
  wrapS: S.Literal('REPEAT', 'CLAMP_TO_EDGE', 'MIRRORED_REPEAT'),
  wrapT: S.Literal('REPEAT', 'CLAMP_TO_EDGE', 'MIRRORED_REPEAT'),
  generateMipmaps: S.Boolean,
})

export const MaterialComponent = RegisterComponent({
  id: 'material',
  category: 'rendering',
  priority: 2,
})(
  S.Struct({
    // PBR Material Properties
    albedo: S.Struct({
      r: S.Number.pipe(S.between(0, 1)),
      g: S.Number.pipe(S.between(0, 1)),
      b: S.Number.pipe(S.between(0, 1)),
      a: S.Number.pipe(S.between(0, 1)),
    }),
    metallic: S.Number.pipe(S.between(0, 1)),
    roughness: S.Number.pipe(S.between(0, 1)),
    emissive: S.Struct({
      r: S.Number.pipe(S.between(0, 1)),
      g: S.Number.pipe(S.between(0, 1)),
      b: S.Number.pipe(S.between(0, 1)),
    }),
    // Textures
    diffuseTexture: S.optional(TextureDescriptor),
    normalTexture: S.optional(TextureDescriptor),
    metallicRoughnessTexture: S.optional(TextureDescriptor),
    emissiveTexture: S.optional(TextureDescriptor),
    occlusionTexture: S.optional(TextureDescriptor),
    // Render state
    transparent: S.Boolean,
    alphaTest: S.optional(S.Number.pipe(S.between(0, 1))),
    doubleSided: S.Boolean,
    // Shader program reference
    shaderId: S.optional(S.String),
    // Custom uniforms
    uniforms: S.optional(S.Record({ key: S.String, value: S.Union(S.Number, S.Array(S.Number)) })),
  })
)

export type MaterialComponent = S.Schema.Type<typeof MaterialComponent>
export type TextureDescriptor = S.Schema.Type<typeof TextureDescriptor>

// ===== LIGHT COMPONENT =====

export const LightComponent = RegisterComponent({
  id: 'light',
  category: 'rendering',
  priority: 3,
  dependencies: ['position'] as const,
})(
  S.Struct({
    type: S.Literal('directional', 'point', 'spot'),
    color: S.Struct({
      r: S.Number.pipe(S.between(0, 1)),
      g: S.Number.pipe(S.between(0, 1)),
      b: S.Number.pipe(S.between(0, 1)),
    }),
    intensity: S.Number.pipe(S.positive()),
    // Point and spot light properties
    range: S.optional(S.Number.pipe(S.positive())),
    // Spot light properties
    innerCone: S.optional(S.Number.pipe(S.between(0, Math.PI))),
    outerCone: S.optional(S.Number.pipe(S.between(0, Math.PI))),
    // Shadow properties
    castShadows: S.Boolean,
    shadowMapSize: S.optional(S.Number.pipe(S.int(), S.positive())),
    shadowBias: S.optional(S.Number),
    // Optimization
    cullingMask: S.Number.pipe(S.int()),
    enabled: S.Boolean,
  })
)

export type LightComponent = S.Schema.Type<typeof LightComponent>

// ===== CAMERA COMPONENT =====

export const CameraComponent = RegisterComponent({
  id: 'camera',
  category: 'rendering',
  priority: 1,
  dependencies: ['position'] as const,
})(
  S.Struct({
    // Projection properties
    projectionType: S.Literal('perspective', 'orthographic'),
    // Perspective properties
    fov: S.optional(S.Number.pipe(S.between(0, Math.PI))),
    aspect: S.optional(S.Number.pipe(S.positive())),
    // Orthographic properties
    orthographicSize: S.optional(S.Number.pipe(S.positive())),
    // Common properties
    near: S.Number.pipe(S.positive()),
    far: S.Number.pipe(S.positive()),
    // View properties
    target: S.optional(S.Struct({
      x: S.Number,
      y: S.Number,
      z: S.Number,
    })),
    up: S.Struct({
      x: S.Number,
      y: S.Number,
      z: S.Number,
    }),
    // Rendering properties
    clearColor: S.Struct({
      r: S.Number.pipe(S.between(0, 1)),
      g: S.Number.pipe(S.between(0, 1)),
      b: S.Number.pipe(S.between(0, 1)),
      a: S.Number.pipe(S.between(0, 1)),
    }),
    clearFlags: S.Struct({
      color: S.Boolean,
      depth: S.Boolean,
      stencil: S.Boolean,
    }),
    // Culling properties
    frustumCulling: S.Boolean,
    cullingMask: S.Number.pipe(S.int()),
    // Render order
    renderOrder: S.Number.pipe(S.int()),
    // Viewport
    viewport: S.optional(S.Struct({
      x: S.Number.pipe(S.between(0, 1)),
      y: S.Number.pipe(S.between(0, 1)),
      width: S.Number.pipe(S.between(0, 1)),
      height: S.Number.pipe(S.between(0, 1)),
    })),
  })
)

export type CameraComponent = S.Schema.Type<typeof CameraComponent>

// ===== RENDERABLE COMPONENT =====

export const RenderableComponent = RegisterComponent({
  id: 'renderable',
  category: 'rendering',
  priority: 2,
  dependencies: ['position', 'mesh', 'material'] as const,
})(
  S.Struct({
    // Rendering layer
    layer: S.Number.pipe(S.int(), S.between(0, 31)),
    // Sorting key for transparent objects
    sortingOrder: S.Number.pipe(S.int()),
    // Bounds for culling
    bounds: S.optional(S.Struct({
      min: S.Struct({ x: S.Number, y: S.Number, z: S.Number }),
      max: S.Struct({ x: S.Number, y: S.Number, z: S.Number }),
    })),
    // GPU instancing
    instancedData: S.optional(S.Struct({
      transforms: S.Array(S.Number), // Matrix4 data
      colors: S.optional(S.Array(S.Number)),
      customData: S.optional(S.Array(S.Number)),
    })),
    // State
    visible: S.Boolean,
    enabled: S.Boolean,
  })
)

export type RenderableComponent = S.Schema.Type<typeof RenderableComponent>

// ===== COMPONENT FACTORIES =====

export const createMeshComponent = (
  geometry: MeshGeometry,
  options?: Partial<Pick<MeshComponent, 'visible' | 'castShadows' | 'receiveShadows'>>
): MeshComponent =>
  Data.struct({
    geometry,
    visible: options?.visible ?? true,
    castShadows: options?.castShadows ?? true,
    receiveShadows: options?.receiveShadows ?? true,
    isInstanced: false,
  })

export const createMaterialComponent = (
  albedo?: { r: number; g: number; b: number; a?: number },
  options?: Partial<Pick<MaterialComponent, 'metallic' | 'roughness' | 'transparent'>>
): MaterialComponent =>
  Data.struct({
    albedo: {
      r: albedo?.r ?? 1,
      g: albedo?.g ?? 1,
      b: albedo?.b ?? 1,
      a: albedo?.a ?? 1,
    },
    metallic: options?.metallic ?? 0,
    roughness: options?.roughness ?? 0.5,
    emissive: { r: 0, g: 0, b: 0 },
    transparent: options?.transparent ?? false,
    doubleSided: false,
  })

export const createDirectionalLight = (
  color: { r: number; g: number; b: number } = { r: 1, g: 1, b: 1 },
  intensity: number = 1
): LightComponent =>
  Data.struct({
    type: 'directional' as const,
    color,
    intensity,
    castShadows: true,
    cullingMask: 0xFFFFFFFF,
    enabled: true,
  })

export const createPointLight = (
  color: { r: number; g: number; b: number } = { r: 1, g: 1, b: 1 },
  intensity: number = 1,
  range: number = 10
): LightComponent =>
  Data.struct({
    type: 'point' as const,
    color,
    intensity,
    range,
    castShadows: true,
    cullingMask: 0xFFFFFFFF,
    enabled: true,
  })

export const createPerspectiveCamera = (
  fov: number = Math.PI / 4,
  aspect: number = 1,
  near: number = 0.1,
  far: number = 1000
): CameraComponent =>
  Data.struct({
    projectionType: 'perspective' as const,
    fov,
    aspect,
    near,
    far,
    up: { x: 0, y: 1, z: 0 },
    clearColor: { r: 0.2, g: 0.2, b: 0.3, a: 1 },
    clearFlags: { color: true, depth: true, stencil: false },
    frustumCulling: true,
    cullingMask: 0xFFFFFFFF,
    renderOrder: 0,
  })

export const createRenderableComponent = (
  layer: number = 0,
  options?: Partial<Pick<RenderableComponent, 'visible' | 'enabled'>>
): RenderableComponent =>
  Data.struct({
    layer,
    sortingOrder: 0,
    visible: options?.visible ?? true,
    enabled: options?.enabled ?? true,
  })

// ===== RENDERING COMPONENT UTILITIES =====

export const RenderingComponents = {
  Mesh: MeshComponent,
  Material: MaterialComponent,
  Light: LightComponent,
  Camera: CameraComponent,
  Renderable: RenderableComponent,
} as const

export type AnyRenderingComponent = 
  | MeshComponent 
  | MaterialComponent 
  | LightComponent 
  | CameraComponent 
  | RenderableComponent

export const RenderingComponentFactories = {
  createMeshComponent,
  createMaterialComponent,
  createDirectionalLight,
  createPointLight,
  createPerspectiveCamera,
  createRenderableComponent,
} as const

// Re-export for backward compatibility
export {
  MeshComponent as MeshComponentType,
  MaterialComponent as MaterialComponentType,
  LightComponent as LightComponentType,
  CameraComponent as CameraComponentType,
  RenderableComponent as RenderableComponentType,
}