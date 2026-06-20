import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { EntityType, EntityTypeSchema } from '@ts-minecraft/entity/domain/mob/entity';

describe('Phase 18 The End entity type schema', () => {
  it('accepts Shulker and Endermite as entity type strings', () => {
    const decode = Schema.decodeUnknownSync(EntityTypeSchema)

    expect(decode('Shulker')).toBe('Shulker')
    expect(decode('Endermite')).toBe('Endermite')
    expect(EntityType.Shulker).toBe('Shulker')
    expect(EntityType.Endermite).toBe('Endermite')
  })
})
