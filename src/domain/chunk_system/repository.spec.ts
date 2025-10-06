import { describe, expect, it } from '@effect/vitest'
import { Effect, Stream } from 'effect'
import { ChunkSystemRepository } from './repository'
import { ChunkSystemError } from './types'

describe('chunk_system/repository tag', () => {
  it.effect('Context tag resolves provided service', () => {
    const stub = {
      load: Effect.fail(ChunkSystemError.RepositoryFailure({ reason: 'not implemented' })),
      save: () => Effect.void,
      observe: Stream.empty,
    } satisfies ChunkSystemRepository

    return Effect.gen(function* () {
      const service = yield* ChunkSystemRepository
      expect(service).toBe(stub)
    }).pipe(Effect.provideService(ChunkSystemRepository, stub))
  })
})
