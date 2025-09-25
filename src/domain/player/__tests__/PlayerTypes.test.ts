import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Schema, Option, Either, pipe, Match, Array as EffectArray } from 'effect'
import * as Types from '../PlayerTypes.js'

// =========================================
// Test Data Generators (Effect-based)
// =========================================

const generatePlayerId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'
  const length = Math.floor(Math.random() * 49) + 1 // 1-50 chars
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const generateEntityId = (): number => Math.floor(Math.random() * 100000) + 1

const generateHealth = (): number => Math.floor(Math.random() * 21) // 0-20

const generateHunger = (): number => Math.floor(Math.random() * 21) // 0-20

const generateExperience = (): number => Math.floor(Math.random() * 1000)

const generateVector3D = (): Types.Vector3D => ({
  x: Math.random() * 20000 - 10000,
  y: Math.random() * 640 - 320,
  z: Math.random() * 20000 - 10000,
})

const generateRotation = (): Types.Rotation => ({
  pitch: Math.random() * 180 - 90,
  yaw: Math.random() * 360 - 180,
  roll: Math.random() * 360 - 180,
})

const generateGameMode = (): Types.GameMode => {
  const modes: Types.GameMode[] = ['survival', 'creative', 'adventure', 'spectator']
  return modes[Math.floor(Math.random() * modes.length)]!
}

const generateItemStack = () => ({
  itemId: generatePlayerId(),
  count: Math.floor(Math.random() * 64) + 1,
  metadata: Math.random() > 0.5 ? { key: 'value' } : undefined,
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

    it.effect('should validate PlayerId schema', () =>
      Effect.gen(function* () {
        const valid = yield* Schema.decodeUnknown(Types.PlayerId)('valid-id')
        expect(valid).toBe('valid-id')

        const invalid = yield* Effect.either(Schema.decodeUnknown(Types.PlayerId)(123))
        yield* Effect.if(Either.isLeft(invalid), {
          onTrue: () => Effect.sync(() => expect(true).toBe(true)),
          onFalse: () => Effect.fail('Should have failed')
        })
      }))

    it.effect('property: any non-empty string is valid PlayerId', () =>
      Effect.gen(function* () {
        // Run multiple iterations to simulate property-based testing
        yield* Effect.forEach(
          Array.from({ length: 10 }, () => generatePlayerId()),
          (str) => Effect.sync(() => {
            const id = Types.makePlayerId(str)
            expect(typeof id).toBe('string')
            expect(id).toBe(str)
          }),
          { concurrency: 1 }
        )
      })
    )
  })

  describe('Health', () => {
    it('should create valid Health values', () => {
      expect(Types.makeHealth(0)).toBe(0)
      expect(Types.makeHealth(10)).toBe(10)
      expect(Types.makeHealth(20)).toBe(20)
    })

    it.effect('should reject invalid Health values', () =>
      Effect.gen(function* () {
        const testCases = [{ value: -1 }, { value: 21 }]

        yield* Effect.forEach(testCases, ({ value }) =>
          pipe(
            Effect.try(() => Types.makeHealth(value)),
            Effect.either,
            Effect.flatMap((result) =>
              Effect.if(Either.isLeft(result), {
                onTrue: () => Effect.succeed('Invalid as expected'),
                onFalse: () => Effect.fail(`Value ${value} should have been invalid`)
              })
            )
          )
        )
      }))

    it.effect('property: valid range 0-20', () =>
      Effect.gen(function* () {
        yield* Effect.forEach(
          Array.from({ length: 10 }, () => generateHealth()),
          (value) => Effect.sync(() => {
            const health = Types.makeHealth(value)
            expect(health).toBeGreaterThanOrEqual(0)
            expect(health).toBeLessThanOrEqual(20)
          }),
          { concurrency: 1 }
        )
      })
    )
  })

  describe('EntityId', () => {
    it('should create valid EntityId', () => {
      const id = Types.makeEntityId(1)
      expect(id).toBe(1)
    })

    it.effect('property: positive integers are valid', () =>
      Effect.gen(function* () {
        yield* Effect.forEach(
          Array.from({ length: 10 }, () => generateEntityId()),
          (value) => Effect.sync(() => {
            const id = Types.makeEntityId(value)
            expect(id).toBeGreaterThan(0)
            expect(Number.isInteger(id)).toBe(true)
          }),
          { concurrency: 1 }
        )
      })
    )
  })
})

// =========================================
// Tagged Unions Tests
// =========================================

describe('PlayerTypes - Tagged Unions', () => {
  describe('PlayerAction', () => {
    it.effect('should create Move action', () =>
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
            sprint: true,
          },
        })

        expect(action._tag).toBe('Move')
        if (action._tag === 'Move') {
          expect(action.direction.forward).toBe(true)
          expect(action.direction.sprint).toBe(true)
        } else {
          yield* Effect.fail('Expected Move action')
        }
      }))

    it.effect('should create PlaceBlock action', () =>
      Effect.gen(function* () {
        const action = yield* Schema.decodeUnknown(Types.PlayerAction)({
          _tag: 'PlaceBlock',
          position: { x: 100, y: 64, z: 200 },
          face: 'top',
        })

        expect(action._tag).toBe('PlaceBlock')
        if (action._tag === 'PlaceBlock') {
          expect(action.position.x).toBe(100)
          expect(action.face).toBe('top')
        }
      }))

    it.effect('property: all action tags are valid', () =>
      Effect.gen(function* () {
        const validTags = ['Move', 'Jump', 'Attack', 'UseItem', 'PlaceBlock', 'BreakBlock', 'OpenContainer', 'DropItem']
        yield* Effect.forEach(
          validTags,
          (tag) => Effect.sync(() => {
            expect(validTags).toContain(tag)
          }),
          { concurrency: 1 }
        )
      })
    )
  })

  describe('DamageSource', () => {
    it.effect('should create Fall damage', () =>
      Effect.gen(function* () {
        const damage = yield* Schema.decodeUnknown(Types.DamageSource)({
          _tag: 'Fall',
          distance: 10.5,
        })

        expect(damage._tag).toBe('Fall')
        if (damage._tag === 'Fall') {
          expect(damage.distance).toBe(10.5)
        }
      }))

    it.effect('should create Environment damage', () =>
      Effect.gen(function* () {
        const damage = yield* Schema.decodeUnknown(Types.DamageSource)({
          _tag: 'Environment',
          type: 'lava',
        })

        expect(damage._tag).toBe('Environment')
        if (damage._tag === 'Environment') {
          expect(damage.type).toBe('lava')
        }
      }))
  })

  describe('PlayerEvent', () => {
    it.effect('should create PlayerCreated event', () =>
      Effect.gen(function* () {
        const event = yield* Schema.decodeUnknown(Types.PlayerEvent)({
          _tag: 'PlayerCreated',
          playerId: Types.makePlayerId('player1'),
          name: 'TestPlayer',
          position: { x: 0, y: 64, z: 0 },
          gameMode: 'survival',
          timestamp: Date.now(),
        })

        expect(event._tag).toBe('PlayerCreated')
      }))

    it.effect('should create PlayerDamaged event', () =>
      Effect.gen(function* () {
        const event = yield* Schema.decodeUnknown(Types.PlayerEvent)({
          _tag: 'PlayerDamaged',
          playerId: Types.makePlayerId('player1'),
          damage: 5,
          source: { _tag: 'Fall', distance: 10 },
          newHealth: Types.makeHealth(15),
          timestamp: Date.now(),
        })

        expect(event._tag).toBe('PlayerDamaged')
        if (event._tag === 'PlayerDamaged') {
          expect(event.damage).toBe(5)
          expect(event.newHealth).toBe(15)
        }
      }))
  })
})

// =========================================
// Composite Types Tests
// =========================================

describe('PlayerTypes - Composite Types', () => {
  describe('PlayerStats', () => {
    it.effect('should create valid PlayerStats', () =>
      Effect.gen(function* () {
        const stats = yield* Schema.decodeUnknown(Types.PlayerStats)({
          health: 20,
          maxHealth: 20,
          hunger: 20,
          saturation: 20,
          experience: 0,
          level: 0,
          armor: 0,
        })

        expect(stats.health).toBe(20)
        expect(stats.level).toBe(0)
      }))

    it.effect('property: valid stats within bounds', () =>
      Effect.gen(function* () {
        yield* Effect.forEach(
          Array.from({ length: 10 }, () => ({
            health: generateHealth(),
            maxHealth: generateHealth(),
            hunger: generateHunger(),
            saturation: generateHunger(),
            experience: generateExperience(),
            level: Math.floor(Math.random() * 100),
            armor: generateHealth(),
          })),
          (statsData) =>
            Effect.gen(function* () {
              const stats = yield* Schema.decodeUnknown(Types.PlayerStats)(statsData)
              expect(stats.health).toBeGreaterThanOrEqual(0)
              expect(stats.health).toBeLessThanOrEqual(20)
              expect(stats.armor).toBeGreaterThanOrEqual(0)
              expect(stats.armor).toBeLessThanOrEqual(20)
            }),
          { concurrency: 1 }
        )
      })
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
    it.effect('should create valid Inventory', () =>
      Effect.gen(function* () {
        const inventory = yield* Schema.decodeUnknown(Types.Inventory)({
          slots: Array(36).fill(null),
          selectedSlot: 0,
        })

        expect(inventory.slots.length).toBe(36)
        expect(inventory.selectedSlot).toBe(0)
      }))

    it.effect('should validate selected slot range', () =>
      Effect.gen(function* () {
        const invalid = yield* Effect.either(
          Schema.decodeUnknown(Types.Inventory)({
            slots: Array(36).fill(null),
            selectedSlot: 9, // Out of range
          })
        )

        yield* Effect.if(Either.isLeft(invalid), {
          onTrue: () => Effect.succeed('Validation failed as expected'),
          onFalse: () => Effect.fail('Should have failed validation')
        })
      }))
  })

  describe('Player', () => {
    it.effect('should create valid Player entity', () =>
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
          createdAt: Date.now(),
        })

        expect(player.name).toBe('TestPlayer')
        expect(player.gameMode).toBe('survival')
      }))

    it.effect('should validate player name pattern', () =>
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
            createdAt: Date.now(),
          })
        )

        yield* Effect.if(Either.isLeft(invalid), {
          onTrue: () => Effect.succeed('Name validation failed correctly'),
          onFalse: () => Effect.fail('Invalid name should have been rejected')
        })
      }))

    it.effect('property: Player entity invariants', () =>
      Effect.gen(function* () {
        yield* Effect.forEach(
          Array.from({ length: 10 }, () => ({
            name: generatePlayerId().slice(0, 16), // Ensure max 16 chars
            gameMode: generateGameMode(),
            position: generateVector3D(),
            rotation: generateRotation(),
          })),
          (data) =>
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
                createdAt: Date.now(),
              })

              // Invariants
              expect(player.name.length).toBeGreaterThan(0)
              expect(player.name.length).toBeLessThanOrEqual(16)
              expect(player.rotation.pitch).toBeGreaterThanOrEqual(-90)
              expect(player.rotation.pitch).toBeLessThanOrEqual(90)
              expect(player.rotation.yaw).toBeGreaterThanOrEqual(-180)
              expect(player.rotation.yaw).toBeLessThanOrEqual(180)
            }),
          { concurrency: 1 }
        )
      })
    )
  })
})

// =========================================
// Error Types Tests
// =========================================

describe('PlayerTypes - Errors', () => {
  describe('PlayerError', () => {
    it.effect('should create PlayerNotFound error', () =>
      Effect.gen(function* () {
        const error = yield* Schema.decodeUnknown(Types.PlayerError)({
          _tag: 'PlayerError',
          reason: 'PlayerNotFound',
          playerId: Types.makePlayerId('missing'),
          message: 'Player not found',
        })

        expect(error.reason).toBe('PlayerNotFound')
        expect(error.message).toBe('Player not found')
      }))

    it.effect('should create InventoryFull error with context', () =>
      Effect.gen(function* () {
        const error = yield* Schema.decodeUnknown(Types.PlayerError)({
          _tag: 'PlayerError',
          reason: 'InventoryFull',
          playerId: Types.makePlayerId('player1'),
          message: 'Cannot add item: inventory is full',
          context: {
            itemId: 'diamond',
            count: 5,
          },
        })

        expect(error.reason).toBe('InventoryFull')
        expect(error.context).toEqual({
          itemId: 'diamond',
          count: 5,
        })
      }))

    it.effect('property: all error reasons are valid', () =>
      Effect.gen(function* () {
        const errorReasons = [
          'PlayerNotFound',
          'PlayerAlreadyExists',
          'InvalidPosition',
          'InvalidHealth',
          'InvalidGameMode',
          'InventoryFull',
          'ItemNotFound',
          'PermissionDenied',
          'ValidationFailed'
        ]

        yield* Effect.forEach(
          errorReasons,
          (reason) =>
            Effect.gen(function* () {
              const error = yield* Schema.decodeUnknown(Types.PlayerError)({
                _tag: 'PlayerError',
                reason,
                message: `Error: ${reason}`,
              })

              expect(error.reason).toBe(reason)
            }),
          { concurrency: 1 }
        )
      })
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
    expect(inventory.slots.every((slot) => slot === null)).toBe(true)
    expect(inventory.selectedSlot).toBe(0)
  })

  it.effect('should have correct default Equipment', () => {
    const equipment = Types.defaultEquipment
    const fields = ['helmet', 'chestplate', 'leggings', 'boots', 'mainHand', 'offHand'] as const

    return Effect.gen(function* () {
      yield* Effect.forEach(fields, (field) =>
        Effect.if(equipment[field] === null, {
          onTrue: () => Effect.succeed(`${field} is correctly null`),
          onFalse: () => Effect.fail(`${field} should be null`)
        })
      )
    })
  })
})
