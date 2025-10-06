import { Effect, Option, pipe, Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_VOLUME } from '../../types'
import { type ChunkMetadata, type HeightValue, HeightValue as MakeHeightValue } from '../../value_object/chunk_metadata'
import type { ChunkPosition } from '../../value_object/chunk_position'
import type { ChunkData } from '../chunk_data'
import { ChunkDataSchema, ChunkDataValidationError } from '../chunk_data'

/**
 * Lens定義
 */
type Lens<A> = {
  readonly get: (chunk: ChunkData) => A
  readonly replace: (value: A) => (chunk: ChunkData) => ChunkData
  readonly modify: (f: (value: A) => A) => (chunk: ChunkData) => ChunkData
}

type IndexedLens<A> = {
  readonly get: (chunk: ChunkData) => A
  readonly replace: (value: A) => (chunk: ChunkData) => ChunkData
  readonly modify: (f: (value: A) => A) => (chunk: ChunkData) => ChunkData
}

const decodeChunk = Schema.decodeUnknownSync(ChunkDataSchema)

const rebuild = (chunk: ChunkData, updates: Partial<ChunkData>): ChunkData => decodeChunk({ ...chunk, ...updates })

const safeBlockIndex = (index: number): Option<number> =>
  Number.isInteger(index) && index >= 0 && index < CHUNK_VOLUME ? Option.some(index) : Option.none()

const safeHeightIndex = (index: number): Option<number> =>
  Number.isInteger(index) && index >= 0 && index < CHUNK_SIZE * CHUNK_SIZE ? Option.some(index) : Option.none()

const withBlocks = (chunk: ChunkData, blocks: Uint16Array): ChunkData => rebuild(chunk, { blocks })

const withMetadata = (chunk: ChunkData, metadata: ChunkMetadata): ChunkData => rebuild(chunk, { metadata })

const withPosition = (chunk: ChunkData, position: ChunkPosition): ChunkData => rebuild(chunk, { position })

const withDirty = (chunk: ChunkData, isDirty: boolean): ChunkData => rebuild(chunk, { isDirty })

const invalidIndexError = (field: 'block' | 'height', index: number): ChunkDataValidationError =>
  ChunkDataValidationError({
    message: `${field === 'block' ? 'ブロック' : '高さマップ'}のインデックスが範囲外です: ${index}`,
    field: field === 'block' ? 'blocks' : 'heightMap',
    value: index,
  })

const updateBlocksAt = (chunk: ChunkData, index: number, transform: (current: number) => number): ChunkData =>
  pipe(
    safeBlockIndex(index),
    Option.map((validatedIndex) => {
      const blocks = new Uint16Array(chunk.blocks)
      blocks[validatedIndex] = transform(blocks[validatedIndex] ?? 0)
      return withBlocks(chunk, blocks)
    }),
    Option.getOrElse(() => chunk)
  )

const updateHeightAt = (chunk: ChunkData, index: number, transform: (current: HeightValue) => HeightValue): ChunkData =>
  pipe(
    safeHeightIndex(index),
    Option.map((validatedIndex) => {
      const nextHeightMap = [...chunk.metadata.heightMap]
      const current = nextHeightMap[validatedIndex] ?? MakeHeightValue(0)
      nextHeightMap[validatedIndex] = transform(current)
      return withMetadata(chunk, {
        ...chunk.metadata,
        heightMap: nextHeightMap,
      })
    }),
    Option.getOrElse(() => chunk)
  )

const lens = <A>(getter: (chunk: ChunkData) => A, setter: (chunk: ChunkData, value: A) => ChunkData): Lens<A> => ({
  get: getter,
  replace: (value) => (chunk) => setter(chunk, value),
  modify: (f) => (chunk) => setter(chunk, f(getter(chunk))),
})

const indexedLens = <A>(
  getter: (chunk: ChunkData) => A,
  setter: (chunk: ChunkData, value: A) => ChunkData
): IndexedLens<A> => ({
  get: getter,
  replace: (value) => (chunk) => setter(chunk, value),
  modify: (f) => (chunk) => setter(chunk, f(getter(chunk))),
})

/**
 * ChunkDataOptics - 型安全なプロパティアクセス
 */
export const ChunkDataOptics = {
  id: lens(
    (chunk) => chunk.id,
    (chunk, id) => rebuild(chunk, { id })
  ),
  position: lens(
    (chunk) => chunk.position,
    (chunk, position) => withPosition(chunk, position)
  ),
  blocks: lens(
    (chunk) => chunk.blocks,
    (chunk, blocks) => withBlocks(chunk, blocks)
  ),
  metadata: lens(
    (chunk) => chunk.metadata,
    (chunk, metadata) => withMetadata(chunk, metadata)
  ),
  isDirty: lens(
    (chunk) => chunk.isDirty,
    (chunk, isDirty) => withDirty(chunk, isDirty)
  ),
  metadataTimestamp: lens(
    (chunk) => chunk.metadata.lastUpdate,
    (chunk, timestamp) =>
      withMetadata(chunk, {
        ...chunk.metadata,
        lastUpdate: timestamp,
      })
  ),
  metadataBiome: lens(
    (chunk) => chunk.metadata.biome,
    (chunk, biome) =>
      withMetadata(chunk, {
        ...chunk.metadata,
        biome,
      })
  ),
  metadataLightLevel: lens(
    (chunk) => chunk.metadata.lightLevel,
    (chunk, lightLevel) =>
      withMetadata(chunk, {
        ...chunk.metadata,
        lightLevel,
      })
  ),
  metadataHeightMap: lens(
    (chunk) => chunk.metadata.heightMap,
    (chunk, heightMap) =>
      withMetadata(chunk, {
        ...chunk.metadata,
        heightMap,
      })
  ),
  positionX: lens(
    (chunk) => chunk.position.x,
    (chunk, x) => withPosition(chunk, { ...chunk.position, x })
  ),
  positionZ: lens(
    (chunk) => chunk.position.z,
    (chunk, z) => withPosition(chunk, { ...chunk.position, z })
  ),
  blockAt: (index: number): IndexedLens<number> =>
    indexedLens(
      (chunk) =>
        pipe(
          safeBlockIndex(index),
          Option.map((validated) => chunk.blocks[validated] ?? 0),
          Option.getOrElse(() => 0)
        ),
      (chunk, blockId) => updateBlocksAt(chunk, index, () => blockId)
    ),
  heightMapAt: (index: number): IndexedLens<HeightValue> =>
    indexedLens(
      (chunk) =>
        pipe(
          safeHeightIndex(index),
          Option.map((validated) => chunk.metadata.heightMap[validated] ?? MakeHeightValue(0)),
          Option.getOrElse(() => MakeHeightValue(0))
        ),
      (chunk, height) => updateHeightAt(chunk, index, () => height)
    ),
} as const

/**
 * ChunkDataOpticsHelpers - よく使う更新処理
 */
export const ChunkDataOpticsHelpers = {
  setBlock: (chunk: ChunkData, index: number, blockId: number): ChunkData =>
    updateBlocksAt(chunk, index, () => blockId),
  modifyBlock: (chunk: ChunkData, index: number, transform: (value: number) => number): ChunkData =>
    updateBlocksAt(chunk, index, transform),
  setHeight: (chunk: ChunkData, index: number, height: HeightValue): ChunkData =>
    updateHeightAt(chunk, index, () => height),
  modifyHeight: (chunk: ChunkData, index: number, transform: (value: HeightValue) => HeightValue): ChunkData =>
    updateHeightAt(chunk, index, transform),
  updateMetadata: (chunk: ChunkData, updates: Partial<ChunkMetadata> | undefined): ChunkData =>
    pipe(
      Option.fromNullable(updates),
      Option.match({
        onNone: () => chunk,
        onSome: (metadataUpdates) =>
          withMetadata(chunk, {
            ...chunk.metadata,
            ...metadataUpdates,
          }),
      })
    ),
  setPosition: (chunk: ChunkData, position: ChunkPosition): ChunkData => withPosition(chunk, position),
  setDirty: (chunk: ChunkData, isDirty: boolean): ChunkData => withDirty(chunk, isDirty),
  markDirty: (chunk: ChunkData): ChunkData => withDirty(chunk, true),
  markClean: (chunk: ChunkData): ChunkData => withDirty(chunk, false),
} as const

/**
 * 複数要素アクセス用Optics
 */
export const ChunkDataMultiAccessOptics = {
  blocksRange: (start: number, endExclusive: number) =>
    lens(
      (chunk) => {
        const clampedStart = Math.max(0, Math.min(start, CHUNK_VOLUME))
        const clampedEnd = Math.max(clampedStart, Math.min(endExclusive, CHUNK_VOLUME))
        return Array.from(chunk.blocks.slice(clampedStart, clampedEnd))
      },
      (chunk, values) => {
        const length = Math.min(values.length, CHUNK_VOLUME)
        return values
          .slice(0, length)
          .reduce((current, value, offset) => updateBlocksAt(current, start + offset, () => value ?? 0), chunk)
      }
    ),
  blocksInRegion: (startX: number, startZ: number, width: number, depth: number, baseY: number) =>
    lens(
      (chunk) => {
        return Array.from({ length: depth }, (_, dz) => dz).flatMap((dz) =>
          Array.from({ length: width }, (_, dx) => {
            const index = baseY * CHUNK_SIZE * CHUNK_SIZE + (startZ + dz) * CHUNK_SIZE + (startX + dx)
            return ChunkDataOptics.blockAt(index).get(chunk)
          })
        )
      },
      (chunk, values) => {
        const regionCoordinates = Array.from({ length: depth }, (_, dz) => dz).flatMap((dz) =>
          Array.from({ length: width }, (_, dx) => ({ dx, dz }))
        )

        return regionCoordinates.reduce((current, coordinate, index) => {
          const blockIndex =
            baseY * CHUNK_SIZE * CHUNK_SIZE + (startZ + coordinate.dz) * CHUNK_SIZE + (startX + coordinate.dx)
          const nextValue = values[index] ?? 0
          return updateBlocksAt(current, blockIndex, () => nextValue)
        }, chunk)
      }
    ),
  heightMapRegion: (startX: number, startZ: number, width: number, depth: number) =>
    lens(
      (chunk) => {
        return Array.from({ length: depth }, (_, dz) => dz).flatMap((dz) =>
          Array.from({ length: width }, (_, dx) => {
            const index = (startZ + dz) * CHUNK_SIZE + (startX + dx)
            return ChunkDataOptics.heightMapAt(index).get(chunk)
          })
        )
      },
      (chunk, values) => {
        const regionCoordinates = Array.from({ length: depth }, (_, dz) => dz).flatMap((dz) =>
          Array.from({ length: width }, (_, dx) => ({ dx, dz }))
        )

        return regionCoordinates.reduce((current, coordinate, index) => {
          const heightIndex = (startZ + coordinate.dz) * CHUNK_SIZE + (startX + coordinate.dx)
          const nextValue = values[index] ?? MakeHeightValue(0)
          return updateHeightAt(current, heightIndex, () => nextValue)
        }, chunk)
      }
    ),
} as const

/**
 * 安全なインデックスアクセスをEffectで提供
 */
export const ChunkDataOpticsEffect = {
  getBlock: (chunk: ChunkData, index: number): Effect.Effect<number, ChunkDataValidationError> =>
    pipe(
      safeBlockIndex(index),
      Option.match({
        onNone: () => Effect.fail(invalidIndexError('block', index)),
        onSome: (validated) => Effect.succeed(chunk.blocks[validated] ?? 0),
      })
    ),
  getHeight: (chunk: ChunkData, index: number): Effect.Effect<HeightValue, ChunkDataValidationError> =>
    pipe(
      safeHeightIndex(index),
      Option.match({
        onNone: () => Effect.fail(invalidIndexError('height', index)),
        onSome: (validated) =>
          Effect.succeed((chunk.metadata.heightMap[validated] ?? (0 as HeightValue)) as HeightValue),
      })
    ),
} as const
