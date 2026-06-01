import type { Effect, MutableHashMap, Option } from 'effect'
import type { ChunkCoord } from '@ts-minecraft/core'
import type { BiomeGeneratorPort } from '../biome-generator-port'
import type { BiomeType, BiomeProperties } from '../biome'
import type { Chunk } from '../chunk'
import type { NoiseServicePort } from '../noise-service-port'
import type { computeColumnY } from '../density-function'

export type TreeColumnContext = {
  readonly biome: BiomeType
  readonly props: BiomeProperties
  readonly surfaceY: number
  readonly hasLakeBasin: boolean
  readonly supportsTree: boolean
}

export type ChunkFactory = {
  readonly createChunk: (coord: ChunkCoord) => Effect.Effect<Chunk, never>
}

export type ColumnNoiseCoordinates = {
  readonly lakeX: number
  readonly lakeZ: number
  readonly graniteX: number
  readonly graniteZ: number
  readonly dioriteX: number
  readonly dioriteZ: number
  readonly andesiteX: number
  readonly andesiteZ: number
}

export type CaveGridPoint = {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type BlockIndices = {
  readonly stoneBlockIndex: number
  readonly waterBlockIndex: number
  readonly lavaBlockIndex: number
  readonly sandBlockIndex: number
  readonly gravelBlockIndex: number
  readonly bedrockBlockIndex: number
  readonly deepslateBlockIndex: number
  readonly graniteBlockIndex: number
  readonly dioriteBlockIndex: number
  readonly andesiteBlockIndex: number
  readonly airBlockIndex: number
}

export type ColumnState = {
  readonly biome: BiomeType
  readonly props: BiomeProperties
  readonly surfaceY: number
  readonly lakeBasinY: Option.Option<number>
  readonly ruggedness: number
}

export type OverhangTarget = {
  readonly lx: number
  readonly lz: number
  readonly y: number
}

export type OverhangEntry = {
  readonly target: OverhangTarget
  readonly noiseX: number
  readonly noiseY: number
  readonly noiseZ: number
}

export type TreeColumnContextResolverDeps = {
  readonly biomeService: BiomeGeneratorPort
  readonly noiseService: NoiseServicePort
  readonly treeColumnContextCache: MutableHashMap.MutableHashMap<string, TreeColumnContext>
  readonly blockIndices: BlockIndices
}

export type ColumnStateBuildArgs = {
  readonly blocks: Uint8Array
  readonly baseWorldX: number
  readonly baseWorldZ: number
  readonly biomeColumns: ReadonlyArray<{ readonly biome: BiomeType; readonly props: BiomeProperties }>
  readonly terrainChannels: Parameters<typeof computeColumnY>[0]
  readonly initialSurfaceYs: ArrayLike<number>
  readonly lakeNoiseVals: ReadonlyArray<number>
  readonly graniteNoiseVals: ReadonlyArray<number>
  readonly dioriteNoiseVals: ReadonlyArray<number>
  readonly andesiteNoiseVals: ReadonlyArray<number>
  readonly treeColumnContextCache: MutableHashMap.MutableHashMap<string, TreeColumnContext>
  readonly blockIndices: BlockIndices
}
