import { describe, expect, it } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from '@effect/schema/Schema'
import * as Either from 'effect/Either'
import {
  CreateBedInput,
  CreateBookInput,
  CreateSignInput,
  FurnitureError,
  TickSchema,
} from '../types.js'
import {
  appendPage,
  beginSleep,
  createBed,
  createBook,
  createSign,
  finishSleep,
  publishBook,
  updateSignText,
} from '../operations.js'

const run = <A>(effect: Effect.Effect<A, any>) => Effect.runPromise(effect)

describe('furniture/operations', () => {
  it('createBed produces default durability and empty occupant', async () => {
    const bed = await run(
      createBed({
        color: 'red',
        orientation: 'north',
        coordinates: { x: 1, y: 64, z: 1 },
        requestedBy: 'player_abcd1234',
      } satisfies CreateBedInput)
    )

    expect(bed.id.startsWith('furn_')).toBe(true)
    expect(bed.durability).toBe(100)
    expect(Option.isNone(bed.occupant)).toBe(true)
    expect(typeof bed.placedAt).toBe('number')
  })

  it('beginSleep succeeds for valid environment', async () => {
    const bed = await run(
      createBed({
        color: 'blue',
        orientation: 'south',
        coordinates: { x: 0, y: 70, z: 0 },
        requestedBy: 'player_abcd1234',
      })
    )

    const environment = {
      lightLevel: 5,
      noiseLevel: 10,
      monstersNearby: false,
      isNightTime: true,
      weather: 'clear',
    }

    const currentTick = await run(Schema.decode(TickSchema)(250))

    const updated = await run(
      beginSleep({
        bed,
        playerId: 'player_abcd1234',
        environment,
        currentTick,
      })
    )

    expect(Option.isSome(updated.occupant)).toBe(true)
    expect(updated.lastSleptAt).toStrictEqual(Option.some(currentTick))
  })

  it('beginSleep fails when monsters are nearby', async () => {
    const bed = await run(
      createBed({
        color: 'green',
        orientation: 'west',
        coordinates: { x: -2, y: 66, z: 4 },
        requestedBy: 'player_abcd1234',
      })
    )

    const environment = {
      lightLevel: 5,
      noiseLevel: 10,
      monstersNearby: true,
      isNightTime: true,
      weather: 'clear',
    }

    const currentTick = await run(Schema.decode(TickSchema)(200))

    const result = await run(
      Effect.either(
        beginSleep({
          bed,
          playerId: 'player_abcd1234',
          environment,
          currentTick,
        })
      )
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toStrictEqual(FurnitureError.invalidEnvironment(bed.id))
    }
  })

  it('finishSleep clears occupant', async () => {
    const bed = await run(
      createBed({
        color: 'purple',
        orientation: 'east',
        coordinates: { x: 3, y: 65, z: 3 },
        requestedBy: 'player_abcd1234',
      })
    )

    const environment = {
      lightLevel: 5,
      noiseLevel: 10,
      monstersNearby: false,
      isNightTime: true,
      weather: 'clear',
    }

    const currentTick = await run(Schema.decode(TickSchema)(120))
    const sleeping = await run(beginSleep({ bed, playerId: 'player_abcd1234', environment, currentTick }))
    const rested = await run(finishSleep(sleeping))

    expect(Option.isNone(rested.occupant)).toBe(true)
  })

  it('appendPage rejects published book', async () => {
    const book = await run(
      createBook({
        title: 'Guide',
        category: 'journal',
        createdBy: 'player_abcd1234',
        pages: [{ index: 0, content: 'Start' }],
      } satisfies CreateBookInput)
    )

    const published = await run(publishBook(book, 10))

    const result = await run(
      Effect.either(
        appendPage({ book: published, author: 'player_abcd1234', page: { index: 1, content: 'More' } })
      )
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toStrictEqual(FurnitureError.alreadyPublished(book.id))
    }
  })

  it('updateSignText enforces editor ownership', async () => {
    const sign = await run(
      createSign({
        style: 'oak',
        text: { lines: ['Hello'], alignment: 'left' },
        placedBy: 'player_owner01',
        location: { x: 5, y: 70, z: 5 },
      } satisfies CreateSignInput)
    )

    const tick = await run(Schema.decode(TickSchema)(400))

    const result = await run(
      Effect.either(
        updateSignText({
          sign,
          editor: 'player_other02',
          text: { lines: ['Intruder'], alignment: 'center' },
          currentTick: tick,
        })
      )
    )

    expect(Either.isLeft(result)).toBe(true)
    if (Either.isLeft(result)) {
      expect(result.left).toStrictEqual(
        FurnitureError.permissionDenied(sign.id, 'editor mismatch')
      )
    }
  })
})
