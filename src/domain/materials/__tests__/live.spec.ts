import { expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { MaterialServiceLayer } from '../live'
import { MaterialService } from '../service'

it.effect('MaterialServiceLayer provides service implementation', () =>
  Effect.gen(function* () {
    const service = yield* MaterialService
    expect(typeof service.getMaterial).toBe('function')
  }).pipe(Effect.provide(MaterialServiceLayer))
)
