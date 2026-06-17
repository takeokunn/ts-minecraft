import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { resolveMusicEnvironment } from '../application/music-manager-environment'

describe('audio/music-manager-environment', () => {
  it('returns cave when the player is below the cave threshold', () => {
    expect(
      resolveMusicEnvironment({
        isNight: false,
        playerPosition: { x: 0, y: 12, z: 0 },
        caveThresholdY: 40,
      }),
    ).toBe('cave')
  })

  it('returns night or day above the cave threshold based on the time of day', () => {
    expect(
      resolveMusicEnvironment({
        isNight: true,
        playerPosition: { x: 0, y: 64, z: 0 },
        caveThresholdY: 40,
      }),
    ).toBe('night')

    expect(
      resolveMusicEnvironment({
        isNight: false,
        playerPosition: { x: 0, y: 64, z: 0 },
        caveThresholdY: 40,
      }),
    ).toBe('day')
  })
})
