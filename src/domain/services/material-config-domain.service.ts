/**
 * Material Configuration Domain Service
 *
 * Contains pure domain logic for material configurations,
 * extracted from infrastructure layer. This service defines
 * business rules for material properties without dependencies
 * on specific rendering libraries.
 */

import { Effect, Context, Layer } from 'effect'
import { BlockPropertiesUtils, type BlockProperties, type BlockMaterialProperties } from '@domain/constants/block-properties'
import { BlockType } from '@domain/constants/block-types'

/**
 * Material configuration type definitions
 */
export type MaterialType = 'standard' | 'basic' | 'phong' | 'shader' | 'webgpu'

export interface MaterialConfig {
  readonly name: string
  readonly type: MaterialType
  readonly shader?: string
  readonly textures?: {
    readonly diffuse?: string
    readonly normal?: string
    readonly roughness?: string
    readonly metalness?: string
    readonly emission?: string
    readonly alpha?: string
  }
  readonly properties: {
    readonly metalness: number
    readonly roughness: number
    readonly opacity: number
    readonly transparent: boolean
    readonly alphaTest?: number
    readonly depthWrite: boolean
    readonly depthTest: boolean
    readonly cullFace?: boolean
  }
  readonly features: {
    readonly vertexColors: boolean
    readonly instancing: boolean
    readonly lighting: boolean
    readonly fog: boolean
    readonly shadows: boolean
    readonly animation?: boolean
  }
}

export interface MaterialVariant {
  readonly name: string
  readonly baseMaterial: string
  readonly overrides: Partial<MaterialConfig>
  readonly defines: Readonly<Record<string, string | number | boolean>>
  readonly uniformOverrides?: Readonly<Record<string, unknown>>
}

/**
 * Domain-specific material configurations
 * Pure business logic defining material behavior
 */
const DOMAIN_MATERIAL_CONFIGS: Readonly<Record<string, MaterialConfig>> = {
  chunk: {
    name: 'chunk',
    type: 'standard',
    properties: {
      metalness: 0,
      roughness: 1,
      opacity: 1,
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
      opacity: 0.8,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    },
    features: {
      vertexColors: false,
      instancing: false,
      lighting: true,
      fog: true,
      shadows: false,
      animation: true,
    },
  },

  glass: {
    name: 'glass',
    type: 'standard',
    properties: {
      metalness: 0,
      roughness: 0.1,
      opacity: 0.3,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    },
    features: {
      vertexColors: false,
      instancing: true,
      lighting: true,
      fog: true,
      shadows: false,
    },
  },

  terrain: {
    name: 'terrain',
    type: 'standard',
    properties: {
      metalness: 0,
      roughness: 0.8,
      opacity: 1,
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

  leaves: {
    name: 'leaves',
    type: 'standard',
    properties: {
      metalness: 0,
      roughness: 0.9,
      opacity: 0.8,
      transparent: true,
      alphaTest: 0.1,
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
} as const

/**
 * Material Configuration Domain Service Port
 */
export interface IMaterialConfigDomainService {
  readonly getMaterialConfig: (name: string) => Effect.Effect<MaterialConfig, MaterialConfigNotFoundError, never>
  readonly getMaterialConfigForBlock: (blockType: BlockType) => Effect.Effect<MaterialConfig, MaterialConfigNotFoundError, never>
  readonly createMaterialVariant: (baseName: string, variantName: string, overrides: Partial<MaterialConfig>) => Effect.Effect<MaterialVariant, MaterialConfigNotFoundError, never>
  readonly getAllMaterialConfigs: () => Effect.Effect<readonly MaterialConfig[], never, never>
  readonly validateMaterialConfig: (config: MaterialConfig) => Effect.Effect<boolean, MaterialConfigValidationError, never>
  readonly getMaterialsForFeature: (feature: keyof MaterialConfig['features']) => Effect.Effect<readonly MaterialConfig[], never, never>
}

/**
 * Domain errors
 */
export class MaterialConfigNotFoundError extends Error {
  readonly _tag = 'MaterialConfigNotFoundError'
  constructor(public readonly materialName: string) {
    super(`Material configuration not found: ${materialName}`)
  }
}

export class MaterialConfigValidationError extends Error {
  readonly _tag = 'MaterialConfigValidationError'
  constructor(public readonly reason: string) {
    super(`Material configuration validation failed: ${reason}`)
  }
}

/**
 * Pure domain functions for material configuration logic
 */

const getMaterialConfigPure = (name: string): Effect.Effect<MaterialConfig, MaterialConfigNotFoundError, never> =>
  Effect.gen(function* () {
    const config = DOMAIN_MATERIAL_CONFIGS[name]
    if (!config) {
      throw new MaterialConfigNotFoundError(name)
    }
    return config
  })

const getMaterialNameForBlock = (blockType: BlockType, blockProps: BlockProperties): string => {
  // Water blocks use water material
  if (blockType === 'water') {
    return 'water'
  }

  // Glass blocks use glass material
  if (blockType === 'glass') {
    return 'glass'
  }

  // Leaf blocks use leaves material
  if (blockType === 'oakLeaves') {
    return 'leaves'
  }

  // Transparent blocks use appropriate materials
  if (blockProps.material.transparent) {
    return 'glass'
  }

  // Natural terrain blocks use terrain material
  if (['grass', 'dirt', 'stone', 'sand'].includes(blockType)) {
    return 'terrain'
  }

  // Everything else uses chunk material (standard opaque blocks)
  return 'chunk'
}

const getMaterialConfigForBlockPure = (blockType: BlockType): Effect.Effect<MaterialConfig, MaterialConfigNotFoundError, never> =>
  Effect.gen(function* () {
    const blockProps = BlockPropertiesUtils.getProperties(blockType)
    const materialName = getMaterialNameForBlock(blockType, blockProps)
    return yield* getMaterialConfigPure(materialName)
  })

const createMaterialVariantPure = (baseName: string, variantName: string, overrides: Partial<MaterialConfig>): Effect.Effect<MaterialVariant, MaterialConfigNotFoundError, never> =>
  Effect.gen(function* () {
    const baseConfig = yield* getMaterialConfigPure(baseName)

    const variant: MaterialVariant = {
      name: variantName,
      baseMaterial: baseName,
      overrides,
      defines: {},
      uniformOverrides: {},
    }

    return variant
  })

const getAllMaterialConfigsPure = (): Effect.Effect<readonly MaterialConfig[], never, never> =>
  Effect.gen(function* () {
    return Object.values(DOMAIN_MATERIAL_CONFIGS)
  })

const validateMaterialConfigPure = (config: MaterialConfig): Effect.Effect<boolean, MaterialConfigValidationError, never> =>
  Effect.gen(function* () {
    // Validate opacity range
    if (config.properties.opacity < 0 || config.properties.opacity > 1) {
      throw new MaterialConfigValidationError('Opacity must be between 0 and 1')
    }

    // Validate metalness range
    if (config.properties.metalness < 0 || config.properties.metalness > 1) {
      throw new MaterialConfigValidationError('Metalness must be between 0 and 1')
    }

    // Validate roughness range
    if (config.properties.roughness < 0 || config.properties.roughness > 1) {
      throw new MaterialConfigValidationError('Roughness must be between 0 and 1')
    }

    // Validate transparency consistency
    if (config.properties.transparent && config.properties.opacity === 1) {
      throw new MaterialConfigValidationError('Transparent materials should have opacity < 1')
    }

    if (!config.properties.transparent && config.properties.opacity < 1) {
      throw new MaterialConfigValidationError('Non-transparent materials should have opacity = 1')
    }

    return true
  })

const getMaterialsForFeaturePure = (feature: keyof MaterialConfig['features']): Effect.Effect<readonly MaterialConfig[], never, never> =>
  Effect.gen(function* () {
    return Object.values(DOMAIN_MATERIAL_CONFIGS).filter((config) => config.features[feature])
  })

/**
 * Material Configuration Domain Service Implementation
 */
const materialConfigDomainService: IMaterialConfigDomainService = {
  getMaterialConfig: getMaterialConfigPure,
  getMaterialConfigForBlock: getMaterialConfigForBlockPure,
  createMaterialVariant: createMaterialVariantPure,
  getAllMaterialConfigs: getAllMaterialConfigsPure,
  validateMaterialConfig: validateMaterialConfigPure,
  getMaterialsForFeature: getMaterialsForFeaturePure,
}

/**
 * Context tag for dependency injection
 */
export const MaterialConfigDomainServicePort = Context.GenericTag<IMaterialConfigDomainService>('@domain/MaterialConfigDomainService')

/**
 * Live layer for Material Configuration Domain Service
 */
export const MaterialConfigDomainServiceLive = Layer.succeed(MaterialConfigDomainServicePort, materialConfigDomainService)

/**
 * Utility functions for material configuration
 */
export const MaterialConfigUtils = {
  /**
   * Create a material config with default values
   */
  createDefaultMaterialConfig: (name: string, type: MaterialType = 'standard'): MaterialConfig => ({
    name,
    type,
    properties: {
      metalness: 0,
      roughness: 1,
      opacity: 1,
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
  }),

  /**
   * Merge material config with overrides
   */
  mergeMaterialConfig: (base: MaterialConfig, overrides: Partial<MaterialConfig>): MaterialConfig => ({
    ...base,
    ...overrides,
    properties: {
      ...base.properties,
      ...overrides.properties,
    },
    features: {
      ...base.features,
      ...overrides.features,
    },
    textures: {
      ...base.textures,
      ...overrides.textures,
    },
  }),

  /**
   * Extract material properties from block properties
   */
  blockPropertiesToMaterialConfig: (blockType: BlockType, blockProps: BlockProperties): Partial<MaterialConfig> => ({
    properties: {
      metalness: blockProps.material.metalness,
      roughness: blockProps.material.roughness,
      opacity: blockProps.material.opacity,
      transparent: blockProps.material.transparent,
      depthWrite: blockProps.physics.solid,
      depthTest: true,
    },
    features: {
      vertexColors: true,
      instancing: true,
      lighting: !blockProps.material.emissive,
      fog: true,
      shadows: blockProps.physics.solid,
    },
  }),

  /**
   * Check if material config supports transparency
   */
  supportsTransparency: (config: MaterialConfig): boolean => {
    return config.properties.transparent || config.properties.opacity < 1
  },

  /**
   * Check if material config supports instancing
   */
  supportsInstancing: (config: MaterialConfig): boolean => {
    return config.features.instancing
  },
} as const

/**
 * Export types and utilities
 */
export type { MaterialConfig, MaterialVariant, MaterialType, IMaterialConfigDomainService }
