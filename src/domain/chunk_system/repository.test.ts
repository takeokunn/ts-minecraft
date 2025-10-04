import { describe, expect, it } from '@effect/vitest'
import { Effect, Stream } from 'effect'
import { ChunkSystemRepository } from './repository.js'
import { ChunkSystemError } from './types.js'

describe('chunk_system/repository tag', () => {
  it.effect('Context tag resolves provided service', () =>
    Effect.gen(function* () {
      const stub = {
        load: Effect.fail(ChunkSystemError.RepositoryFailure({ reason: 'not implemented' })),
        save: () => Effect.void,
        observe: Stream.empty,
      } satisfies ChunkSystemRepository

      const service = yield* Effect.service(ChunkSystemRepository).pipe(
        Effect.provideService(ChunkSystemRepository, stub)
      )

      expect(service).toBe(stub)
    })
  )
})
