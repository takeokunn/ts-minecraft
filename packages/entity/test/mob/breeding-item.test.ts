import { describe, it, expect } from 'vitest'
import { EntityType } from '@ts-minecraft/entity'
import { getMobDefinition } from '@ts-minecraft/entity/domain/mob/mobs'

// R6a: breedingItem data foundation for mob breeding.
describe('mob breeding item (R6a)', () => {
  it('cow and sheep breed with WHEAT', () => {
    expect(getMobDefinition(EntityType.Cow).breedingItem).toBe('WHEAT')
    expect(getMobDefinition(EntityType.Sheep).breedingItem).toBe('WHEAT')
  })

  it('pig breeds with CARROT', () => {
    expect(getMobDefinition(EntityType.Pig).breedingItem).toBe('CARROT')
  })

  it('chicken breeds with WHEAT_SEEDS', () => {
    expect(getMobDefinition(EntityType.Chicken).breedingItem).toBe('WHEAT_SEEDS')
  })

  it('hostile mobs are not breedable (no breedingItem)', () => {
    expect(getMobDefinition(EntityType.Zombie).breedingItem).toBeUndefined()
    expect(getMobDefinition(EntityType.Creeper).breedingItem).toBeUndefined()
  })
})
