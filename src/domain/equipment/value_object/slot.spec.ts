import { describe, expect, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { EquipmentSlotSchema, allSlots, ensureSlotAllowed, getSlotCategory } from './slot'

describe('equipment/value_object/slot', () => {
  it('exposes all slots', () => {
    expect(allSlots).toHaveLength(10)
  })

  it.effect('decodes slot identifiers', () =>
    Effect.gen(function* () {
      const slot = yield* Schema.decodeUnknown(EquipmentSlotSchema)('helmet')
      expect(slot).toBe('helmet')
    })
  )

  it.effect('validates allowed tags per category', () =>
    Effect.gen(function* () {
      const slot = yield* Schema.decodeUnknown(EquipmentSlotSchema)('main_hand')
      yield* ensureSlotAllowed(slot, 'weapon:sword')
      const helmet = yield* Schema.decodeUnknown(EquipmentSlotSchema)('helmet')
      const exit = yield* Effect.either(ensureSlotAllowed(helmet, 'weapon:sword'))
      expect(exit._tag).toBe('Left')
    })
  )

  it.effect('returns slot category metadata', () =>
    Effect.gen(function* () {
      const slot = yield* Schema.decodeUnknown(EquipmentSlotSchema)('ring')
      const category = yield* getSlotCategory(slot)
      expect(category._tag).toBe('Accessory')
    })
  )
})
