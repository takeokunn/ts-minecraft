import { Effect, Context, Layer, Option, Match, pipe, Array as A, Record as R, Number as N, Predicate } from 'effect'
import { Schema } from '@effect/schema'
import type { ChunkData, BlockType } from './MeshGenerator'
import { AOValue, BrandedTypes } from '@domain/core/types/brands'

// ========================================
// Type Definitions
// ========================================

export interface AOVertex {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly ao: AOValue // 0.0 (fully occluded) to 1.0 (fully lit)
}

export interface AOFace {
  readonly vertices: readonly [AOVertex, AOVertex, AOVertex, AOVertex]
  readonly averageAO: AOValue
}

export interface AOConfig {
  readonly enabled: boolean
  readonly strength: number // 0.0 to 1.0
  readonly smoothing: boolean
  readonly quality: 'low' | 'medium' | 'high'
}

// ========================================
// Error Definitions
// ========================================

export interface AmbientOcclusionError {
  readonly _tag: 'AmbientOcclusionError'
  readonly reason: string
  readonly context: string
  readonly timestamp: number
}

export const AmbientOcclusionError = (reason: string, context: string, timestamp: number): AmbientOcclusionError => ({
  _tag: 'AmbientOcclusionError',
  reason,
  context,
  timestamp,
})

export const isAmbientOcclusionError: Predicate.Refinement<unknown, AmbientOcclusionError> = (
  error
): error is AmbientOcclusionError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'AmbientOcclusionError'

// ========================================
// Service Interface
// ========================================

export interface AmbientOcclusionService {
  readonly calculateVertexAO: (
    blocks: number[][][],
    x: number,
    y: number,
    z: number,
    size: number
  ) => Effect.Effect<number, AmbientOcclusionError, never>

  readonly calculateFaceAO: (
    blocks: number[][][],
    x: number,
    y: number,
    z: number,
    face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right',
    size: number
  ) => Effect.Effect<AOFace, AmbientOcclusionError, never>

  readonly applyAOToChunk: (chunkData: ChunkData) => Effect.Effect<readonly AOVertex[], AmbientOcclusionError, never>
}

export const AmbientOcclusionService = Context.GenericTag<AmbientOcclusionService>(
  '@minecraft/infrastructure/AmbientOcclusionService'
)

// ========================================
// Helper Functions (Pure Functions)
// ========================================

const getBlock = (blocks: number[][][], x: number, y: number, z: number, size: number): BlockType =>
  pipe(
    x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size ? Option.some(true) : Option.none(),
    Option.flatMap(() => Option.fromNullable(blocks[x]?.[y]?.[z])),
    Option.getOrElse(() => 0)
  )

const isOccluding = (blockType: BlockType): boolean => blockType !== 0 // Non-air blocks occlude

// Calculate AO for a vertex based on surrounding blocks
// Uses the classic Minecraft-style AO algorithm
const calculateVertexAOPure = (
  blocks: number[][][],
  x: number,
  y: number,
  z: number,
  size: number,
  config: AOConfig
): AOValue => {
  // Generate neighbor offsets (3x3x3 cube minus center)
  const offsets = pipe(
    A.makeBy(27, (i) => {
      const dx = (i % 3) - 1
      const dy = (Math.floor(i / 3) % 3) - 1
      const dz = Math.floor(i / 9) - 1
      return { dx, dy, dz }
    }),
    A.filter(({ dx, dy, dz }) => !(dx === 0 && dy === 0 && dz === 0))
  )

  // Calculate occlusion
  const { occluders, samples } = pipe(
    offsets,
    A.reduce({ occluders: 0, samples: 0 }, (acc, { dx, dy, dz }) => {
      const neighbor = getBlock(blocks, x + dx, y + dy, z + dz, size)
      const distance = Math.abs(dx) + Math.abs(dy) + Math.abs(dz)
      const weight = distance === 3 ? 0.5 : 1.0 // Corner vs Edge blocks

      return {
        occluders: acc.occluders + (isOccluding(neighbor) ? weight : 0),
        samples: acc.samples + 1,
      }
    })
  )

  // Calculate and clamp AO value
  const aoValue = pipe(
    1.0 - occluders / samples,
    (aoRaw) => 1.0 - (1.0 - aoRaw) * config.strength,
    N.clamp({ minimum: 0.0, maximum: 1.0 })
  )

  return BrandedTypes.createAOValue(aoValue)
}

// Calculate AO for a face (4 vertices)
const calculateFaceAOPure = (
  blocks: number[][][],
  x: number,
  y: number,
  z: number,
  face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right',
  size: number,
  config: AOConfig
): AOFace => {
  // Define vertex offsets for each face using Match.value pattern
  const getVertexOffsets = (face: string): [number, number, number][] =>
    pipe(
      Match.value(face),
      Match.when(
        'top',
        () =>
          [
            [0, 1, 0],
            [1, 1, 0],
            [1, 1, 1],
            [0, 1, 1],
          ] as [number, number, number][]
      ),
      Match.when(
        'bottom',
        () =>
          [
            [0, 0, 0],
            [0, 0, 1],
            [1, 0, 1],
            [1, 0, 0],
          ] as [number, number, number][]
      ),
      Match.when(
        'front',
        () =>
          [
            [0, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
            [0, 1, 1],
          ] as [number, number, number][]
      ),
      Match.when(
        'back',
        () =>
          [
            [1, 0, 0],
            [0, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
          ] as [number, number, number][]
      ),
      Match.when(
        'left',
        () =>
          [
            [0, 0, 0],
            [0, 0, 1],
            [0, 1, 1],
            [0, 1, 0],
          ] as [number, number, number][]
      ),
      Match.when(
        'right',
        () =>
          [
            [1, 0, 1],
            [1, 0, 0],
            [1, 1, 0],
            [1, 1, 1],
          ] as [number, number, number][]
      ),
      Match.orElse(
        () =>
          [
            [0, 0, 0],
            [1, 0, 0],
            [1, 1, 0],
            [0, 1, 0],
          ] as [number, number, number][]
      )
    )

  const offsets = getVertexOffsets(face)

  const vertices = pipe(
    offsets,
    A.map(([dx, dy, dz]) => {
      const vx = x + dx
      const vy = y + dy
      const vz = z + dz
      const ao = calculateVertexAOPure(blocks, vx, vy, vz, size, config)
      return { x: vx, y: vy, z: vz, ao }
    })
  )

  const averageAO = pipe(
    vertices,
    A.map((v) => v.ao as number), // Brand型から数値を取得
    A.reduce(0, N.sum),
    (total) => BrandedTypes.createAOValue(total / 4) // 平均を計算してAOValueに変換
  )

  return {
    vertices: vertices as [AOVertex, AOVertex, AOVertex, AOVertex],
    averageAO,
  }
}

// Smooth AO values across neighboring vertices
const smoothAOValues = (aoVertices: AOVertex[]): AOVertex[] => {
  // Create a map of vertex positions to AO values using Effect-TS patterns
  const aoMap = pipe(
    aoVertices,
    A.reduce(new Map<string, number[]>(), (map, vertex) => {
      const key = `${vertex.x},${vertex.y},${vertex.z}`
      pipe(
        Option.fromNullable(map.get(key)),
        Option.match({
          onNone: () => map.set(key, [vertex.ao]),
          onSome: (values) => map.set(key, [...values, vertex.ao]),
        })
      )
      return map
    })
  )

  // Average AO values for each vertex position using Effect-TS patterns
  const smoothed = pipe(
    aoVertices,
    A.map((vertex) => {
      const key = `${vertex.x},${vertex.y},${vertex.z}`
      const values = aoMap.get(key)!
      const avgAO = pipe(values, A.reduce(0, N.sum), (total) => total / values.length)

      return {
        ...vertex,
        ao: avgAO,
      }
    })
  )

  return pipe(
    smoothed,
    A.map((vertex) => ({
      ...vertex,
      ao: BrandedTypes.createAOValue(vertex.ao as number),
    }))
  )
}

// ========================================
// Service Implementation
// ========================================

const makeService = (config: AOConfig): AmbientOcclusionService => ({
  calculateVertexAO: (blocks, x, y, z, size) =>
    pipe(
      config.enabled,
      Match.value,
      Match.when(true, () =>
        Effect.try({
          try: () => calculateVertexAOPure(blocks, x, y, z, size, config),
          catch: (error) =>
            AmbientOcclusionError(
              `Failed to calculate vertex AO: ${String(error)}`,
              `calculateVertexAO(${x},${y},${z})`,
              Date.now()
            ),
        })
      ),
      Match.when(false, () => Effect.succeed(BrandedTypes.createAOValue(1.0))),
      Match.exhaustive
    ),

  calculateFaceAO: (blocks, x, y, z, face, size) =>
    pipe(
      config.enabled,
      Match.value,
      Match.when(true, () =>
        Effect.try({
          try: () => calculateFaceAOPure(blocks, x, y, z, face, size, config),
          catch: (error) =>
            AmbientOcclusionError(
              `Failed to calculate face AO: ${String(error)}`,
              `calculateFaceAO(${face})`,
              Date.now()
            ),
        })
      ),
      Match.when(false, () =>
        Effect.succeed<AOFace>({
          vertices: [
            { x, y, z, ao: BrandedTypes.createAOValue(1.0) },
            { x: x + 1, y, z, ao: BrandedTypes.createAOValue(1.0) },
            { x: x + 1, y: y + 1, z, ao: BrandedTypes.createAOValue(1.0) },
            { x, y: y + 1, z, ao: BrandedTypes.createAOValue(1.0) },
          ],
          averageAO: BrandedTypes.createAOValue(1.0),
        })
      ),
      Match.exhaustive
    ),

  applyAOToChunk: (chunkData) =>
    pipe(
      config.enabled,
      Match.value,
      Match.when(false, () => Effect.succeed([] as readonly AOVertex[])),
      Match.when(true, () =>
        Effect.try({
          try: () => {
            // Calculate AO for all solid block vertices using Effect-TS patterns
            const aoVertices = pipe(
              A.range(0, chunkData.size - 1),
              A.flatMap((x) =>
                pipe(
                  A.range(0, chunkData.size - 1),
                  A.flatMap((y) =>
                    pipe(
                      A.range(0, chunkData.size - 1),
                      A.flatMap((z) => {
                        const blockType = chunkData.blocks[x]?.[y]?.[z] ?? 0

                        // Match.valueパターンを使用してブロック種別チェック
                        return pipe(
                          blockType,
                          Match.value,
                          Match.when(0, () => []), // 空気ブロックの場合は空配列
                          Match.orElse(() => {
                            // ソリッドブロックの場合はAO計算
                            const faces: Array<'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'> = [
                              'top',
                              'bottom',
                              'front',
                              'back',
                              'left',
                              'right',
                            ]

                            return pipe(
                              faces,
                              A.flatMap((face) => {
                                const aoFace = calculateFaceAOPure(
                                  chunkData.blocks.map((layer) => layer.map((row) => [...row])),
                                  x,
                                  y,
                                  z,
                                  face,
                                  chunkData.size,
                                  config
                                )
                                return Array.from(aoFace.vertices)
                              })
                            )
                          })
                        )
                      })
                    )
                  )
                )
              )
            )

            // Apply smoothing if enabled using Match.value pattern
            const finalVertices = pipe(
              config.smoothing,
              Match.value,
              Match.when(true, () => smoothAOValues(aoVertices)),
              Match.when(false, () => aoVertices),
              Match.exhaustive
            )

            return finalVertices
          },
          catch: (error) =>
            AmbientOcclusionError(`Failed to apply AO to chunk: ${String(error)}`, 'applyAOToChunk', Date.now()),
        })
      ),
      Match.exhaustive
    ),
})

// ========================================
// Layer Construction
// ========================================

export const AmbientOcclusionLive = Layer.succeed(
  AmbientOcclusionService,
  makeService({
    enabled: true,
    strength: 0.8,
    smoothing: true,
    quality: 'medium',
  })
)

// ========================================
// Utility Exports
// ========================================

export const blendAOColors = (baseColor: [number, number, number], aoValue: number): [number, number, number] => {
  // Darken the base color based on AO value
  return [baseColor[0] * aoValue, baseColor[1] * aoValue, baseColor[2] * aoValue]
}

export const getAOQualitySettings = (
  quality: AOConfig['quality']
): {
  sampleRadius: number
  sampleCount: number
} =>
  pipe(
    Match.value(quality),
    Match.when('low', () => ({ sampleRadius: 1, sampleCount: 6 })),
    Match.when('medium', () => ({ sampleRadius: 1, sampleCount: 14 })),
    Match.when('high', () => ({ sampleRadius: 2, sampleCount: 26 })),
    Match.orElse(() => ({ sampleRadius: 1, sampleCount: 14 }))
  )
