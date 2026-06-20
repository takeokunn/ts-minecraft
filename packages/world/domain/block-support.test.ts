import { blockTypeToIndex } from '@ts-minecraft/core'
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  canBlockStaySupported,
  isSupportSensitiveBlock,
  isWaterBreakableBlockIndex,
} from './block-support'

const supportSensitiveCases = [
  ['TORCH', true],
  ['PRESSURE_PLATE', true],
  ['STONE', false],
] as const

const supportRuleCases = [
  ['PRESSURE_PLATE', 'STONE', true],
  ['PRESSURE_PLATE', 'AIR', false],
  ['WHEAT_CROP', 'FARMLAND', true],
  ['WHEAT_CROP', 'DIRT', false],
  ['SUGAR_CANE', 'SAND', true],
  ['CACTUS', 'DIRT', false],
  ['LILY_PAD', 'WATER', true],
] as const

const waterBreakableCases = [
  ['TORCH', true],
  ['PRESSURE_PLATE', true],
  ['STONE', false],
] as const

describe('block-support', () => {
  it.each(supportSensitiveCases)('identifies support sensitivity for %s', (blockType, expected) => {
    expect(isSupportSensitiveBlock(blockType)).toBe(expected)
  })

  it.each(supportRuleCases)('evaluates support for %s on %s', (blockType, blockBelow, expected) => {
    expect(canBlockStaySupported(blockType, blockBelow)).toBe(expected)
  })

  it.each(waterBreakableCases)('marks %s as water-breakable by index', (blockType, expected) => {
    expect(isWaterBreakableBlockIndex(blockTypeToIndex(blockType))).toBe(expected)
  })
})
