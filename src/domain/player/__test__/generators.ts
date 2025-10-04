import { Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  PlayerAggregateSchema,
  PlayerCommandSchema,
  PlayerCreationInputSchema,
  PlayerGameModeSchema,
  PlayerIdSchema,
  PlayerLifecycleStateSchema,
  PlayerMotionSchema,
  PlayerPositionSchema,
  PlayerSnapshotSchema,
  PlayerUpdateContextSchema,
  PlayerVitalsSchema,
} from '../types'

const decode = <A>(schema: Schema.Schema<unknown, A>) => (value: unknown): A =>
  Schema.decodeUnknownSync(schema)(value)

const idCharacters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '_', '-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export const playerIdArb = fc
  .stringOf(fc.constantFrom(...idCharacters), { minLength: 3, maxLength: 16 })
  .map(decode(PlayerIdSchema))

const trimmedString = (minLength: number, maxLength: number) =>
  fc.string({ minLength, maxLength, noDefaultInfinity: true, noNaN: true }).map((value) => value.trim())

export const playerNameArb = trimmedString(1, 32)

export const timestampArb = fc
  .integer({ min: 0, max: 2 ** 31 })
  .map((timestamp) => Schema.decodeUnknownSync(PlayerUpdateContextSchema)({ timestamp }).timestamp)

const coordinateArb = fc.float({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true })

export const positionArb = fc
  .record({
    x: coordinateArb,
    y: fc.float({ min: -64, max: 320, noNaN: true, noDefaultInfinity: true }),
    z: coordinateArb,
    worldId: trimmedString(1, 32),
    yaw: fc.float({ min: -180, max: 180, noNaN: true }),
    pitch: fc.float({ min: -90, max: 90, noNaN: true }),
  })
  .map(decode(PlayerPositionSchema))

export const motionArb = fc
  .record({
    velocityX: fc.float({ min: -20, max: 20, noNaN: true }),
    velocityY: fc.float({ min: -20, max: 20, noNaN: true }),
    velocityZ: fc.float({ min: -20, max: 20, noNaN: true }),
    isOnGround: fc.boolean(),
  })
  .map(decode(PlayerMotionSchema))

export const vitalsArb = fc
  .record({
    health: fc.float({ min: 0, max: 20, noNaN: true }),
    hunger: fc.float({ min: 0, max: 20, noNaN: true }),
    saturation: fc.float({ min: 0, max: 20, noNaN: true }),
    experienceLevel: fc.integer({ min: 0, max: 128 }),
  })
  .map((record) => ({
    ...record,
    health: Math.min(20, Math.max(0, record.health)),
    hunger: Math.min(20, Math.max(0, record.hunger)),
    saturation: Math.min(20, Math.max(0, record.saturation)),
  }))
  .map(decode(PlayerVitalsSchema))

const gameModeBase = ['survival', 'creative', 'adventure', 'spectator'] as const

export const gameModeArb = fc
  .constantFrom(...gameModeBase)
  .map(decode(PlayerGameModeSchema))

const lifecycleBase = ['loading', 'alive', 'dead', 'respawning', 'teleporting', 'disconnected'] as const

export const lifecycleArb = fc
  .constantFrom(...lifecycleBase)
  .map(decode(PlayerLifecycleStateSchema))

export const aggregateArb = fc
  .tuple(playerIdArb, playerNameArb, positionArb, motionArb, vitalsArb, lifecycleArb, gameModeArb)
  .chain(([id, name, position, motion, vitals, state, gameMode]) =>
    fc
      .integer({ min: 0, max: 2 ** 31 })
      .chain((createdAt) =>
        fc
          .integer({ min: createdAt, max: createdAt + 10_000 })
          .map((updatedAt) =>
            Schema.decodeUnknownSync(PlayerAggregateSchema)({
              id,
              name,
              position,
              motion,
              vitals,
              state,
              gameMode,
              createdAt,
              updatedAt,
            })
          )
      )
  )

export const creationInputArb = fc
  .tuple(playerIdArb, playerNameArb, positionArb, gameModeArb)
  .chain(([id, name, position, gameMode]) =>
    fc.integer({ min: 0, max: 2 ** 31 }).map((timestamp) =>
      Schema.decodeUnknownSync(PlayerCreationInputSchema)({ id, name, position, gameMode, timestamp })
    )
  )

export const commandArb = fc.oneof(
  creationInputArb.map((input) =>
    Schema.decodeUnknownSync(PlayerCommandSchema)({
      _tag: 'CreatePlayer',
      id: input.id,
      name: input.name,
      gameMode: input.gameMode,
      timestamp: input.timestamp,
    })
  ),
  aggregateArb.map((aggregate) =>
    Schema.decodeUnknownSync(PlayerCommandSchema)({
      _tag: 'UpdateVitals',
      id: aggregate.id,
      health: aggregate.vitals.health,
      hunger: aggregate.vitals.hunger,
      saturation: aggregate.vitals.saturation,
      experienceLevel: aggregate.vitals.experienceLevel,
      timestamp: aggregate.updatedAt + 1,
    })
  ),
  aggregateArb.map((aggregate) =>
    Schema.decodeUnknownSync(PlayerCommandSchema)({
      _tag: 'UpdatePosition',
      id: aggregate.id,
      position: aggregate.position,
      motion: aggregate.motion,
      timestamp: aggregate.updatedAt + 1,
    })
  )
)

export const snapshotArb = aggregateArb
  .chain((aggregate) =>
    fc.integer({ min: aggregate.updatedAt, max: aggregate.updatedAt + 5000 }).map((capturedAt) =>
      Schema.decodeUnknownSync(PlayerSnapshotSchema)({ aggregate, capturedAt })
    )
  )

export const updateContextArb = fc
  .integer({ min: 0, max: 2 ** 31 })
  .map((timestamp) => Schema.decodeUnknownSync(PlayerUpdateContextSchema)({ timestamp }))
