import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import { describe, expect, it } from 'vitest'
import { createBed, createBook, createSign } from '../operations.js'
import { createFurnitureRepository } from '../repository.js'
import { FurnitureError } from '../types.js'

const run = <A>(effect: Effect.Effect<A, any>) => Effect.runPromise(effect)

describe('furniture/repository', () => {
  it('save and retrieve furniture', async () => {
    const repository = await run(createFurnitureRepository)
    const bed = await run(
      createBed({
        color: 'red',
        orientation: 'north',
        coordinates: { x: 0, y: 64, z: 0 },
        requestedBy: 'player_abcd1234',
      })
    )

    await run(repository.save(bed))
    const stored = await run(repository.findById(bed.id))

    expect(stored).toStrictEqual(bed)
  })

  it('list filters by kind', async () => {
    const repository = await run(createFurnitureRepository)
    const bed = await run(
      createBed({
        color: 'blue',
        orientation: 'south',
        coordinates: { x: 1, y: 64, z: 1 },
        requestedBy: 'player_abcd1234',
      })
    )
    const book = await run(
      createBook({
        title: 'Lore',
        category: 'lore',
        createdBy: 'player_abcd1234',
        pages: [{ index: 0, content: 'Page' }],
      })
    )

    await run(repository.save(bed))
    await run(repository.save(book))

    const beds = await run(repository.list('Bed'))
    expect(beds.length).toBeGreaterThan(0)
    expect(beds.every((entity) => entity._tag === 'Bed')).toBe(true)
  })

  it('delete removes entity', async () => {
    const repository = await run(createFurnitureRepository)
    const sign = await run(
      createSign({
        style: 'oak',
        text: { lines: ['hello'], alignment: 'left' },
        placedBy: 'player_sign01',
        location: { x: 2, y: 70, z: 2 },
      })
    )

    await run(repository.save(sign))
    await run(repository.delete(sign.id))

    const result = await run(Effect.either(repository.findById(sign.id)))
    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toStrictEqual(FurnitureError.notFound(sign.id))
    }
  })

  it('transact provides immutable snapshot', async () => {
    const repository = await run(createFurnitureRepository)
    const bed = await run(
      createBed({
        color: 'green',
        orientation: 'east',
        coordinates: { x: 3, y: 64, z: 3 },
        requestedBy: 'player_abcd1234',
      })
    )
    await run(repository.save(bed))

    const ids = await run(repository.transact((items) => items.map((item) => item.id)))
    expect(ids).toContain(bed.id)
  })
})
