import { Clock, Effect } from 'effect'
import * as Option from 'effect/Option'
import * as Schema from '@effect/schema/Schema'
import { pipe } from 'effect/Function'
import {
  AppendPageCommand,
  Bed,
  CreateBedInput,
  CreateBedInputSchema,
  CreateBookInput,
  CreateBookInputSchema,
  CreateSignInput,
  CreateSignInputSchema,
  DurabilitySchema,
  Furniture,
  FurnitureError,
  FurnitureIdSchema,
  PlayerId,
  Sign,
  SleepCommand,
  TickSchema,
  UpdateSignTextCommand,
  toValidationError,
} from './types.js'

const generateId: Effect.Effect<Schema.Schema.Type<typeof FurnitureIdSchema>, FurnitureError> = Effect.gen(
  function* () {
    const millis = yield* Clock.currentTimeMillis
    const suffix = (millis % 36 ** 12).toString(36).padStart(12, '0').slice(-12)
    const identifier = `furn_${suffix}`
    return yield* Schema.decode(FurnitureIdSchema)(identifier).pipe(
      Effect.mapError(toValidationError)
    )
  }
)

const currentTick: Effect.Effect<Schema.Schema.Type<typeof TickSchema>, FurnitureError> = pipe(
  Clock.currentTimeMillis,
  Effect.map((millis) => Math.floor(millis / 50)),
  Effect.flatMap((tick) => Schema.decode(TickSchema)(tick)),
  Effect.mapError(toValidationError)
)

const validateSleep = (command: SleepCommand) =>
  pipe(
    Effect.succeed(command.environment),
    Effect.filterOrFail(
      (env) => !env.monstersNearby,
      () => FurnitureError.invalidEnvironment(command.bed.id)
    ),
    Effect.filterOrFail(
      (env) => env.isNightTime,
      () => FurnitureError.invalidEnvironment(command.bed.id)
    ),
    Effect.filterOrFail(
      (env) => env.noiseLevel <= 60,
      () => FurnitureError.invalidEnvironment(command.bed.id)
    ),
    Effect.filterOrFail(
      (env) => env.lightLevel <= 10,
      () => FurnitureError.invalidEnvironment(command.bed.id)
    )
  )

const ensureBedIsUsable = (bed: Bed, playerId: PlayerId) =>
  pipe(
    Effect.succeed(bed),
    Effect.filterOrFail(
      (current) =>
        Option.match(current.occupant, {
          onNone: () => true,
          onSome: (occupant) => occupant === playerId,
        }),
      (current) =>
        FurnitureError.occupied(current.id, Option.getOrElse(current.occupant, () => playerId))
    ),
    Effect.filterOrFail(
      (current) => current.durability > 0,
      (current) => FurnitureError.broken(current.id)
    )
  )

const decreaseDurability = (bed: Bed) =>
  pipe(
    bed.durability,
    (current) => Math.max(0, current - 1),
    (value) => Schema.decode(DurabilitySchema)(value),
    Effect.mapError(toValidationError),
    Effect.map((durability) => ({ ...bed, durability }))
  )

export const createBed = (input: CreateBedInput) =>
  Effect.gen(function* () {
    const validated = yield* Schema.decode(CreateBedInputSchema)(input).pipe(
      Effect.mapError(toValidationError)
    )
    const id = yield* generateId
    const placedAt = yield* currentTick
    const durability = validated.durability ?? (yield* Schema.decode(DurabilitySchema)(100).pipe(Effect.mapError(toValidationError)))

    return {
      _tag: 'Bed',
      id,
      color: validated.color,
      orientation: validated.orientation,
      coordinates: validated.coordinates,
      durability,
      occupant: Option.none(),
      placedAt,
      lastSleptAt: Option.none(),
    } satisfies Bed
  })

export const beginSleep = (command: SleepCommand) =>
  Effect.gen(function* () {
    yield* ensureBedIsUsable(command.bed, command.playerId)
    yield* validateSleep(command)

    const durabilityAdjusted = yield* decreaseDurability(command.bed)

    const updated = {
      ...durabilityAdjusted,
      occupant: Option.some(command.playerId),
      lastSleptAt: Option.some(command.currentTick),
    }

    return updated
  })

export const finishSleep = (bed: Bed) =>
  Effect.succeed({ ...bed, occupant: Option.none() })

export const createBook = (input: CreateBookInput) =>
  Effect.gen(function* () {
    const validated = yield* Schema.decode(CreateBookInputSchema)(input).pipe(
      Effect.mapError(toValidationError)
    )
    const id = yield* generateId

    return {
      _tag: 'Book',
      id,
      title: validated.title,
      category: validated.category,
      createdBy: validated.createdBy,
      pages: validated.pages,
      state: { _tag: 'Draft', editedBy: [validated.createdBy] },
    } satisfies Extract<Furniture, { _tag: 'Book' }>
  })

export const appendPage = (command: AppendPageCommand) =>
  Effect.gen(function* () {
    if (command.book.state._tag === 'Published') {
      return yield* Effect.fail(FurnitureError.alreadyPublished(command.book.id))
    }

    const nextIndex = command.book.pages.length
    if (command.page.index !== nextIndex) {
      return yield* Effect.fail(FurnitureError.validation([`page index must be ${nextIndex}`]))
    }

    const pages = [...command.book.pages, command.page]
    const state = command.book.state._tag === 'Draft'
      ? { _tag: 'Draft', editedBy: [...command.book.state.editedBy, command.author] }
      : { _tag: 'Draft', editedBy: [command.author] }

    return {
      ...command.book,
      pages,
      state,
    }
  })

export const publishBook = (book: Extract<Furniture, { _tag: 'Book' }>, tick: number) =>
  Effect.gen(function* () {
    const publishedAt = yield* decode(TickSchema)(tick)

    return {
      ...book,
      state: { _tag: 'Published', signedBy: book.createdBy, publishedAt },
    }
  })

export const createSign = (input: CreateSignInput) =>
  Effect.gen(function* () {
    const validated = yield* Schema.decode(CreateSignInputSchema)(input).pipe(
      Effect.mapError(toValidationError)
    )
    const id = yield* generateId
    const placedAt = yield* currentTick

    return {
      _tag: 'Sign',
      id,
      style: validated.style,
      text: validated.text,
      placedBy: validated.placedBy,
      placedAt,
      location: validated.location,
      glowing: validated.glowing ?? false,
    } satisfies Sign
  })

export const updateSignText = (command: UpdateSignTextCommand) =>
  Effect.gen(function* () {
    const authorizedSign = yield* pipe(
      Effect.succeed(command.sign),
      Effect.filterOrFail(
        (sign) => sign.placedBy === command.editor,
        () => FurnitureError.permissionDenied(command.sign.id, 'editor mismatch')
      )
    )

    return {
      ...authorizedSign,
      text: command.text,
      placedAt: command.currentTick,
    }
  })
