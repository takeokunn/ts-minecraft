import { Option } from 'effect'
import { describe, expect, it } from 'vitest'
import type { EquipmentSlots } from '../../../../../inventory/application/equipment-persistence'
import { resolveTotalFireProtectionReduction } from './fire-protection-logic'

const makeSlots = (slots: Partial<{ [slot in keyof EquipmentSlots]: ReturnType<typeof Option.some> }> = {}): EquipmentSlots =>
  ({
    HELMET: Option.none(),
    CHESTPLATE: Option.none(),
    LEGGINGS: Option.none(),
    BOOTS: Option.none(),
    ...slots,
  }) as EquipmentSlots

describe('physics-stage-survival/fire-protection-logic', () => {
  it('resolves fire protection reduction from worn armor pieces in slot order', () => {
    const slots = makeSlots({
      HELMET: Option.some({
        itemType: 'IRON_HELMET',
        count: 1,
        enchantments: [{ type: 'FIRE_PROTECTION', level: 2 }],
      }),
      CHESTPLATE: Option.some({
        itemType: 'IRON_CHESTPLATE',
        count: 1,
        enchantments: [{ type: 'PROTECTION', level: 4 }],
      }),
      LEGGINGS: Option.some({
        itemType: 'IRON_LEGGINGS',
        count: 1,
        enchantments: [{ type: 'FIRE_PROTECTION', level: 4 }],
      }),
      BOOTS: Option.some({
        itemType: 'IRON_BOOTS',
        count: 1,
        enchantments: [{ type: 'FIRE_PROTECTION', level: 1 }],
      }),
    })

    expect(resolveTotalFireProtectionReduction(slots)).toBeCloseTo(0.56)
  })

  it('caps the total reduction at the maximum value', () => {
    expect(
      resolveTotalFireProtectionReduction(
        makeSlots({
          HELMET: Option.some({
            itemType: 'IRON_HELMET',
            count: 1,
            enchantments: [{ type: 'FIRE_PROTECTION', level: 4 }],
          }),
          CHESTPLATE: Option.some({
            itemType: 'IRON_CHESTPLATE',
            count: 1,
            enchantments: [{ type: 'FIRE_PROTECTION', level: 4 }],
          }),
          LEGGINGS: Option.some({
            itemType: 'IRON_LEGGINGS',
            count: 1,
            enchantments: [{ type: 'FIRE_PROTECTION', level: 4 }],
          }),
          BOOTS: Option.some({
            itemType: 'IRON_BOOTS',
            count: 1,
            enchantments: [{ type: 'FIRE_PROTECTION', level: 4 }],
          }),
        }),
      ),
    ).toBe(0.64)
  })
})
