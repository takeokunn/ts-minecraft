import { Effect, Either, Option, Schema } from 'effect'
import type { WorldId } from '@ts-minecraft/core'
import { StorageError } from '../domain/errors'
import { WorldMetadataSchema, type WorldMetadata, type WorldMetadataEncoded } from '../domain/world-metadata-model'

export const encodeWorldMetadata = (metadata: WorldMetadata): Effect.Effect<WorldMetadataEncoded, StorageError> =>
  Schema.encodeUnknown(WorldMetadataSchema)(metadata).pipe(
    Effect.mapError((e) => new StorageError({ operation: 'saveWorldMetadata', cause: e })),
  )

export const decodeWorldMetadata = (value: unknown, operation: string): Effect.Effect<WorldMetadata, StorageError> =>
  Schema.decodeUnknown(WorldMetadataSchema)(value).pipe(
    Effect.mapError((e) => new StorageError({ operation, cause: e })),
  )

export const decodeOptionalWorldMetadata = (value: WorldMetadataEncoded | undefined): Effect.Effect<Option.Option<WorldMetadata>, StorageError> => {
  if (value === undefined) return Effect.succeed(Option.none<WorldMetadata>())
  return Effect.gen(function* () {
    const metadata = yield* decodeWorldMetadata(value, 'loadWorldMetadata')
    return Option.some(metadata)
  })
}

export const collectDecodedWorldMetadata = (
  rows: ReadonlyArray<{ readonly key: string; readonly value: unknown }>,
): Effect.Effect<{
  readonly valid: ReadonlyArray<{ readonly worldId: WorldId; readonly metadata: WorldMetadata }>
  readonly corrupt: ReadonlyArray<WorldId>
}, never> =>
  Effect.gen(function* () {
    const decoded = yield* Effect.forEach(
      rows.map((row, index) => ({ row, index })),
      ({ row, index }) =>
        Schema.decodeUnknown(WorldMetadataSchema)(row.value).pipe(
          Effect.either,
          Effect.map((result) => ({ index, row, result })),
        ),
      { concurrency: 8 },
    )

    const valid: Array<{ worldId: WorldId; metadata: WorldMetadata }> = []
    const corrupt: Array<WorldId> = []
    for (const { row, result } of [...decoded].sort((left, right) => left.index - right.index)) {
      if (Either.isRight(result)) {
        valid.push({ worldId: row.key as WorldId, metadata: result.right })
      } else {
        corrupt.push(row.key as WorldId)
      }
    }
    return { valid, corrupt }
  })
