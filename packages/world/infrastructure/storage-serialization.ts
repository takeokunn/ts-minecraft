import { Effect, Option, Schema } from 'effect'
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

export const decodeOptionalWorldMetadata = (value: WorldMetadataEncoded | undefined): Effect.Effect<Option.Option<WorldMetadata>, StorageError> =>
  Option.match(Option.fromNullable(value), {
    onNone: () => Effect.succeed(Option.none<WorldMetadata>()),
    onSome: (r) => decodeWorldMetadata(r, 'loadWorldMetadata').pipe(Effect.map(Option.some)),
  })

export const collectDecodedWorldMetadata = (
  rows: ReadonlyArray<{ readonly key: string; readonly value: unknown }>,
): Effect.Effect<{
  readonly valid: ReadonlyArray<{ readonly worldId: WorldId; readonly metadata: WorldMetadata }>
  readonly corrupt: ReadonlyArray<WorldId>
}, never> =>
  Effect.gen(function* () {
    const valid: Array<{ worldId: WorldId; metadata: WorldMetadata }> = []
    const corrupt: Array<WorldId> = []
    yield* Effect.forEach(
      rows,
      (row) =>
        Schema.decodeUnknown(WorldMetadataSchema)(row.value).pipe(
          Effect.match({
            onSuccess: (metadata) => {
              valid.push({ worldId: row.key as WorldId, metadata })
            },
            onFailure: () => {
              corrupt.push(row.key as WorldId)
            },
          }),
        ),
      { concurrency: 1 },
    )
    return { valid, corrupt }
  })
