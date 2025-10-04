import { describe, expect, it } from '@effect/vitest'
import { Effect, Option, Schema, pipe } from 'effect'
import * as ReadonlyArray from 'effect/ReadonlyArray'
import * as fc from 'effect/FastCheck'
import {
  AppendPageCommand,
  CreateBedInput,
  CreateBedInputSchema,
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

const effectProperty = <T>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => Effect.Effect<void>
): fc.AsyncProperty<[T]> =>
  fc.asyncProperty(arbitrary, async (value) => {
    await Effect.runPromise(predicate(value))
  })

const playerIdArbitrary = fc.hexaString({ minLength: 8, maxLength: 8 }).map((suffix) =>
  `player_${suffix.toLowerCase()}`
)

const coordinatesArbitrary = fc.record({
  x: fc.integer({ min: -512, max: 512 }),
  y: fc.integer({ min: 0, max: 256 }),
  z: fc.integer({ min: -512, max: 512 }),
})

const createBedInputArbitrary: fc.Arbitrary<CreateBedInput> = fc
  .record({
    color: fc.constantFrom('red', 'blue', 'green', 'purple', 'white'),
    orientation: fc.constantFrom('north', 'south', 'east', 'west'),
    coordinates: coordinatesArbitrary,
    requestedBy: playerIdArbitrary,
    durability: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  })
  .map((candidate) => Schema.decodeUnknownSync(CreateBedInputSchema)(candidate))

const bookPageContentArbitrary = fc.string({ minLength: 1, maxLength: 200 })

const bookPagesArbitrary = fc
  .array(bookPageContentArbitrary, { minLength: 1, maxLength: 10 })
  .map((contents) => contents.map((content, index) => ({ index, content })))

const createBookInputArbitrary: fc.Arbitrary<CreateBookInput> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 32 }),
  category: fc.constantFrom('lore', 'instruction', 'enchantment', 'journal'),
  createdBy: playerIdArbitrary,
  pages: bookPagesArbitrary,
})

describe('furniture/operations', () => {
  it.effect('createBed produces default durability and empty occupant', () =>
    Effect.gen(function* () {
      const bed = yield* createBed({
        color: 'red',
        orientation: 'north',
        coordinates: { x: 1, y: 64, z: 1 },
        requestedBy: 'player_abcd1234',
      })

      expect(bed.id).toMatch(/^furn_[a-z0-9]{12}$/)
      expect(bed.durability).toBe(100)
      expect(Option.isNone(bed.occupant)).toBe(true)
      expect(typeof bed.placedAt).toBe('number')
    })
  )

  it.effect('beginSleep succeeds for valid environment', () =>
    Effect.gen(function* () {
      const bed = yield* createBed({
        color: 'blue',
        orientation: 'south',
        coordinates: { x: 0, y: 70, z: 0 },
        requestedBy: 'player_abcd1234',
      })

      const currentTick = yield* Schema.decode(TickSchema)(250)

      const updated = yield* beginSleep({
        bed,
        playerId: 'player_abcd1234',
        environment: {
          lightLevel: 5,
          noiseLevel: 10,
          monstersNearby: false,
          isNightTime: true,
          weather: 'clear',
        },
        currentTick,
      })

      expect(Option.isSome(updated.occupant)).toBe(true)
      expect(updated.lastSleptAt).toStrictEqual(Option.some(currentTick))
    })
  )

  it.effect('beginSleep fails when monsters are nearby', () =>
    Effect.gen(function* () {
      const bed = yield* createBed({
        color: 'green',
        orientation: 'west',
        coordinates: { x: -2, y: 66, z: 4 },
        requestedBy: 'player_abcd1234',
      })

      const currentTick = yield* Schema.decode(TickSchema)(200)

      const error = yield* beginSleep({
        bed,
        playerId: 'player_abcd1234',
        environment: {
          lightLevel: 5,
          noiseLevel: 10,
          monstersNearby: true,
          isNightTime: true,
          weather: 'clear',
        },
        currentTick,
      }).pipe(Effect.flip)

      expect(error).toStrictEqual(FurnitureError.invalidEnvironment(bed.id))
    })
  )

  it.effect('finishSleep clears occupant', () =>
    Effect.gen(function* () {
      const bed = yield* createBed({
        color: 'purple',
        orientation: 'east',
        coordinates: { x: 3, y: 65, z: 3 },
        requestedBy: 'player_abcd1234',
      })

      const currentTick = yield* Schema.decode(TickSchema)(120)
      const sleeping = yield* beginSleep({
        bed,
        playerId: 'player_abcd1234',
        environment: {
          lightLevel: 5,
          noiseLevel: 10,
          monstersNearby: false,
          isNightTime: true,
          weather: 'clear',
        },
        currentTick,
      })
      const rested = yield* finishSleep(sleeping)

      expect(Option.isNone(rested.occupant)).toBe(true)
    })
  )

  it.effect('appendPage rejects published book', () =>
    Effect.gen(function* () {
      const book = yield* createBook({
        title: 'Guide',
        category: 'journal',
        createdBy: 'player_abcd1234',
        pages: [{ index: 0, content: 'Start' }],
      })

      const published = yield* publishBook(book, 10)

      const error = yield* appendPage({
        book: published,
        author: 'player_abcd1234',
        page: { index: 1, content: 'More' },
      }).pipe(Effect.flip)

      expect(error).toStrictEqual(FurnitureError.alreadyPublished(book.id))
    })
  )

  it.effect('updateSignText enforces editor ownership', () =>
    Effect.gen(function* () {
      const sign = yield* createSign({
        style: 'oak',
        text: { lines: ['Hello'], alignment: 'left' },
        placedBy: 'player_owner01',
        location: { x: 5, y: 70, z: 5 },
      } satisfies CreateSignInput)

      const tick = yield* Schema.decode(TickSchema)(400)

      const error = yield* updateSignText({
        sign,
        editor: 'player_other02',
        text: { lines: ['Intruder'], alignment: 'center' },
        currentTick: tick,
      }).pipe(Effect.flip)

      expect(error).toStrictEqual(FurnitureError.permissionDenied(sign.id, 'editor mismatch'))
    })
  )

  it('createBed property: durability is within bounds and occupant absent', async () => {
    await fc.assert(
      effectProperty(createBedInputArbitrary, (input) =>
        Effect.gen(function* () {
          const bed = yield* createBed(input)
          expect(bed.durability).toBeGreaterThanOrEqual(0)
          expect(bed.durability).toBeLessThanOrEqual(100)
          expect(Option.isNone(bed.occupant)).toBe(true)
          expect(bed.id).toMatch(/^furn_[a-z0-9]{12}$/)
        })
      ),
      { numRuns: 100 }
    )
  })

  it('appendPage property: page count increases and command index is respected', async () => {
    await fc.assert(
      effectProperty(
        fc.record({
          input: createBookInputArbitrary,
          newPageContent: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        ({ input, newPageContent }) =>
          Effect.gen(function* () {
            const book = yield* createBook(input)
            const command: AppendPageCommand = {
              book,
              author: input.createdBy,
              page: { index: book.pages.length, content: newPageContent },
            }
            const updated = yield* appendPage(command)

            expect(updated.pages.length).toBe(book.pages.length + 1)
            expect(pipe(updated.pages, ReadonlyArray.last)).toStrictEqual(Option.some(command.page))
            expect(pipe(updated.state.editedBy, ReadonlyArray.last)).toStrictEqual(Option.some(command.author))
          })
      ),
      { numRuns: 100 }
    )
  })
})
