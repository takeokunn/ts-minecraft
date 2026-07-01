import { describe, expect, it } from 'vitest'
import { describePlayerDeath } from '@ts-minecraft/entity/domain/player-damage-cause'
import type { PlayerDamageCause } from '@ts-minecraft/entity/domain/player-damage-cause'

// ─── describePlayerDeath ──────────────────────────────────────────────────────
describe('describePlayerDeath', () => {
  it('returns the generic death message for null', () => {
    expect(describePlayerDeath(null)).toBe('You died.')
  })

  it('returns the generic death message for undefined', () => {
    expect(describePlayerDeath(undefined)).toBe('You died.')
  })

  it('returns the generic message for kind=generic', () => {
    expect(describePlayerDeath({ kind: 'generic' })).toBe('You died.')
  })

  const cases: Array<[PlayerDamageCause['kind'], string]> = [
    ['fall',        'You hit the ground too hard.'],
    ['mob',         'You were slain by a hostile mob.'],
    ['projectile',  'You were shot.'],
    ['explosion',   'You blew up.'],
    ['lava',        'You tried to swim in lava.'],
    ['fire',        'You went up in flames.'],
    ['cactus',      'You were pricked to death.'],
    ['lightning',   'You were struck by lightning.'],
    ['suffocation', 'You suffocated in a wall.'],
    ['void',        'You fell out of the world.'],
    ['drowning',    'You drowned.'],
    ['starvation',  'You starved to death.'],
    ['ender_pearl', 'You teleported too hard.'],
  ]

  it.each(cases)('kind=%s → "%s"', (kind, message) => {
    expect(describePlayerDeath({ kind } as PlayerDamageCause)).toBe(message)
  })

  it('every non-generic cause produces a message distinct from the generic fallback', () => {
    const genericMsg = describePlayerDeath(null)
    for (const [kind] of cases) {
      expect(describePlayerDeath({ kind } as PlayerDamageCause)).not.toBe(genericMsg)
    }
  })
})
