import {
  Effect,
  Context,
  Layer,
  Ref,
  Queue,
  FiberRef,
  Match,
  Option,
  Either,
  Scope,
  HashMap,
  HashSet,
  Chunk,
  Stream,
  Schedule,
  Cause,
  Exit,
  pipe,
} from 'effect'
import { Schema } from '@effect/schema'
import * as Types from './PlayerTypes'
import { EntityManager } from '../../infrastructure/ecs/EntityManager'

// =========================================
// Service Interfaces (Context.Tag Pattern)
// =========================================

export interface PlayerRepository {
  readonly save: (player: Types.Player) => Effect.Effect<void, Types.PlayerError>
  readonly load: (playerId: Types.PlayerId) => Effect.Effect<Types.Player, Types.PlayerError>
  readonly delete: (playerId: Types.PlayerId) => Effect.Effect<void, Types.PlayerError>
  readonly exists: (playerId: Types.PlayerId) => Effect.Effect<boolean>
  readonly findAll: () => Effect.Effect<ReadonlyArray<Types.Player>>
  readonly findByName: (name: string) => Effect.Effect<Option.Option<Types.Player>, Types.PlayerError>
}

export const PlayerRepository = Context.GenericTag<PlayerRepository>('@minecraft/domain/PlayerRepository')

export interface PlayerStateManager {
  readonly create: (config: {
    readonly playerId: string
    readonly name: string
    readonly position?: Types.Vector3D
    readonly gameMode?: Types.GameMode
  }) => Effect.Effect<Types.Player, Types.PlayerError>

  readonly update: (
    playerId: Types.PlayerId,
    updater: (player: Types.Player) => Types.Player
  ) => Effect.Effect<Types.Player, Types.PlayerError>

  readonly get: (playerId: Types.PlayerId) => Effect.Effect<Types.Player, Types.PlayerError>
  readonly getAll: () => Effect.Effect<ReadonlyArray<Types.Player>>
  readonly delete: (playerId: Types.PlayerId) => Effect.Effect<void, Types.PlayerError>
}

export const PlayerStateManager = Context.GenericTag<PlayerStateManager>('@minecraft/domain/PlayerStateManager')

export interface PlayerMovementSystem {
  readonly move: (
    player: Types.Player,
    direction: Types.PlayerAction & { _tag: 'Move' }
  ) => Effect.Effect<Types.Player, Types.PlayerError>

  readonly jump: (player: Types.Player) => Effect.Effect<Types.Player, Types.PlayerError>

  readonly updatePhysics: (player: Types.Player, deltaTime: number) => Effect.Effect<Types.Player, Types.PlayerError>

  readonly applyVelocity: (
    player: Types.Player,
    velocity: Types.Velocity
  ) => Effect.Effect<Types.Player, Types.PlayerError>
}

export const PlayerMovementSystem = Context.GenericTag<PlayerMovementSystem>('@minecraft/domain/PlayerMovementSystem')

export interface PlayerActionProcessor {
  readonly process: (player: Types.Player, action: Types.PlayerAction) => Effect.Effect<Types.Player, Types.PlayerError>

  readonly validate: (player: Types.Player, action: Types.PlayerAction) => Effect.Effect<boolean>
}

export const PlayerActionProcessor = Context.GenericTag<PlayerActionProcessor>(
  '@minecraft/domain/PlayerActionProcessor'
)

export interface PlayerEventBus {
  readonly publish: (event: Types.PlayerEvent) => Effect.Effect<void>
  readonly subscribe: () => Stream.Stream<Types.PlayerEvent>
  readonly subscribeFiltered: (predicate: (event: Types.PlayerEvent) => boolean) => Stream.Stream<Types.PlayerEvent>
}

export const PlayerEventBus = Context.GenericTag<PlayerEventBus>('@minecraft/domain/PlayerEventBus')

// =========================================
// Repository Implementation
// =========================================

const makePlayerRepository = (): Effect.Effect<PlayerRepository> =>
  Effect.gen(function* () {
    const playersRef = yield* Ref.make(HashMap.empty<Types.PlayerId, Types.Player>())

    const save = (player: Types.Player): Effect.Effect<void, Types.PlayerError> =>
      Ref.update(playersRef, (players) => HashMap.set(players, player.id, player)).pipe(
        Effect.mapError(
          () =>
            ({
              _tag: 'PlayerError' as const,
              reason: 'ValidationFailed' as const,
              playerId: player.id,
              message: 'Failed to save player',
            }) satisfies Types.PlayerError
        )
      )

    const load = (playerId: Types.PlayerId): Effect.Effect<Types.Player, Types.PlayerError> =>
      Effect.gen(function* () {
        const players = yield* Ref.get(playersRef)
        const player = HashMap.get(players, playerId)
        return yield* pipe(
          player,
          Option.match({
            onNone: () =>
              Effect.fail({
                _tag: 'PlayerError' as const,
                reason: 'PlayerNotFound' as const,
                playerId,
                message: `Player ${playerId} not found`,
              } satisfies Types.PlayerError),
            onSome: Effect.succeed,
          })
        )
      })

    const deletePlayer = (playerId: Types.PlayerId): Effect.Effect<void, Types.PlayerError> =>
      Effect.gen(function* () {
        const players = yield* Ref.get(playersRef)
        const exists = HashMap.has(players, playerId)
        if (!exists) {
          return yield* Effect.fail({
            _tag: 'PlayerError' as const,
            reason: 'PlayerNotFound' as const,
            playerId,
            message: `Player ${playerId} not found`,
          } satisfies Types.PlayerError)
        }
        yield* Ref.update(playersRef, (players) => HashMap.remove(players, playerId))
      })

    const exists = (playerId: Types.PlayerId): Effect.Effect<boolean> =>
      Ref.get(playersRef).pipe(Effect.map((players) => HashMap.has(players, playerId)))

    const findAll = (): Effect.Effect<ReadonlyArray<Types.Player>> =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => Chunk.toReadonlyArray(Chunk.fromIterable(HashMap.values(players))))
      )

    const findByName = (name: string): Effect.Effect<Option.Option<Types.Player>, Types.PlayerError> =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => {
          const playersArray = Array.from(HashMap.values(players))
          const foundPlayer = playersArray.find((p) => p.name === name)
          return Option.fromNullable(foundPlayer)
        })
      )

    const repository: PlayerRepository = {
      save,
      load,
      delete: deletePlayer,
      exists,
      findAll,
      findByName,
    } satisfies PlayerRepository

    return repository
  })

// =========================================
// State Manager Implementation
// =========================================

const makePlayerStateManager = (): Effect.Effect<
  PlayerStateManager,
  never,
  Scope.Scope | PlayerRepository | PlayerEventBus | EntityManager
> =>
  Effect.gen(function* () {
    const repository = yield* PlayerRepository
    const eventBus = yield* PlayerEventBus
    const entityManager = yield* EntityManager

    const currentPlayerRef = yield* FiberRef.make<Option.Option<Types.PlayerId>>(Option.none())

    const create = (config: {
      readonly playerId: string
      readonly name: string
      readonly position?: Types.Vector3D
      readonly gameMode?: Types.GameMode
    }): Effect.Effect<Types.Player, Types.PlayerError> =>
      Effect.gen(function* () {
        // Validation
        const playerId = Types.makePlayerId(config.playerId)

        // Check existence
        const alreadyExists = yield* repository.exists(playerId)
        if (alreadyExists) {
          return yield* Effect.fail({
            _tag: 'PlayerError' as const,
            reason: 'PlayerAlreadyExists' as const,
            playerId,
            message: `Player ${playerId} already exists`,
          } satisfies Types.PlayerError)
        }

        // Create entity - map errors to PlayerError
        const entityId = yield* pipe(
          entityManager.createEntity(`Player-${playerId}`, ['player', 'entity']),
          Effect.mapError(
            (error): Types.PlayerError => ({
              _tag: 'PlayerError',
              reason: 'ValidationFailed',
              playerId,
              message: `Failed to create entity: ${error._tag === 'EntityPoolError' || error._tag === 'EntityManagerError' ? error.message : String(error)}`,
              context: { originalError: error },
            })
          )
        )

        // Create player
        const player: Types.Player = {
          id: playerId,
          entityId: entityId,
          name: config.name,
          position: config.position ?? { x: 0, y: 64, z: 0 },
          rotation: { pitch: 0, yaw: 0, roll: 0 },
          velocity: { x: 0, y: 0, z: 0 } as Types.Velocity,
          stats: Types.defaultPlayerStats,
          gameMode: config.gameMode ?? 'survival',
          abilities: getAbilitiesForGameMode(config.gameMode ?? 'survival'),
          inventory: Types.defaultInventory,
          equipment: Types.defaultEquipment,
          isOnGround: false,
          isSneaking: false,
          isSprinting: false,
          lastUpdate: Date.now(),
          createdAt: Date.now(),
        }

        // Save
        yield* repository.save(player)

        // Publish event
        yield* eventBus.publish({
          _tag: 'PlayerCreated',
          playerId,
          name: config.name,
          position: player.position,
          gameMode: player.gameMode,
          timestamp: Date.now(),
        })

        return player
      })

    const update = (
      playerId: Types.PlayerId,
      updater: (player: Types.Player) => Types.Player
    ): Effect.Effect<Types.Player, Types.PlayerError> =>
      Effect.gen(function* () {
        const player = yield* repository.load(playerId)
        const updated = updater(player)

        // Validate updated player using Schema decode
        const validated = yield* pipe(
          Schema.decodeUnknown(Types.Player)(updated),
          Effect.mapError(
            (parseError): Types.PlayerError => ({
              _tag: 'PlayerError',
              reason: 'ValidationFailed',
              playerId,
              message: `Invalid player data: ${String(parseError)}`,
              context: { originalError: parseError },
            })
          )
        )

        // Save
        yield* repository.save(validated)

        // Publish movement event if position changed
        if (player.position !== validated.position) {
          yield* eventBus.publish({
            _tag: 'PlayerMoved',
            playerId,
            from: player.position,
            to: validated.position,
            timestamp: Date.now(),
          })
        }

        return validated
      })

    const get = (playerId: Types.PlayerId): Effect.Effect<Types.Player, Types.PlayerError> => repository.load(playerId)
    const getAll = (): Effect.Effect<ReadonlyArray<Types.Player>> => repository.findAll()
    const deletePlayer = (playerId: Types.PlayerId): Effect.Effect<void, Types.PlayerError> =>
      repository.delete(playerId)

    const manager: PlayerStateManager = {
      create,
      update,
      get,
      getAll,
      delete: deletePlayer,
    } satisfies PlayerStateManager

    return manager
  })

// =========================================
// Movement System with Physics
// =========================================

const PHYSICS = {
  GRAVITY: -32,
  TERMINAL_VELOCITY: -60,
  AIR_RESISTANCE: 0.98,
  JUMP_VELOCITY: 8,
  WALK_SPEED: 4.317,
  SPRINT_SPEED: 5.612,
  SNEAK_SPEED: 1.295,
  FLY_SPEED: 10.92,
} as const

const makePlayerMovementSystem = (): Effect.Effect<PlayerMovementSystem> =>
  Effect.gen(function* () {
    const move = (
      player: Types.Player,
      action: Types.PlayerAction & { _tag: 'Move' }
    ): Effect.Effect<Types.Player, Types.PlayerError> =>
      Effect.gen(function* () {
        const { direction } = action

        // Calculate speed
        const speed = pipe(
          Match.value(player),
          Match.when(
            (p) => p.isSprinting && !p.isSneaking,
            () => PHYSICS.SPRINT_SPEED
          ),
          Match.when(
            (p) => p.isSneaking,
            () => PHYSICS.SNEAK_SPEED
          ),
          Match.when(
            (p) => p.abilities.isFlying,
            () => PHYSICS.FLY_SPEED
          ),
          Match.orElse(() => PHYSICS.WALK_SPEED)
        )

        // Calculate movement vector
        const yawRad = (player.rotation.yaw * Math.PI) / 180
        const moveX =
          (direction.forward ? -Math.sin(yawRad) : 0) +
          (direction.backward ? Math.sin(yawRad) : 0) +
          (direction.left ? -Math.cos(yawRad) : 0) +
          (direction.right ? Math.cos(yawRad) : 0)

        const moveZ =
          (direction.forward ? Math.cos(yawRad) : 0) +
          (direction.backward ? -Math.cos(yawRad) : 0) +
          (direction.left ? -Math.sin(yawRad) : 0) +
          (direction.right ? Math.sin(yawRad) : 0)

        // Normalize diagonal movement
        const magnitude = Math.sqrt(moveX * moveX + moveZ * moveZ)
        const normalizedX = magnitude > 0 ? (moveX / magnitude) * speed : 0
        const normalizedZ = magnitude > 0 ? (moveZ / magnitude) * speed : 0

        return {
          ...player,
          velocity: {
            x: normalizedX,
            y: player.velocity.y,
            z: normalizedZ,
          } as Types.Velocity,
          isSprinting: direction.sprint && !direction.sneak,
          isSneaking: direction.sneak,
        }
      })

    const jump = (player: Types.Player): Effect.Effect<Types.Player, Types.PlayerError> =>
      Effect.gen(function* () {
        if (!player.isOnGround && !player.abilities.canFly) {
          return player
        }

        return {
          ...player,
          velocity: {
            ...player.velocity,
            y: PHYSICS.JUMP_VELOCITY,
          } as Types.Velocity,
          isOnGround: false,
        }
      })

    const updatePhysics = (player: Types.Player, deltaTime: number): Effect.Effect<Types.Player, Types.PlayerError> =>
      Effect.gen(function* () {
        // Skip physics for creative/spectator
        if (player.gameMode === 'creative' || player.gameMode === 'spectator') {
          if (player.abilities.isFlying) {
            return player
          }
        }

        // Apply gravity
        const newVelocityY = Math.max(PHYSICS.TERMINAL_VELOCITY, player.velocity.y + PHYSICS.GRAVITY * deltaTime)

        // Apply air resistance
        const newVelocityX = player.velocity.x * Math.pow(PHYSICS.AIR_RESISTANCE, deltaTime)
        const newVelocityZ = player.velocity.z * Math.pow(PHYSICS.AIR_RESISTANCE, deltaTime)

        // Update position
        const newPosition: Types.Vector3D = {
          x: player.position.x + newVelocityX * deltaTime,
          y: player.position.y + newVelocityY * deltaTime,
          z: player.position.z + newVelocityZ * deltaTime,
        }

        // Ground detection (simplified)
        const isOnGround = newPosition.y <= 64 && newVelocityY <= 0

        return {
          ...player,
          position: isOnGround ? { ...newPosition, y: 64 } : newPosition,
          velocity: {
            x: newVelocityX,
            y: isOnGround ? 0 : newVelocityY,
            z: newVelocityZ,
          } as Types.Velocity,
          isOnGround,
        }
      })

    const applyVelocity = (
      player: Types.Player,
      velocity: Types.Velocity
    ): Effect.Effect<Types.Player, Types.PlayerError> =>
      Effect.succeed({
        ...player,
        velocity,
      })

    const movementSystem: PlayerMovementSystem = {
      move,
      jump,
      updatePhysics,
      applyVelocity,
    } satisfies PlayerMovementSystem

    return movementSystem
  })

// =========================================
// Action Processor with Pattern Matching
// =========================================

const makePlayerActionProcessor = (): Effect.Effect<
  PlayerActionProcessor,
  never,
  PlayerMovementSystem | PlayerStateManager
> =>
  Effect.gen(function* () {
    const movement = yield* PlayerMovementSystem
    const stateManager = yield* PlayerStateManager

    const process = (
      player: Types.Player,
      action: Types.PlayerAction
    ): Effect.Effect<Types.Player, Types.PlayerError> =>
      pipe(
        Match.value(action),
        Match.tag('Move', (act) => movement.move(player, act)),
        Match.tag('Jump', () => movement.jump(player)),
        Match.tag('Attack', () => Effect.succeed(player)),
        Match.tag('PlaceBlock', () => Effect.succeed(player)),
        Match.tag('BreakBlock', () => Effect.succeed(player)),
        Match.orElse(() => Effect.succeed(player))
      )

    const validate = (player: Types.Player, action: Types.PlayerAction): Effect.Effect<boolean> =>
      pipe(
        Match.value(action),
        Match.tag('Move', () => Effect.succeed(true)),
        Match.tag('Jump', () => Effect.succeed(player.isOnGround || player.abilities.canFly)),
        Match.tag('Attack', () => Effect.succeed(player.gameMode !== 'spectator')),
        Match.tag('PlaceBlock', () => Effect.succeed(player.abilities.canPlaceBlocks)),
        Match.tag('BreakBlock', () => Effect.succeed(player.abilities.canBreakBlocks)),
        Match.orElse(() => Effect.succeed(false))
      )

    const processor: PlayerActionProcessor = {
      process,
      validate,
    } satisfies PlayerActionProcessor

    return processor
  })

// =========================================
// Event Bus with Queue
// =========================================

const makePlayerEventBus = (): Effect.Effect<PlayerEventBus> =>
  Effect.gen(function* () {
    const queue = yield* Queue.unbounded<Types.PlayerEvent>()

    const publish = (event: Types.PlayerEvent): Effect.Effect<void> => Queue.offer(queue, event)

    const subscribe = (): Stream.Stream<Types.PlayerEvent> => Stream.fromQueue(queue)

    const subscribeFiltered = (predicate: (event: Types.PlayerEvent) => boolean): Stream.Stream<Types.PlayerEvent> =>
      Stream.fromQueue(queue).pipe(Stream.filter(predicate))

    const eventBus: PlayerEventBus = {
      publish,
      subscribe,
      subscribeFiltered,
    } satisfies PlayerEventBus

    return eventBus
  })

// =========================================
// Helper Functions
// =========================================

const getAbilitiesForGameMode = (gameMode: Types.GameMode): Types.PlayerAbilities =>
  pipe(
    Match.value(gameMode),
    Match.when('creative', () => ({
      ...Types.defaultPlayerAbilities,
      canFly: true,
      invulnerable: true,
    })),
    Match.when('spectator', () => ({
      ...Types.defaultPlayerAbilities,
      canFly: true,
      isFlying: true,
      canBreakBlocks: false,
      canPlaceBlocks: false,
      invulnerable: true,
    })),
    Match.when('adventure', () => ({
      ...Types.defaultPlayerAbilities,
      canBreakBlocks: false,
    })),
    Match.orElse(() => Types.defaultPlayerAbilities)
  )

// =========================================
// Layer Composition
// =========================================

export const PlayerRepositoryLive = Layer.effect(PlayerRepository, makePlayerRepository())

export const PlayerEventBusLive = Layer.effect(PlayerEventBus, makePlayerEventBus())

export const PlayerStateManagerLive = Layer.effect(PlayerStateManager, makePlayerStateManager()).pipe(
  Layer.provide(PlayerRepositoryLive),
  Layer.provide(PlayerEventBusLive)
)

export const PlayerMovementSystemLive = Layer.effect(PlayerMovementSystem, makePlayerMovementSystem())

export const PlayerActionProcessorLive = Layer.effect(PlayerActionProcessor, makePlayerActionProcessor()).pipe(
  Layer.provide(PlayerMovementSystemLive),
  Layer.provide(PlayerStateManagerLive)
)

export const PlayerSystemLive = Layer.mergeAll(
  PlayerRepositoryLive,
  PlayerEventBusLive,
  PlayerStateManagerLive,
  PlayerMovementSystemLive,
  PlayerActionProcessorLive
)
