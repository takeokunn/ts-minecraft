import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { EquipmentBuilder } from './builder'

describe('equipment/factory/builder', () => {
  it.effect('generates equipment pieces with unique ids', () =>
    Effect.gen(function* () {
      const builder = yield* EquipmentBuilder
      const first = yield* builder.createDefaultPiece()
      const second = yield* builder.createDefaultPiece()
      expect(first.id).not.toBe(second.id)
    })
  )

  it.effect('generates empty equipment sets', () =>
    Effect.gen(function* () {
      const builder = yield* EquipmentBuilder
      const set = yield* builder.createDefaultSet('player_builder')
      expect(set.ownerId).toBe('player_builder')
      expect(Object.values(set.slots).every((entry) => entry === undefined)).toBe(true)
    })
  )
})
