import { BrandedTypes, UVCoordinate } from '@domain/core/types/brands'
import { Schema } from '@effect/schema'
import { Context, Effect, Layer, Match, Option, pipe, Predicate, Ref } from 'effect'
import * as THREE from 'three'
import type { BlockType } from './MeshGenerator'

// ========================================
// Type Definitions
// ========================================

export interface TextureRegion {
  readonly u: UVCoordinate // U coordinate (0-1)
  readonly v: UVCoordinate // V coordinate (0-1)
  readonly width: UVCoordinate // Width in UV space (0-1)
  readonly height: UVCoordinate // Height in UV space (0-1)
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
  u: Schema.Number.pipe(Schema.between(0, 1), Schema.brand('UVCoordinate')),
  v: Schema.Number.pipe(Schema.between(0, 1), Schema.brand('UVCoordinate')),
  width: Schema.Number.pipe(Schema.between(0, 1), Schema.brand('UVCoordinate')),
  height: Schema.Number.pipe(Schema.between(0, 1), Schema.brand('UVCoordinate')),
}).pipe(
  Schema.annotations({
    title: 'TextureRegion',
    description: 'UV texture coordinates with Brand type safety',
  })
)

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

// Error interface (class-free pattern)
export interface TextureAtlasError {
  readonly _tag: 'TextureAtlasError'
  readonly reason: string
  readonly context: string
  readonly timestamp: number
}

// Error factory function
export const TextureAtlasError = (reason: string, context: string): TextureAtlasError => ({
  _tag: 'TextureAtlasError',
  reason,
  context,
  timestamp: Date.now(),
})

// Type guard function
export const isTextureAtlasError: Predicate.Refinement<unknown, TextureAtlasError> = (
  error
): error is TextureAtlasError => Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'TextureAtlasError'

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

export const TextureAtlasService = Context.GenericTag<TextureAtlasService>(
  '@minecraft/infrastructure/TextureAtlasService'
)

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

  return {
    u: BrandedTypes.createUVCoordinate(u),
    v: BrandedTypes.createUVCoordinate(v),
    width: BrandedTypes.createUVCoordinate(width),
    height: BrandedTypes.createUVCoordinate(height),
  }
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
  // Brand型から実際の数値を取得
  const u = region.u as number
  const v = region.v as number
  const width = region.width as number
  const height = region.height as number

  return [
    u,
    v, // Bottom-left
    u + width,
    v, // Bottom-right
    u + width,
    v + height, // Top-right
    u,
    v + height, // Top-left
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
            TextureAtlasError(`Failed to load texture atlas: ${String(error)}`, `loadAtlas(${atlasPath})`),
        }).pipe(Effect.tap((metadata) => Ref.update(stateRef, (s) => ({ ...s, metadata })))),

      getBlockUVs: (blockType: BlockType, face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') =>
        pipe(
          Ref.get(stateRef),
          Effect.flatMap((state) =>
            pipe(
              Option.fromNullable(state.metadata),
              Option.match({
                onNone: () => Effect.fail(TextureAtlasError('Texture atlas not loaded', 'getBlockUVs')),
                onSome: (metadata) =>
                  pipe(
                    Option.fromNullable(metadata.blockTextures.get(blockType)),
                    Option.match({
                      onNone: () => Effect.succeed(calculateTextureRegion(0, config.textureSize, config.atlasSize)),
                      onSome: (blockTexture) =>
                        Effect.succeed(
                          pipe(
                            Match.value(face),
                            Match.when('top', () => blockTexture.top),
                            Match.when('bottom', () => blockTexture.bottom),
                            Match.when('front', () => blockTexture.front),
                            Match.when('back', () => blockTexture.back),
                            Match.when('left', () => blockTexture.left),
                            Match.when('right', () => blockTexture.right),
                            Match.exhaustive
                          )
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
                onNone: () => Effect.fail(TextureAtlasError('Texture atlas not loaded', 'generateUVCoords')),
                onSome: (metadata) =>
                  pipe(
                    Option.fromNullable(metadata.blockTextures.get(blockType)),
                    Option.match({
                      onNone: () =>
                        Effect.succeed(
                          generateUVCoordsFromRegion(calculateTextureRegion(0, config.textureSize, config.atlasSize))
                        ),
                      onSome: (blockTexture) => {
                        const region = pipe(
                          Match.value(face),
                          Match.when('top', () => blockTexture.top),
                          Match.when('bottom', () => blockTexture.bottom),
                          Match.when('front', () => blockTexture.front),
                          Match.when('back', () => blockTexture.back),
                          Match.when('left', () => blockTexture.left),
                          Match.when('right', () => blockTexture.right),
                          Match.exhaustive
                        )
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
            return pipe(
              Option.fromNullable(state.material),
              Option.match({
                onNone: () =>
                  Effect.try({
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
                      TextureAtlasError(`Failed to create texture material: ${String(error)}`, 'createTextureMaterial'),
                  }).pipe(Effect.tap((material) => Ref.update(stateRef, (s) => ({ ...s, material })))),
                onSome: (material) => Effect.succeed(material),
              })
            )
          })
        ),

      registerBlockTexture: (blockTexture: BlockTexture) =>
        Effect.try({
          try: () => {
            const state = Effect.runSync(Ref.get(stateRef))
            pipe(
              Option.fromNullable(state.metadata),
              Option.match({
                onNone: () => {
                  throw new Error('Texture atlas not loaded')
                },
                onSome: () => undefined,
              })
            )
            const newBlockTextures = new Map(state.metadata!.blockTextures)
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
            TextureAtlasError(`Failed to register block texture: ${String(error)}`, 'registerBlockTexture'),
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

export const calculateAtlasEfficiency = (usedTextures: number, atlasSize: number, textureSize: number): number =>
  pipe(
    Match.value({ atlasSize, textureSize }),
    Match.when(
      ({ atlasSize, textureSize }) => atlasSize <= 0 || textureSize <= 0,
      () => 0
    ),
    Match.orElse(() => {
      const totalSlots = (atlasSize / textureSize) ** 2
      return totalSlots === 0 ? 0 : (usedTextures / totalSlots) * 100
    })
  )

export const getOptimalAtlasSize = (textureCount: number, textureSize: number): number =>
  pipe(
    Match.value(textureCount),
    Match.when(
      (count) => count <= 0,
      () => Math.max(1, textureSize) // 最小サイズを1に調整
    ),
    Match.orElse(() => {
      const slotsNeeded = textureCount
      const slotsPerRow = Math.ceil(Math.sqrt(slotsNeeded))
      const atlasSize = slotsPerRow * textureSize

      // Round up to nearest power of 2
      return Math.pow(2, Math.ceil(Math.log2(Math.max(atlasSize, 1))))
    })
  )
