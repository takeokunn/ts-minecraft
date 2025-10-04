import { it, expect } from '@effect/vitest'
import { Effect } from 'effect'
import { materialCatalog } from '../catalog'
import { MaterialRepository, MaterialRepositoryLayer } from '../repository'

it.effect('getByBlockId returns the matching material', () =>
  Effect.gen(function* () {
    const repository = yield* MaterialRepository
    const sample = materialCatalog[0]
    const material = yield* repository.getByBlockId(sample.blockId)
    expect(material.id).toBe(sample.id)
  }).pipe(Effect.provide(MaterialRepositoryLayer))
)

it.effect('all returns the entire catalog', () =>
  Effect.gen(function* () {
    const repository = yield* MaterialRepository
    const materials = yield* repository.all
    expect(materials.length).toBe(materialCatalog.length)
  }).pipe(Effect.provide(MaterialRepositoryLayer))
)
