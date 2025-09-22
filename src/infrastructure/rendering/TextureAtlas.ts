import { Effect, Context, Layer, Schema, Ref, Option, pipe, Array as A } from 'effect'
import * as THREE from 'three'
import type { BlockType } from './MeshGenerator'

// ========================================
// Type Definitions
// ========================================

export interface TextureRegion {
  readonly u: number // U coordinate (0-1)
  readonly v: number // V coordinate (0-1)
  readonly width: number // Width in UV space (0-1)
  readonly height: number // Height in UV space (0-1)
}

export interface BlockTexture {
  readonly blockType: BlockType
  readonly top: TextureRegion
  readonly bottom: TextureRegion
  readonly front: TextureRegion
  readonly back: TextureRegion
  readonly left: TextureRegion
  readonly right: TextureRegion
}

export interface AtlasConfig {
  readonly textureSize: number // Size of individual texture (e.g., 16 for 16x16)
  readonly atlasSize: number // Total atlas size (e.g., 256 for 256x256)
  readonly mipmapping: boolean
  readonly filtering: 'nearest' | 'linear'
}

export interface AtlasMetadata {
  readonly blockTextures: Map<BlockType, BlockTexture>
  readonly atlasWidth: number
  readonly atlasHeight: number
  readonly textureCount: number
}

// ========================================
// Schema Definitions
// ========================================

export const TextureRegionSchema = Schema.Struct({
  u: Schema.Number.pipe(Schema.between(0, 1)),
  v: Schema.Number.pipe(Schema.between(0, 1)),
  width: Schema.Number.pipe(Schema.between(0, 1)),
  height: Schema.Number.pipe(Schema.between(0, 1)),
})

export const BlockTextureSchema = Schema.Struct({
  blockType: Schema.Number,
  top: TextureRegionSchema,
  bottom: TextureRegionSchema,
  front: TextureRegionSchema,
  back: TextureRegionSchema,
  left: TextureRegionSchema,
  right: TextureRegionSchema,
})

// ========================================
// Error Definitions
// ========================================

export const TextureAtlasError = Schema.TaggedError<'TextureAtlasError'>()('TextureAtlasError', {
  reason: Schema.String,
  context: Schema.String,
  timestamp: Schema.Number,
})
export type TextureAtlasError = typeof TextureAtlasError.Type

// ========================================
// Service Interface
// ========================================

export interface TextureAtlasService {
  readonly loadAtlas: (atlasPath: string) => Effect.Effect<AtlasMetadata, TextureAtlasError, never>
  readonly getBlockUVs: (
    blockType: BlockType,
    face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'
  ) => Effect.Effect<TextureRegion, TextureAtlasError, never>
  readonly generateUVCoords: (
    blockType: BlockType,
    face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'
  ) => Effect.Effect<[number, number, number, number, number, number, number, number], TextureAtlasError, never>
  readonly createTextureMaterial: () => Effect.Effect<THREE.Material, TextureAtlasError, never>
  readonly registerBlockTexture: (blockTexture: BlockTexture) => Effect.Effect<void, TextureAtlasError, never>
}

export const TextureAtlasService = Context.GenericTag<TextureAtlasService>('@minecraft/TextureAtlasService')

// ========================================
// Helper Functions (Pure Functions)
// ========================================

const calculateTextureRegion = (index: number, textureSize: number, atlasSize: number): TextureRegion => {
  const texturesPerRow = Math.floor(atlasSize / textureSize)
  const row = Math.floor(index / texturesPerRow)
  const col = index % texturesPerRow

  const u = col * (textureSize / atlasSize)
  const v = 1.0 - (row + 1) * (textureSize / atlasSize) // Flip V coordinate
  const width = textureSize / atlasSize
  const height = textureSize / atlasSize

  return { u, v, width, height }
}

const getDefaultBlockTexture = (blockType: BlockType, config: AtlasConfig): BlockTexture => {
  // Default texture mapping: use same texture for all faces
  const region = calculateTextureRegion(blockType - 1, config.textureSize, config.atlasSize)

  return {
    blockType,
    top: region,
    bottom: region,
    front: region,
    back: region,
    left: region,
    right: region,
  }
}

const generateUVCoordsFromRegion = (
  region: TextureRegion
): [number, number, number, number, number, number, number, number] => {
  // Generate UV coordinates for a quad (4 vertices, 2 coords each)
  // Order: bottom-left, bottom-right, top-right, top-left
  return [
    region.u,
    region.v, // Bottom-left
    region.u + region.width,
    region.v, // Bottom-right
    region.u + region.width,
    region.v + region.height, // Top-right
    region.u,
    region.v + region.height, // Top-left
  ]
}

// Predefined texture mappings for common blocks
const createDefaultBlockTextures = (config: AtlasConfig): Map<BlockType, BlockTexture> => {
  const textures = new Map<BlockType, BlockTexture>()

  // Stone (block type 1)
  textures.set(1, getDefaultBlockTexture(1, config))

  // Dirt (block type 2)
  textures.set(2, getDefaultBlockTexture(2, config))

  // Grass (block type 3) - different top/bottom
  const grassTop = calculateTextureRegion(0, config.textureSize, config.atlasSize)
  const grassSide = calculateTextureRegion(1, config.textureSize, config.atlasSize)
  const grassBottom = calculateTextureRegion(2, config.textureSize, config.atlasSize)

  textures.set(3, {
    blockType: 3,
    top: grassTop,
    bottom: grassBottom,
    front: grassSide,
    back: grassSide,
    left: grassSide,
    right: grassSide,
  })

  // Wood (block type 4) - different top/bottom
  const woodTop = calculateTextureRegion(3, config.textureSize, config.atlasSize)
  const woodSide = calculateTextureRegion(4, config.textureSize, config.atlasSize)

  textures.set(4, {
    blockType: 4,
    top: woodTop,
    bottom: woodTop,
    front: woodSide,
    back: woodSide,
    left: woodSide,
    right: woodSide,
  })

  return textures
}

// ========================================
// Service Implementation
// ========================================

interface TextureAtlasState {
  readonly metadata: AtlasMetadata | null
  readonly config: AtlasConfig
  readonly texture: THREE.Texture | null
  readonly material: THREE.Material | null
}

const makeService = (config: AtlasConfig) =>
  pipe(
    Ref.make<TextureAtlasState>({
      metadata: null,
      config,
      texture: null,
      material: null,
    }),
    Effect.map((stateRef) => ({
      loadAtlas: (atlasPath: string) =>
        Effect.try({
          try: () => {
            // In a real implementation, this would load the texture from a file
            // For now, create a default atlas with predefined textures
            const blockTextures = createDefaultBlockTextures(config)

            const metadata: AtlasMetadata = {
              blockTextures,
              atlasWidth: config.atlasSize,
              atlasHeight: config.atlasSize,
              textureCount: blockTextures.size,
            }

            return metadata
          },
          catch: (error) =>
            new TextureAtlasError({
              reason: `Failed to load texture atlas: ${String(error)}`,
              context: `loadAtlas(${atlasPath})`,
              timestamp: Date.now(),
            }),
        }).pipe(Effect.tap((metadata) => Ref.update(stateRef, (s) => ({ ...s, metadata })))),

      getBlockUVs: (blockType: BlockType, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) =>
            pipe(
              Option.fromNullable(state.metadata),
              Option.match({
                onNone: () =>
                  Effect.fail(
                    new TextureAtlasError({
                      reason: 'Texture atlas not loaded',
                      context: 'getBlockUVs',
                      timestamp: Date.now(),
                    })
                  ),
                onSome: (metadata) =>
                  pipe(
                    Option.fromNullable(metadata.blockTextures.get(blockType)),
                    Option.match({
                      onNone: () => Effect.succeed(calculateTextureRegion(0, config.textureSize, config.atlasSize)),
                      onSome: (blockTexture) =>
                        Effect.succeed(
                          (() => {
                            switch (face) {
                              case 'top':
                                return blockTexture.top
                              case 'bottom':
                                return blockTexture.bottom
                              case 'front':
                                return blockTexture.front
                              case 'back':
                                return blockTexture.back
                              case 'left':
                                return blockTexture.left
                              case 'right':
                                return blockTexture.right
                              default:
                                throw new Error(`Invalid face: ${face}`)
                            }
                          })()
                        ),
                    })
                  ),
              })
            )
          )
        ),

      generateUVCoords: (blockType: BlockType, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) =>
            pipe(
              Option.fromNullable(state.metadata),
              Option.match({
                onNone: () =>
                  Effect.fail(
                    new TextureAtlasError({
                      reason: 'Texture atlas not loaded',
                      context: 'generateUVCoords',
                      timestamp: Date.now(),
                    })
                  ),
                onSome: (metadata) =>
                  pipe(
                    Option.fromNullable(metadata.blockTextures.get(blockType)),
                    Option.match({
                      onNone: () =>
                        Effect.succeed(
                          generateUVCoordsFromRegion(calculateTextureRegion(0, config.textureSize, config.atlasSize))
                        ),
                      onSome: (blockTexture) => {
                        const region = (() => {
                          switch (face) {
                            case 'top':
                              return blockTexture.top
                            case 'bottom':
                              return blockTexture.bottom
                            case 'front':
                              return blockTexture.front
                            case 'back':
                              return blockTexture.back
                            case 'left':
                              return blockTexture.left
                            case 'right':
                              return blockTexture.right
                            default:
                              throw new Error(`Invalid face: ${face}`)
                          }
                        })()
                        return Effect.succeed(generateUVCoordsFromRegion(region))
                      },
                    })
                  ),
              })
            )
          )
        ),

      createTextureMaterial: () =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) => {
            if (state.material) {
              return Effect.succeed(state.material)
            }

            return Effect.try({
              try: () => {
                const texture = new THREE.Texture()
                const material = new THREE.MeshBasicMaterial({
                  map: texture,
                  color: 0xffffff,
                  wireframe: false,
                  side: THREE.FrontSide,
                  vertexColors: true,
                })
                return material
              },
              catch: (error) =>
                new TextureAtlasError({
                  reason: `Failed to create texture material: ${String(error)}`,
                  context: 'createTextureMaterial',
                  timestamp: Date.now(),
                }),
            }).pipe(Effect.tap((material) => Ref.update(stateRef, (s) => ({ ...s, material }))))
          })
        ),

      registerBlockTexture: (blockTexture: BlockTexture) =>
        Effect.try({
          try: () => {
            const state = Effect.runSync(Ref.get(stateRef))
            if (!state.metadata) {
              throw new Error('Texture atlas not loaded')
            }
            const newBlockTextures = new Map(state.metadata.blockTextures)
            newBlockTextures.set(blockTexture.blockType, blockTexture)
            Effect.runSync(
              Ref.update(stateRef, (s) => ({
                ...s,
                metadata: {
                  ...s.metadata!,
                  blockTextures: newBlockTextures,
                  textureCount: newBlockTextures.size,
                },
              }))
            )
          },
          catch: (error) =>
            new TextureAtlasError({
              reason: `Failed to register block texture: ${String(error)}`,
              context: 'registerBlockTexture',
              timestamp: Date.now(),
            }),
        }),
    }))
  )

// ========================================
// Layer Construction
// ========================================

export const TextureAtlasLive = Layer.effect(
  TextureAtlasService,
  makeService({
    textureSize: 16,
    atlasSize: 256,
    mipmapping: true,
    filtering: 'nearest',
  }) as unknown as Effect.Effect<TextureAtlasService, never, never>
)

// ========================================
// Utility Exports
// ========================================

export const calculateAtlasEfficiency = (usedTextures: number, atlasSize: number, textureSize: number): number => {
  if (atlasSize <= 0 || textureSize <= 0) {
    return 0
  }

  const totalSlots = (atlasSize / textureSize) ** 2
  return totalSlots === 0 ? 0 : (usedTextures / totalSlots) * 100
}

export const getOptimalAtlasSize = (textureCount: number, textureSize: number): number => {
  if (textureCount <= 0) {
    return Math.max(1, textureSize) // 最小サイズを1に調整
  }

  const slotsNeeded = textureCount
  const slotsPerRow = Math.ceil(Math.sqrt(slotsNeeded))
  const atlasSize = slotsPerRow * textureSize

  // Round up to nearest power of 2
  return Math.pow(2, Math.ceil(Math.log2(Math.max(atlasSize, 1))))
}
