import * as Schema from '@effect/schema/Schema'
import { Clock, Effect, Match } from 'effect'
import type { FurnitureRepository } from './index'
import {
  appendPage,
  Bed,
  beginSleep,
  Book,
  BookPage,
  createBed,
  CreateBedInput,
  createBook,
  CreateBookInput,
  createFurnitureRepository,
  createSign,
  CreateSignInput,
  finishSleep,
  FurnitureError,
  FurnitureId,
  PlayerId,
  publishBook,
  Sign,
  SignTextSchema,
  SleepEnvironment,
  TickSchema,
  toValidationError,
  updateSignText,
} from './index'

export interface SleepRequest {
  readonly bedId: FurnitureId
  readonly playerId: PlayerId
  readonly environment: SleepEnvironment
}

export interface AppendPageRequest {
  readonly bookId: FurnitureId
  readonly author: PlayerId
  readonly page: BookPage
}

export interface PublishRequest {
  readonly bookId: FurnitureId
}

export interface SignUpdateRequest {
  readonly signId: FurnitureId
  readonly editor: PlayerId
  readonly text: Schema.Schema.Type<typeof SignTextSchema>
}

export interface FurnitureApplicationService {
  readonly placeBed: (input: CreateBedInput) => Effect.Effect<Bed, FurnitureError>
  readonly startSleep: (request: SleepRequest) => Effect.Effect<Bed, FurnitureError>
  readonly finishSleep: (bedId: FurnitureId) => Effect.Effect<Bed, FurnitureError>
  readonly registerBook: (input: CreateBookInput) => Effect.Effect<Book, FurnitureError>
  readonly appendBookPage: (request: AppendPageRequest) => Effect.Effect<Book, FurnitureError>
  readonly publishBook: (request: PublishRequest) => Effect.Effect<Book, FurnitureError>
  readonly registerSign: (input: CreateSignInput) => Effect.Effect<Sign, FurnitureError>
  readonly editSign: (request: SignUpdateRequest) => Effect.Effect<Sign, FurnitureError>
}

const toTickEffect = Effect.gen(function* () {
  const millis = yield* Clock.currentTimeMillis
  return yield* Schema.decodeUnknown(TickSchema)(Math.floor(millis / 50)).pipe(Effect.mapError(toValidationError))
})

const expectBed = (entity: unknown, id: FurnitureId) =>
  Match.value(entity).pipe(
    Match.when({ _tag: 'Bed' }, (bed: Bed) => Effect.succeed(bed)),
    Match.orElse(() => Effect.fail(FurnitureError.validation([`Furniture ${id} is not a bed`])))
  )

const expectBook = (entity: unknown, id: FurnitureId) =>
  Match.value(entity).pipe(
    Match.when({ _tag: 'Book' }, (book: Book) => Effect.succeed(book)),
    Match.orElse(() => Effect.fail(FurnitureError.validation([`Furniture ${id} is not a book`])))
  )

const expectSign = (entity: unknown, id: FurnitureId) =>
  Match.value(entity).pipe(
    Match.when({ _tag: 'Sign' }, (sign: Sign) => Effect.succeed(sign)),
    Match.orElse(() => Effect.fail(FurnitureError.validation([`Furniture ${id} is not a sign`])))
  )

export const makeFurnitureApplicationService = (repository: FurnitureRepository): FurnitureApplicationService => {
  const placeBed: FurnitureApplicationService['placeBed'] = (input) =>
    Effect.gen(function* () {
      const bed = yield* createBed(input)
      yield* repository.save(bed)
      return bed
    })

  const startSleep: FurnitureApplicationService['startSleep'] = (request) =>
    Effect.gen(function* () {
      const furniture = yield* repository.findById(request.bedId)
      const bed = yield* expectBed(furniture, request.bedId)
      const currentTick = yield* toTickEffect
      const updated = yield* beginSleep({
        bed,
        playerId: request.playerId,
        environment: request.environment,
        currentTick,
      })
      yield* repository.save(updated)
      return updated
    })

  const releaseSleep: FurnitureApplicationService['finishSleep'] = (bedId) =>
    Effect.gen(function* () {
      const furniture = yield* repository.findById(bedId)
      const bed = yield* expectBed(furniture, bedId)
      const updated = yield* finishSleep(bed)
      yield* repository.save(updated)
      return updated
    })

  const registerBook: FurnitureApplicationService['registerBook'] = (input) =>
    Effect.gen(function* () {
      const book = yield* createBook(input)
      yield* repository.save(book)
      return book
    })

  const appendBook: FurnitureApplicationService['appendBookPage'] = (request) =>
    Effect.gen(function* () {
      const furniture = yield* repository.findById(request.bookId)
      const book = yield* expectBook(furniture, request.bookId)
      const updated = yield* appendPage({ book, author: request.author, page: request.page })
      yield* repository.save(updated)
      return updated
    })

  const publish: FurnitureApplicationService['publishBook'] = (request) =>
    Effect.gen(function* () {
      const furniture = yield* repository.findById(request.bookId)
      const book = yield* expectBook(furniture, request.bookId)
      const tick = yield* toTickEffect
      const published = yield* publishBook(book, tick)
      yield* repository.save(published)
      return published
    })

  const registerSign: FurnitureApplicationService['registerSign'] = (input) =>
    Effect.gen(function* () {
      const sign = yield* createSign(input)
      yield* repository.save(sign)
      return sign
    })

  const editSign: FurnitureApplicationService['editSign'] = (request) =>
    Effect.gen(function* () {
      const furniture = yield* repository.findById(request.signId)
      const sign = yield* expectSign(furniture, request.signId)
      const tick = yield* toTickEffect
      const updated = yield* updateSignText({ sign, editor: request.editor, text: request.text, currentTick: tick })
      yield* repository.save(updated)
      return updated
    })

  return {
    placeBed,
    startSleep,
    finishSleep: releaseSleep,
    registerBook,
    appendBookPage: appendBook,
    publishBook: publish,
    registerSign,
    editSign,
  }
}

export const createFurnitureApplicationService: Effect.Effect<FurnitureApplicationService> = Effect.flatMap(
  createFurnitureRepository,
  (repository) => Effect.succeed(makeFurnitureApplicationService(repository))
)
