import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  hostileDamageMultiplierForDifficulty,
  starvationDamageForDifficulty,
} from './physics-stage-damage-logic'

describe('physics-stage — damage logic', () => {
  it('scales hostile damage by difficulty', () => {
    const cases = [
      { difficulty: 'peaceful' as const, expected: 0 },
      { difficulty: 'easy' as const, expected: 0.5 },
      { difficulty: 'normal' as const, expected: 1 },
      { difficulty: 'hard' as const, expected: 1.5 },
    ]

    for (const testCase of cases) {
      expect(hostileDamageMultiplierForDifficulty(testCase.difficulty)).toBe(testCase.expected)
    }
  })

  it('caps starvation damage by difficulty and health', () => {
    const cases = [
      { difficulty: 'peaceful' as const, currentHealth: 20, expected: 0 },
      { difficulty: 'easy' as const, currentHealth: 12, expected: 1 },
      { difficulty: 'easy' as const, currentHealth: 10, expected: 0 },
      { difficulty: 'normal' as const, currentHealth: 2, expected: 1 },
      { difficulty: 'normal' as const, currentHealth: 1, expected: 0 },
      { difficulty: 'hard' as const, currentHealth: 3, expected: 1 },
    ]

    for (const testCase of cases) {
      expect(
        starvationDamageForDifficulty(testCase.difficulty, testCase.currentHealth),
      ).toBe(testCase.expected)
    }
  })
})
