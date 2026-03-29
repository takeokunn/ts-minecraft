import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, Effect, HashSet, Option } from 'effect'
import { PlayerInputService } from './player-input-service'
import { KeyMappings } from './key-mappings'

const TestLayer = PlayerInputService.Default

describe('PlayerInputService (stub defaults)', () => {
  describe('isKeyPressed', () => {
    it.effect('should return false for movement key KeyW', () =>
      Effect.gen(function* () {
        const service = yield* PlayerInputService
        const result = yield* service.isKeyPressed('KeyW')
        expect(result).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return false for jump key Space', () =>
      Effect.gen(function* () {
        const service = yield* PlayerInputService
        const result = yield* service.isKeyPressed('Space')
        expect(result).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return false for any arbitrary key', () =>
      Effect.gen(function* () {
        const service = yield* PlayerInputService
        const result = yield* service.isKeyPressed('any')
        expect(result).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('consumeKeyPress', () => {
    it.effect('should return false for KeyW (stub always returns false)', () =>
      Effect.gen(function* () {
        const service = yield* PlayerInputService
        const result = yield* service.consumeKeyPress('KeyW')
        expect(result).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should return false on repeated calls (no state changes)', () =>
      Effect.gen(function* () {
        const service = yield* PlayerInputService
        const first = yield* service.consumeKeyPress('Space')
        const second = yield* service.consumeKeyPress('Space')
        expect(first).toBe(false)
        expect(second).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('consumeWheelDelta', () => {
    it.effect('should return 0 (stub always returns 0)', () =>
      Effect.gen(function* () {
        const service = yield* PlayerInputService
        const result = yield* service.consumeWheelDelta()
        expect(result).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('getMouseDelta', () => {
    it.effect('should return { x: 0, y: 0 } (stub always returns zero delta)', () =>
      Effect.gen(function* () {
        const service = yield* PlayerInputService
        const result = yield* service.getMouseDelta()
        expect(result).toEqual({ x: 0, y: 0 })
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('isPointerLocked', () => {
    it.effect('should return false (stub always returns false)', () =>
      Effect.gen(function* () {
        const service = yield* PlayerInputService
        const result = yield* service.isPointerLocked()
        expect(result).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})

describe('KeyMappings constants', () => {
  describe('movement keys', () => {
    it('MOVE_FORWARD should be KeyW', () => {
      expect(KeyMappings.MOVE_FORWARD).toBe('KeyW')
    })

    it('MOVE_BACKWARD should be KeyS', () => {
      expect(KeyMappings.MOVE_BACKWARD).toBe('KeyS')
    })

    it('MOVE_LEFT should be KeyA', () => {
      expect(KeyMappings.MOVE_LEFT).toBe('KeyA')
    })

    it('MOVE_RIGHT should be KeyD', () => {
      expect(KeyMappings.MOVE_RIGHT).toBe('KeyD')
    })
  })

  describe('action keys', () => {
    it('JUMP should be Space', () => {
      expect(KeyMappings.JUMP).toBe('Space')
    })

    it('SPRINT should be ControlLeft', () => {
      expect(KeyMappings.SPRINT).toBe('ControlLeft')
    })

    it('SNEAK should be ShiftRight', () => {
      expect(KeyMappings.SNEAK).toBe('ShiftRight')
    })

    it('SPRINT and SNEAK use different key bindings', () => {
      expect(KeyMappings.SPRINT).not.toBe(KeyMappings.SNEAK)
      expect(KeyMappings.SPRINT).toBe('ControlLeft')
      expect(KeyMappings.SNEAK).toBe('ShiftRight')
    })

    it('CAMERA_TOGGLE should be F5', () => {
      expect(KeyMappings.CAMERA_TOGGLE).toBe('F5')
    })
  })

  describe('hotbar slot keys', () => {
    it('HOTBAR_SLOT_1 should be Digit1', () => {
      expect(KeyMappings.HOTBAR_SLOT_1).toBe('Digit1')
    })

    it('HOTBAR_SLOT_2 should be Digit2', () => {
      expect(KeyMappings.HOTBAR_SLOT_2).toBe('Digit2')
    })

    it('HOTBAR_SLOT_3 should be Digit3', () => {
      expect(KeyMappings.HOTBAR_SLOT_3).toBe('Digit3')
    })

    it('HOTBAR_SLOT_4 should be Digit4', () => {
      expect(KeyMappings.HOTBAR_SLOT_4).toBe('Digit4')
    })

    it('HOTBAR_SLOT_5 should be Digit5', () => {
      expect(KeyMappings.HOTBAR_SLOT_5).toBe('Digit5')
    })

    it('HOTBAR_SLOT_6 should be Digit6', () => {
      expect(KeyMappings.HOTBAR_SLOT_6).toBe('Digit6')
    })

    it('HOTBAR_SLOT_7 should be Digit7', () => {
      expect(KeyMappings.HOTBAR_SLOT_7).toBe('Digit7')
    })

    it('HOTBAR_SLOT_8 should be Digit8', () => {
      expect(KeyMappings.HOTBAR_SLOT_8).toBe('Digit8')
    })

    it('HOTBAR_SLOT_9 should be Digit9', () => {
      expect(KeyMappings.HOTBAR_SLOT_9).toBe('Digit9')
    })
  })

  describe('UI keys', () => {
    it('INVENTORY_OPEN should be KeyE', () => {
      expect(KeyMappings.INVENTORY_OPEN).toBe('KeyE')
    })

    it('ESCAPE should be Escape', () => {
      expect(KeyMappings.ESCAPE).toBe('Escape')
    })
  })

  describe('key uniqueness', () => {
    it('all keys should be unique strings', () => {
      const allValues = Object.values(KeyMappings)
      const uniqueValues = HashSet.fromIterable(allValues)
      // All keys should be unique (no duplicates)
      expect(allValues.length - HashSet.size(uniqueValues)).toBe(0)
    })

    it('there should be no duplicate key bindings', () => {
      const allValues = Object.values(KeyMappings)
      const counts = Arr.reduce(allValues, {} as Record<string, number>, (acc, v) => {
        acc[v] = Option.getOrElse(Option.fromNullable(acc[v]), () => 0) + 1
        return acc
      })
      const duplicates = Arr.filter(Object.entries(counts), ([, count]) => count > 1)
      expect(duplicates).toHaveLength(0)
    })
  })
})
