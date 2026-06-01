import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { PASSIVE_MOBS } from '../../domain/mob/mob-categories'
import { EntityType } from '../../domain/mob/entity'

describe('mob-categories — PASSIVE_MOBS', () => {
  it('PASSIVE_MOBS is non-empty', () => {
    expect(PASSIVE_MOBS.length).toBeGreaterThan(0)
  })

  it('PASSIVE_MOBS contains Cow, Pig, Sheep', () => {
    expect(PASSIVE_MOBS).toContain(EntityType.Cow)
    expect(PASSIVE_MOBS).toContain(EntityType.Pig)
    expect(PASSIVE_MOBS).toContain(EntityType.Sheep)
  })

  it('PASSIVE_MOBS has no duplicates', () => {
    expect(new Set(PASSIVE_MOBS).size).toBe(PASSIVE_MOBS.length)
  })

  it('PASSIVE_MOBS does not include hostile mob types', () => {
    expect(PASSIVE_MOBS).not.toContain(EntityType.Zombie)
  })
})
