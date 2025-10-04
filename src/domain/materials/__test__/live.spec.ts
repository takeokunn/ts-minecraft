import { it, expect } from '@effect/vitest'
import { Effect } from 'effect'
import { MaterialService } from '../service'
import { MaterialServiceLayer } from '../live'

it.effect('MaterialServiceLayer provides service implementation', () =>
  Effect.gen(function* () {
    const service = yield* MaterialService
    expect(typeof service.getMaterial).toBe('function')
  }).pipe(Effect.provide(MaterialServiceLayer))
)
