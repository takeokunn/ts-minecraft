import { describe, expect, it } from 'vitest'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Either from 'effect/Either'
import {
  AppendPageRequest,
  FurnitureApplicationService,
  PublishRequest,
  SignUpdateRequest,
  SleepRequest,
} from '../service.js'
import {
  CreateBedInput,
  CreateBookInput,
  CreateSignInput,
  FurnitureError,
} from '../types.js'
import { createFurnitureRepository, type FurnitureRepository } from '../repository.js'
import { makeFurnitureApplicationService } from '../service.js'

const run = <A>(effect: Effect.Effect<A, any>) => Effect.runPromise(effect)

const withService = async () => {
  const repository: FurnitureRepository = await run(createFurnitureRepository)
  return makeFurnitureApplicationService(repository)
}

describe('furniture/service', () => {
  it('bed lifecycle operations', async () => {
    const service = await withService()

    const bed = await run(
      service.placeBed({
        color: 'red',
        orientation: 'north',
        coordinates: { x: 0, y: 64, z: 0 },
        requestedBy: 'player_owner01',
      } satisfies CreateBedInput)
    )

    const sleepRequest: SleepRequest = {
      bedId: bed.id,
      playerId: 'player_owner01',
      environment: {
        lightLevel: 5,
        noiseLevel: 10,
        monstersNearby: false,
        isNightTime: true,
        weather: 'clear',
      },
    }

    const sleeping = await run(service.startSleep(sleepRequest))
    expect(Option.isSome(sleeping.occupant)).toBe(true)

    const rested = await run(service.finishSleep(bed.id))
    expect(Option.isNone(rested.occupant)).toBe(true)
  })

  it('book operations append and publish', async () => {
    const service = await withService()
    const book = await run(
      service.registerBook({
        title: 'Chronicles',
        category: 'journal',
        createdBy: 'player_author01',
        pages: [{ index: 0, content: 'Prologue' }],
      } satisfies CreateBookInput)
    )

    const appended = await run(
      service.appendBookPage({
        bookId: book.id,
        author: 'player_author01',
        page: { index: 1, content: 'Chapter 1' },
      } satisfies AppendPageRequest)
    )

    expect(appended.pages.length).toBe(2)

    const published = await run(service.publishBook({ bookId: book.id } satisfies PublishRequest))
    expect(published.state._tag).toBe('Published')
  })

  it('sign update respects editor permission', async () => {
    const service = await withService()
    const sign = await run(
      service.registerSign({
        style: 'oak',
        text: { lines: ['Welcome'], alignment: 'center' },
        placedBy: 'player_sign_owner',
        location: { x: 5, y: 70, z: 5 },
      } satisfies CreateSignInput)
    )

    const updated = await run(
      service.editSign({
        signId: sign.id,
        editor: 'player_sign_owner',
        text: { lines: ['Welcome Home'], alignment: 'center' },
      } satisfies SignUpdateRequest)
    )

    expect(updated.text.lines[0]).toBe('Welcome Home')

    const failure = await run(
      Effect.either(
        service.editSign({
          signId: sign.id,
          editor: 'player_other',
          text: { lines: ['Hack'], alignment: 'left' },
        })
      )
    )

    expect(Either.isLeft(failure)).toBe(true)
    if (Either.isLeft(failure)) {
      expect(failure.left).toStrictEqual(
        FurnitureError.permissionDenied(sign.id, 'editor mismatch')
      )
    }
  })
})
