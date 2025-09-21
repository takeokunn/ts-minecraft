import { Effect, Context, Layer, Schema, Option, Match, pipe, Array as A, Record as R, Number as N } from 'effect'
import type { ChunkData, BlockType } from './MeshGenerator'

// ========================================
// Type Definitions
// ========================================

export interface AOVertex {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly ao: number // 0.0 (fully occluded) to 1.0 (fully lit)
}

export interface AOFace {
  readonly vertices: readonly [AOVertex, AOVertex, AOVertex, AOVertex]
  readonly averageAO: number
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

export class AmbientOcclusionError extends Schema.TaggedError<AmbientOcclusionError>()('AmbientOcclusionError', {
  reason: Schema.String,
  context: Schema.String,
  timestamp: Schema.Number,
}) {}

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
  ) => Effect.Effect<number, AmbientOcclusionError>

  readonly calculateFaceAO: (
    blocks: number[][][],
    x: number,
    y: number,
    z: number,
    face: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right',
    size: number
  ) => Effect.Effect<AOFace, AmbientOcclusionError>

  readonly applyAOToChunk: (
    chunkData: ChunkData
  ) => Effect.Effect<readonly AOVertex[], AmbientOcclusionError>
}

export const AmbientOcclusionService = Context.GenericTag<AmbientOcclusionService>('@minecraft/AmbientOcclusionService')

// ========================================
// Helper Functions (Pure Functions)
// ========================================

const getBlock = (blocks: number[][][], x: number, y: number, z: number, size: number): BlockType =>
  pipe(
    x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size
      ? Option.some(true)
      : Option.none(),
    Option.flatMap(() => Option.fromNullable(blocks[x]?.[y]?.[z])),
    Option.getOrElse(() => 0)
  )

const isOccluding = (blockType: BlockType): boolean =>
  blockType !== 0 // Non-air blocks occlude

// Calculate AO for a vertex based on surrounding blocks
// Uses the classic Minecraft-style AO algorithm
const calculateVertexAOPure = (
  blocks: number[][][],
  x: number,
  y: number,
  z: number,
  size: number,
  config: AOConfig
): number => {
  // Generate neighbor offsets (3x3x3 cube minus center)
  const offsets = pipe(
    A.makeBy(27, i => {
      const dx = (i % 3) - 1
      const dy = Math.floor(i / 3) % 3 - 1
      const dz = Math.floor(i / 9) - 1
      return { dx, dy, dz }
    }),
    A.filter(({ dx, dy, dz }) => !(dx === 0 && dy === 0 && dz === 0))
  )

  // Calculate occlusion
  const { occluders, samples } = pipe(
    offsets,
    A.reduce(
      { occluders: 0, samples: 0 },
      (acc, { dx, dy, dz }) => {
        const neighbor = getBlock(blocks, x + dx, y + dy, z + dz, size)
        const weight = pipe(
          Math.abs(dx) + Math.abs(dy) + Math.abs(dz),
          Match.value,
          Match.when(3, () => 0.5), // Corner blocks
          Match.orElse(() => 1.0)   // Edge blocks
        )

        return {
          occluders: acc.occluders + (isOccluding(neighbor) ? weight : 0),
          samples: acc.samples + 1
        }
      }
    )
  )

  // Calculate and clamp AO value
  return pipe(
    1.0 - (occluders / samples),
    aoRaw => 1.0 - ((1.0 - aoRaw) * config.strength),
    N.clamp({ minimum: 0.0, maximum: 1.0 })
  )
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
  // Define vertex offsets for each face
  const getVertexOffsets = (face: string): readonly [number, number, number][] =>
    pipe(
      Match.value(face),
      Match.when('top', () => [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] as const),
      Match.when('bottom', () => [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]] as const),
      Match.when('front', () => [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] as const),
      Match.when('back', () => [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] as const),
      Match.when('left', () => [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] as const),
      Match.when('right', () => [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] as const),
      Match.exhaustive
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
    A.map(v => v.ao),
    A.reduce(0, N.sum),
    total => total / 4
  )

  return {
    vertices: vertices as [AOVertex, AOVertex, AOVertex, AOVertex],
    averageAO,
  }
}

// Smooth AO values across neighboring vertices
const smoothAOValues = (aoVertices: AOVertex[]): AOVertex[] => {
  // Create a map of vertex positions to AO values
  const aoMap = new Map<string, number[]>()

  for (const vertex of aoVertices) {
    const key = `${vertex.x},${vertex.y},${vertex.z}`
    if (!aoMap.has(key)) {
      aoMap.set(key, [])
    }
    aoMap.get(key)!.push(vertex.ao)
  }

  // Average AO values for each vertex position
  const smoothed: AOVertex[] = []

  for (const vertex of aoVertices) {
    const key = `${vertex.x},${vertex.y},${vertex.z}`
    const values = aoMap.get(key)!
    const avgAO = values.reduce((sum, val) => sum + val, 0) / values.length

    smoothed.push({
      ...vertex,
      ao: avgAO,
    })
  }

  return smoothed
}

// ========================================
// Service Implementation
// ========================================

const makeService = (config: AOConfig): AmbientOcclusionService => ({
  calculateVertexAO: (blocks, x, y, z, size) =>
    pipe(
      Effect.if(config.enabled, {
        onTrue: () => Effect.try({
          try: () => calculateVertexAOPure(blocks, x, y, z, size, config),
          catch: (error) => new AmbientOcclusionError({
            reason: `Failed to calculate vertex AO: ${String(error)}`,
            context: `calculateVertexAO(${x},${y},${z})`,
            timestamp: Date.now(),
          })
        }),
        onFalse: () => Effect.succeed(1.0)
      })
    ),

  calculateFaceAO: (blocks, x, y, z, face, size) =>
    pipe(
      Effect.if(config.enabled, {
        onTrue: () => Effect.try({
          try: () => calculateFaceAOPure(blocks, x, y, z, face, size, config),
          catch: (error) => new AmbientOcclusionError({
            reason: `Failed to calculate face AO: ${String(error)}`,
            context: `calculateFaceAO(${face})`,
            timestamp: Date.now(),
          })
        }),
        onFalse: () => Effect.succeed<AOFace>({
          vertices: [
            { x, y, z, ao: 1.0 },
            { x: x + 1, y, z, ao: 1.0 },
            { x: x + 1, y: y + 1, z, ao: 1.0 },
            { x, y: y + 1, z, ao: 1.0 },
          ],
          averageAO: 1.0,
        })
      })
    ),

  applyAOToChunk: (chunkData) =>
    Effect.gen(function* () {
      try {
        if (!config.enabled) {
          return []
        }

        const aoVertices: AOVertex[] = []

        // Calculate AO for all solid block vertices
        for (let x = 0; x < chunkData.size; x++) {
          for (let y = 0; y < chunkData.size; y++) {
            for (let z = 0; z < chunkData.size; z++) {
              const blockType = chunkData.blocks[x]?.[y]?.[z] ?? 0

              // Skip air blocks
              if (blockType === 0) continue

              // Calculate AO for each face of the block
              const faces: Array<'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'> =
                ['top', 'bottom', 'front', 'back', 'left', 'right']

              for (const face of faces) {
                const aoFace = calculateFaceAOPure(
                  chunkData.blocks,
                  x,
                  y,
                  z,
                  face,
                  chunkData.size,
                  config
                )

                aoVertices.push(...aoFace.vertices)
              }
            }
          }
        }

        // Apply smoothing if enabled
        const finalVertices = config.smoothing
          ? smoothAOValues(aoVertices)
          : aoVertices

        // Log AO statistics
        const avgAO = finalVertices.reduce((sum, v) => sum + v.ao, 0) / finalVertices.length
        yield* Effect.log(
          `AO calculation complete: ${finalVertices.length} vertices, average AO: ${avgAO.toFixed(3)}`
        )

        return finalVertices
      } catch (error) {
        return yield* Effect.fail(
          new AmbientOcclusionError({
            reason: `Failed to apply AO to chunk: ${String(error)}`,
            context: 'applyAOToChunk',
            timestamp: Date.now(),
          })
        )
      }
    }),
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

export const blendAOColors = (
  baseColor: [number, number, number],
  aoValue: number
): [number, number, number] => {
  // Darken the base color based on AO value
  return [
    baseColor[0] * aoValue,
    baseColor[1] * aoValue,
    baseColor[2] * aoValue,
  ]
}

export const getAOQualitySettings = (quality: AOConfig['quality']): {
  sampleRadius: number
  sampleCount: number
} =>
  pipe(
    Match.value(quality),
    Match.when('low', () => ({ sampleRadius: 1, sampleCount: 6 })),
    Match.when('medium', () => ({ sampleRadius: 1, sampleCount: 14 })),
    Match.when('high', () => ({ sampleRadius: 2, sampleCount: 26 })),
    Match.exhaustive
  )