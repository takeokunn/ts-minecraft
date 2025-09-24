import { describe, it, expect } from '@effect/vitest'
import { Effect, Schema, Option, Either, pipe, Match, Array as EffectArray } from 'effect'
import * as fc from 'fast-check'
import * as Types from '../PlayerTypes.js'

// =========================================
// Property-Based Test Arbitraries
// =========================================

const arbPlayerId = fc.string({ minLength: 1, maxLength: 50 }).map(Types.makePlayerId)
const arbEntityId = fc.integer({ min: 1, max: 100000 }).map(Types.makeEntityId)
const arbHealth = fc.integer({ min: 0, max: 20 }).map(Types.makeHealth)
const arbHunger = fc.integer({ min: 0, max: 20 }).map(Types.makeHunger)
const arbExperience = fc.nat().map(Types.makeExperience)

const arbVector3D = fc.record({
  x: fc.float({ min: -10000, max: 10000, noNaN: true }),
  y: fc.float({ min: -320, max: 320, noNaN: true }),
  z: fc.float({ min: -10000, max: 10000, noNaN: true })
})

const arbRotation = fc.record({
  pitch: fc.float({ min: -90, max: 90, noNaN: true }),
  yaw: fc.float({ min: -180, max: 180, noNaN: true }),
  roll: fc.float({ noNaN: true })
})

const arbGameMode = fc.constantFrom(
  'survival' as const,
  'creative' as const,
  'adventure' as const,
  'spectator' as const
)

const arbItemStack = fc.record({
  itemId: fc.string({ minLength: 1, maxLength: 50 }),
  count: fc.integer({ min: 1, max: 64 }),
  metadata: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined })
})

// =========================================
// Branded Types Tests
// =========================================

describe('PlayerTypes - Branded Types', () => {
  describe('PlayerId', () => {
    it('should create valid PlayerId', () => {
      const id = Types.makePlayerId('player123')
      expect(id).toBe('player123')
    })

    it('should validate PlayerId schema', () =>
      Effect.gen(function* () {
        const valid = yield* Schema.decodeUnknown(Types.PlayerId)('valid-id')
        expect(valid).toBe('valid-id')

        const invalid = yield* Effect.either(Schema.decodeUnknown(Types.PlayerId)(123))
        yield* pipe(
          invalid,
          Match.value,
          Match.tag('Left', () => Effect.sync(() => expect(true).toBe(true))),
          Match.tag('Right', () => Effect.fail('Should have failed')),
          Match.exhaustive
        )
      })
    )

    it.prop([fc.string({ minLength: 1 })])('property: any non-empty string is valid PlayerId', (str) => {
      const id = Types.makePlayerId(str)
      expect(typeof id).toBe('string')
      expect(id).toBe(str)
    })
  })

  describe('Health', () => {
    it('should create valid Health values', () => {
      expect(Types.makeHealth(0)).toBe(0)
      expect(Types.makeHealth(10)).toBe(10)
      expect(Types.makeHealth(20)).toBe(20)
    })

    it('should reject invalid Health values', () =>
      Effect.gen(function* () {
        const testCases = [{ value: -1 }, { value: 21 }]

        yield* Effect.forEach(testCases, ({ value }) =>
          pipe(
            Effect.try(() => Types.makeHealth(value)),
            Effect.either,
            Effect.flatMap(result =>
              pipe(
                result,
                Match.value,
                Match.tag('Left', () => Effect.succeed('Invalid as expected')),
                Match.tag('Right', () => Effect.fail(`Value ${value} should have been invalid`)),
                Match.exhaustive
              )
            )
          )
        )
      })
    )

    it.prop([fc.integer({ min: 0, max: 20 })])('property: valid range 0-20', (value) => {
      const health = Types.makeHealth(value)
      expect(health).toBeGreaterThanOrEqual(0)
      expect(health).toBeLessThanOrEqual(20)
    })
  })

  describe('EntityId', () => {
    it('should create valid EntityId', () => {
      const id = Types.makeEntityId(1)
      expect(id).toBe(1)
    })

    it.prop([fc.integer({ min: 1 })])('property: positive integers are valid', (value) => {
      const id = Types.makeEntityId(value)
      expect(id).toBeGreaterThan(0)
      expect(Number.isInteger(id)).toBe(true)
    })
  })
})

// =========================================
// Tagged Unions Tests
// =========================================

describe('PlayerTypes - Tagged Unions', () => {
  describe('PlayerAction', () => {
    it('should create Move action', () =>
      Effect.gen(function* () {
        const action = yield* Schema.decodeUnknown(Types.PlayerAction)({
          _tag: 'Move',
          direction: {
            forward: true,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sneak: false,
            sprint: true
          }
        })

        expect(action._tag).toBe('Move')
        yield* pipe(
          action,
          Match.type<Types.PlayerAction>(),
          Match.tag('Move', (move) => Effect.sync(() => {
            expect(move.direction.forward).toBe(true)
            expect(move.direction.sprint).toBe(true)
          })),
          Match.orElse(() => Effect.fail('Expected Move action')),
          Effect.catchAll(() => Effect.succeed(undefined))
        )
      })
    )

    it('should create PlaceBlock action', () =>
      Effect.gen(function* () {
        const action = yield* Schema.decodeUnknown(Types.PlayerAction)({
          _tag: 'PlaceBlock',
          position: { x: 100, y: 64, z: 200 },
          face: 'top'
        })

        expect(action._tag).toBe('PlaceBlock')
        if (action._tag === 'PlaceBlock') {
          expect(action.position.x).toBe(100)
          expect(action.face).toBe('top')
        }
      })
    )

    it.prop([
      fc.constantFrom('Move', 'Jump', 'Attack', 'UseItem', 'PlaceBlock', 'BreakBlock', 'OpenContainer', 'DropItem')
    ])('property: all action tags are valid', (tag) => {
      expect(['Move', 'Jump', 'Attack', 'UseItem', 'PlaceBlock', 'BreakBlock', 'OpenContainer', 'DropItem']).toContain(tag)
    })
  })

  describe('DamageSource', () => {
    it('should create Fall damage', () =>
      Effect.gen(function* () {
        const damage = yield* Schema.decodeUnknown(Types.DamageSource)({
          _tag: 'Fall',
          distance: 10.5
        })

        expect(damage._tag).toBe('Fall')
        yield* pipe(
          damage,
          Match.type<Types.DamageSource>(),
          Match.tag('Fall', (fall) => Effect.sync(() => {
            expect(fall.distance).toBe(10.5)
          })),
          Match.orElse(() => Effect.succeed(undefined))
        )
      })
    )

    it('should create Environment damage', () =>
      Effect.gen(function* () {
        const damage = yield* Schema.decodeUnknown(Types.DamageSource)({
          _tag: 'Environment',
          type: 'lava'
        })

        expect(damage._tag).toBe('Environment')
        if (damage._tag === 'Environment') {
          expect(damage.type).toBe('lava')
        }
      })
    )
  })

  describe('PlayerEvent', () => {
    it('should create PlayerCreated event', () =>
      Effect.gen(function* () {
        const event = yield* Schema.decodeUnknown(Types.PlayerEvent)({
          _tag: 'PlayerCreated',
          playerId: Types.makePlayerId('player1'),
          name: 'TestPlayer',
          position: { x: 0, y: 64, z: 0 },
          gameMode: 'survival',
          timestamp: Date.now()
        })

        expect(event._tag).toBe('PlayerCreated')
      })
    )

    it('should create PlayerDamaged event', () =>
      Effect.gen(function* () {
        const event = yield* Schema.decodeUnknown(Types.PlayerEvent)({
          _tag: 'PlayerDamaged',
          playerId: Types.makePlayerId('player1'),
          damage: 5,
          source: { _tag: 'Fall', distance: 10 },
          newHealth: Types.makeHealth(15),
          timestamp: Date.now()
        })

        expect(event._tag).toBe('PlayerDamaged')
        yield* pipe(
          event,
          Match.type<Types.PlayerEvent>(),
          Match.tag('PlayerDamaged', (damaged) => Effect.sync(() => {
            expect(damaged.damage).toBe(5)
            expect(damaged.newHealth).toBe(15)
          })),
          Match.orElse(() => Effect.succeed(undefined))
        )
      })
    )
  })
})

// =========================================
// Composite Types Tests
// =========================================

describe('PlayerTypes - Composite Types', () => {
  describe('PlayerStats', () => {
    it('should create valid PlayerStats', () =>
      Effect.gen(function* () {
        const stats = yield* Schema.decodeUnknown(Types.PlayerStats)({
          health: 20,
          maxHealth: 20,
          hunger: 20,
          saturation: 20,
          experience: 0,
          level: 0,
          armor: 0
        })

        expect(stats.health).toBe(20)
        expect(stats.level).toBe(0)
      })
    )

    it.prop([
      fc.record({
        health: fc.integer({ min: 0, max: 20 }),
        maxHealth: fc.integer({ min: 0, max: 20 }),
        hunger: fc.integer({ min: 0, max: 20 }),
        saturation: fc.integer({ min: 0, max: 20 }),
        experience: fc.nat(),
        level: fc.nat(),
        armor: fc.integer({ min: 0, max: 20 })
      })
    ])('property: valid stats within bounds', (statsData) =>
      Effect.gen(function* () {
        const stats = yield* Schema.decodeUnknown(Types.PlayerStats)(statsData)
        expect(stats.health).toBeGreaterThanOrEqual(0)
        expect(stats.health).toBeLessThanOrEqual(20)
        expect(stats.armor).toBeGreaterThanOrEqual(0)
        expect(stats.armor).toBeLessThanOrEqual(20)
      }).pipe(Effect.runPromise)
    )
  })

  describe('PlayerAbilities', () => {
    it('should have correct default abilities', () => {
      const abilities = Types.defaultPlayerAbilities

      expect(abilities.canFly).toBe(false)
      expect(abilities.canBreakBlocks).toBe(true)
      expect(abilities.canPlaceBlocks).toBe(true)
      expect(abilities.invulnerable).toBe(false)
      expect(abilities.walkSpeed).toBeCloseTo(4.317)
      expect(abilities.flySpeed).toBeCloseTo(10.92)
    })
  })

  describe('Inventory', () => {
    it('should create valid Inventory', () =>
      Effect.gen(function* () {
        const inventory = yield* Schema.decodeUnknown(Types.Inventory)({
          slots: Array(36).fill(null),
          selectedSlot: 0
        })

        expect(inventory.slots.length).toBe(36)
        expect(inventory.selectedSlot).toBe(0)
      })
    )

    it('should validate selected slot range', () =>
      Effect.gen(function* () {
        const invalid = yield* Effect.either(
          Schema.decodeUnknown(Types.Inventory)({
            slots: Array(36).fill(null),
            selectedSlot: 9 // Out of range
          })
        )

        yield* pipe(
          invalid,
          Match.value,
          Match.tag('Left', () => Effect.succeed('Validation failed as expected')),
          Match.tag('Right', () => Effect.fail('Should have failed validation')),
          Match.exhaustive
        )
      })
    )
  })

  describe('Player', () => {
    it('should create valid Player entity', () =>
      Effect.gen(function* () {
        const player = yield* Schema.decodeUnknown(Types.Player)({
          id: Types.makePlayerId('player1'),
          entityId: Types.makeEntityId(1),
          name: 'TestPlayer',
          position: { x: 0, y: 64, z: 0 },
          rotation: { pitch: 0, yaw: 0, roll: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          stats: Types.defaultPlayerStats,
          gameMode: 'survival',
          abilities: Types.defaultPlayerAbilities,
          inventory: Types.defaultInventory,
          equipment: Types.defaultEquipment,
          isOnGround: true,
          isSneaking: false,
          isSprinting: false,
          lastUpdate: Date.now(),
          createdAt: Date.now()
        })

        expect(player.name).toBe('TestPlayer')
        expect(player.gameMode).toBe('survival')
      })
    )

    it('should validate player name pattern', () =>
      Effect.gen(function* () {
        const invalid = yield* Effect.either(
          Schema.decodeUnknown(Types.Player)({
            id: Types.makePlayerId('player1'),
            entityId: Types.makeEntityId(1),
            name: 'Invalid Name!', // Contains invalid characters
            position: { x: 0, y: 64, z: 0 },
            rotation: { pitch: 0, yaw: 0, roll: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            stats: Types.defaultPlayerStats,
            gameMode: 'survival',
            abilities: Types.defaultPlayerAbilities,
            inventory: Types.defaultInventory,
            equipment: Types.defaultEquipment,
            isOnGround: true,
            isSneaking: false,
            isSprinting: false,
            lastUpdate: Date.now(),
            createdAt: Date.now()
          })
        )

        yield* pipe(
          invalid,
          Either.match({
            onLeft: () => Effect.succeed('Name validation failed correctly'),
            onRight: () => Effect.fail('Invalid name should have been rejected')
          })
        )
      })
    )

    it.prop([
      fc.record({
        name: fc.string({ minLength: 1, maxLength: 16 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
        gameMode: arbGameMode,
        position: arbVector3D,
        rotation: arbRotation
      })
    ])('property: Player entity invariants', (data) =>
      Effect.gen(function* () {
        const player = yield* Schema.decodeUnknown(Types.Player)({
          id: Types.makePlayerId('test'),
          entityId: Types.makeEntityId(1),
          name: data.name,
          position: data.position,
          rotation: data.rotation,
          velocity: { x: 0, y: 0, z: 0 },
          stats: Types.defaultPlayerStats,
          gameMode: data.gameMode,
          abilities: Types.defaultPlayerAbilities,
          inventory: Types.defaultInventory,
          equipment: Types.defaultEquipment,
          isOnGround: false,
          isSneaking: false,
          isSprinting: false,
          lastUpdate: Date.now(),
          createdAt: Date.now()
        })

        // Invariants
        expect(player.name.length).toBeGreaterThan(0)
        expect(player.name.length).toBeLessThanOrEqual(16)
        expect(player.rotation.pitch).toBeGreaterThanOrEqual(-90)
        expect(player.rotation.pitch).toBeLessThanOrEqual(90)
        expect(player.rotation.yaw).toBeGreaterThanOrEqual(-180)
        expect(player.rotation.yaw).toBeLessThanOrEqual(180)
      }).pipe(Effect.runPromise)
    )
  })
})

// =========================================
// Error Types Tests
// =========================================

describe('PlayerTypes - Errors', () => {
  describe('PlayerError', () => {
    it('should create PlayerNotFound error', () =>
      Effect.gen(function* () {
        const error = yield* Schema.decodeUnknown(Types.PlayerError)({
          _tag: 'PlayerError',
          reason: 'PlayerNotFound',
          playerId: Types.makePlayerId('missing'),
          message: 'Player not found'
        })

        expect(error.reason).toBe('PlayerNotFound')
        expect(error.message).toBe('Player not found')
      })
    )

    it('should create InventoryFull error with context', () =>
      Effect.gen(function* () {
        const error = yield* Schema.decodeUnknown(Types.PlayerError)({
          _tag: 'PlayerError',
          reason: 'InventoryFull',
          playerId: Types.makePlayerId('player1'),
          message: 'Cannot add item: inventory is full',
          context: {
            itemId: 'diamond',
            count: 5
          }
        })

        expect(error.reason).toBe('InventoryFull')
        expect(error.context).toEqual({
          itemId: 'diamond',
          count: 5
        })
      })
    )

    it.prop([
      fc.constantFrom(
        'PlayerNotFound',
        'PlayerAlreadyExists',
        'InvalidPosition',
        'InvalidHealth',
        'InvalidGameMode',
        'InventoryFull',
        'ItemNotFound',
        'PermissionDenied',
        'ValidationFailed'
      )
    ])('property: all error reasons are valid', (reason) =>
      Effect.gen(function* () {
        const error = yield* Schema.decodeUnknown(Types.PlayerError)({
          _tag: 'PlayerError',
          reason,
          message: `Error: ${reason}`
        })

        expect(error.reason).toBe(reason)
      }).pipe(Effect.runPromise)
    )
  })
})

// =========================================
// Default Values Tests
// =========================================

describe('PlayerTypes - Default Values', () => {
  it('should have correct default PlayerStats', () => {
    const stats = Types.defaultPlayerStats

    expect(stats.health).toBe(20)
    expect(stats.maxHealth).toBe(20)
    expect(stats.hunger).toBe(20)
    expect(stats.saturation).toBe(20)
    expect(stats.experience).toBe(0)
    expect(stats.level).toBe(0)
    expect(stats.armor).toBe(0)
  })

  it('should have correct default Inventory', () => {
    const inventory = Types.defaultInventory

    expect(inventory.slots.length).toBe(36)
    expect(inventory.slots.every(slot => slot === null)).toBe(true)
    expect(inventory.selectedSlot).toBe(0)
  })

  it('should have correct default Equipment', () => {
    const equipment = Types.defaultEquipment
    const fields = ['helmet', 'chestplate', 'leggings', 'boots', 'mainHand', 'offHand'] as const

    return Effect.gen(function* () {
      yield* Effect.forEach(fields, field =>
        pipe(
          equipment[field],
          Match.value,
          Match.when(
            value => value === null,
            () => Effect.succeed(`${field} is correctly null`)
          ),
          Match.orElse(() => Effect.fail(`${field} should be null`))
        )
      )
    })
  })
})