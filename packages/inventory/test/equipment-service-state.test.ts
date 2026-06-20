import { Option } from 'effect'
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { createStack, ItemStack } from '../domain/item-stack'
import { emptyEquipmentSlots } from '../application/equipment-persistence'
import {
  computeEquipmentTotalArmorPoints,
  computeEquipmentTotalBlastProtectionReduction,
  computeEquipmentTotalProtectionReduction,
  computeEquipmentTotalProjectileProtectionReduction,
  damageArmorSlot,
  equipArmorItem,
  equipArmorItemIfSlotEmpty,
  repairMendingItemsWithXP,
  unequipArmorSlot,
} from '../application/equipment-service-state'

const mkArmor = (
  itemType: Parameters<typeof createStack>[0],
  enchantments?: ItemStack['enchantments'],
): ItemStack =>
  new ItemStack({
    itemType,
    count: 1,
    durability: createStack(itemType).durability,
    enchantments,
  })

describe('equipment-service-state', () => {
  it('equips armor items and ignores non-armor items', () => {
    const empty = emptyEquipmentSlots()

    const [equippedHelmet, helmetSlots] = equipArmorItem(empty, mkArmor('IRON_HELMET'))
    expect(equippedHelmet).toBe(true)
    expect(Option.getOrThrow(helmetSlots.HELMET).itemType).toBe('IRON_HELMET')

    const [equippedSword, swordSlots] = equipArmorItem(empty, createStack('IRON_SWORD'))
    expect(equippedSword).toBe(false)
    expect(swordSlots).toEqual(empty)
  })

  it('equips armor only when the target slot is empty', () => {
    const empty = emptyEquipmentSlots()

    const [equippedHelmet, helmetSlots] = equipArmorItemIfSlotEmpty(empty, mkArmor('IRON_HELMET'))
    expect(equippedHelmet).toBe(true)
    expect(Option.getOrThrow(helmetSlots.HELMET).itemType).toBe('IRON_HELMET')

    const occupied = {
      ...emptyEquipmentSlots(),
      HELMET: Option.some(mkArmor('DIAMOND_HELMET')),
    }
    const [equippedReplacement, replacementSlots] = equipArmorItemIfSlotEmpty(occupied, mkArmor('IRON_HELMET'))
    expect(equippedReplacement).toBe(false)
    expect(replacementSlots).toEqual(occupied)
  })

  it('normalizes auto-equipped armor to a single item', () => {
    const stack = new ItemStack({
      itemType: 'IRON_HELMET',
      count: 2,
      durability: createStack('IRON_HELMET').durability,
    })

    const [equipped, slots] = equipArmorItemIfSlotEmpty(emptyEquipmentSlots(), stack)

    expect(equipped).toBe(true)
    expect(Option.getOrThrow(slots.HELMET).count).toBe(1)
  })

  it('unequips armor slots and returns the removed stack', () => {
    const slots = {
      ...emptyEquipmentSlots(),
      HELMET: Option.some(mkArmor('IRON_HELMET')),
    }

    const [removed, nextSlots] = unequipArmorSlot(slots, 'HELMET')

    expect(Option.getOrThrow(removed).itemType).toBe('IRON_HELMET')
    expect(Option.isNone(nextSlots.HELMET)).toBe(true)
  })

  it('computes total armor points and enchantment reductions', () => {
    const protectionArmorSlots = {
      ...emptyEquipmentSlots(),
      HELMET: Option.some(mkArmor('DIAMOND_HELMET', [{ type: 'PROTECTION', level: 4 }])),
      CHESTPLATE: Option.some(mkArmor('DIAMOND_CHESTPLATE', [{ type: 'PROTECTION', level: 4 }])),
      LEGGINGS: Option.some(mkArmor('DIAMOND_LEGGINGS', [{ type: 'PROTECTION', level: 4 }])),
      BOOTS: Option.some(mkArmor('DIAMOND_BOOTS', [{ type: 'PROTECTION', level: 4 }])),
    }

    const projectileArmorSlots = {
      ...emptyEquipmentSlots(),
      HELMET: Option.some(mkArmor('DIAMOND_HELMET', [{ type: 'PROJECTILE_PROTECTION', level: 4 }])),
    }

    const blastArmorSlots = {
      ...emptyEquipmentSlots(),
      HELMET: Option.some(mkArmor('DIAMOND_HELMET', [{ type: 'BLAST_PROTECTION', level: 4 }])),
      CHESTPLATE: Option.some(mkArmor('DIAMOND_CHESTPLATE', [{ type: 'BLAST_PROTECTION', level: 4 }])),
      LEGGINGS: Option.some(mkArmor('DIAMOND_LEGGINGS', [{ type: 'BLAST_PROTECTION', level: 4 }])),
      BOOTS: Option.some(mkArmor('DIAMOND_BOOTS', [{ type: 'BLAST_PROTECTION', level: 4 }])),
    }

    expect(computeEquipmentTotalArmorPoints(protectionArmorSlots)).toBe(20)
    expect(computeEquipmentTotalProtectionReduction(protectionArmorSlots)).toBeCloseTo(0.64)
    expect(computeEquipmentTotalProjectileProtectionReduction(projectileArmorSlots)).toBeCloseTo(0.32)
    expect(computeEquipmentTotalBlastProtectionReduction(blastArmorSlots)).toBeCloseTo(0.64)
  })

  it('damages equipped armor and removes broken pieces', () => {
    const worn = {
      ...emptyEquipmentSlots(),
      HELMET: Option.some(mkArmor('IRON_HELMET')),
    }
    const damaged = damageArmorSlot(worn, 'HELMET', 5)
    expect(Option.getOrThrow(damaged.HELMET).durability).toBe(
      Option.getOrThrow(worn.HELMET).durability - 5,
    )

    const broken = damageArmorSlot(
      {
        ...emptyEquipmentSlots(),
        HELMET: Option.some(new ItemStack({ itemType: 'IRON_HELMET', count: 1, durability: 1 })),
      },
      'HELMET',
      1,
    )
    expect(Option.isNone(broken.HELMET)).toBe(true)
  })

  it('repairs Mending armor and preserves fractional XP', () => {
    const slots = {
      ...emptyEquipmentSlots(),
      HELMET: Option.some(
        new ItemStack({
          itemType: 'IRON_HELMET',
          count: 1,
          durability: 160,
          enchantments: [{ type: 'MENDING', level: 1 }],
        }),
      ),
      CHESTPLATE: Option.some(
        new ItemStack({
          itemType: 'IRON_CHESTPLATE',
          count: 1,
          durability: 237,
          enchantments: [{ type: 'MENDING', level: 1 }],
        }),
      ),
    }

    const [remaining, nextSlots] = repairMendingItemsWithXP(slots, 1.5)

    expect(remaining).toBe(0.5)
    expect(Option.getOrThrow(nextSlots.HELMET).durability).toBe(162)
    expect(Option.getOrThrow(nextSlots.CHESTPLATE).durability).toBe(237)
  })
})
