import { describe, expect, it } from 'vitest'
import { isEndermanProvokedByLook } from '@ts-minecraft/entity'

describe('entity/enderman-anger', () => {
  const playerPosition = { x: 0, y: 66.1, z: 0 }
  const endermanPosition = { x: 8, y: 64, z: 0 }

  it('detects a camera ray through the Enderman upper body', () => {
    expect(isEndermanProvokedByLook({
      playerPosition,
      playerLookDirection: { x: 1, y: 0, z: 0 },
      endermanPosition,
      detectionRange: 24,
    })).toBe(true)
  })

  it('ignores ray misses, targets behind the player, and out-of-range targets', () => {
    expect(isEndermanProvokedByLook({
      playerPosition,
      playerLookDirection: { x: 0, y: 0, z: 1 },
      endermanPosition,
      detectionRange: 24,
    })).toBe(false)

    expect(isEndermanProvokedByLook({
      playerPosition,
      playerLookDirection: { x: -1, y: 0, z: 0 },
      endermanPosition,
      detectionRange: 24,
    })).toBe(false)

    expect(isEndermanProvokedByLook({
      playerPosition,
      playerLookDirection: { x: 1, y: 0, z: 0 },
      endermanPosition: { x: 25, y: 64, z: 0 },
      detectionRange: 24,
    })).toBe(false)
  })

  it('accepts non-normalized look vectors and rejects zero vectors', () => {
    expect(isEndermanProvokedByLook({
      playerPosition,
      playerLookDirection: { x: 12, y: 0, z: 0 },
      endermanPosition,
      detectionRange: 24,
    })).toBe(true)

    expect(isEndermanProvokedByLook({
      playerPosition,
      playerLookDirection: { x: 0, y: 0, z: 0 },
      endermanPosition,
      detectionRange: 24,
    })).toBe(false)
  })

  it('ignores eye contact when a solid block intersects the sight segment', () => {
    expect(isEndermanProvokedByLook({
      playerPosition,
      playerLookDirection: { x: 1, y: 0, z: 0 },
      endermanPosition,
      detectionRange: 24,
      isSightBlocked: (position) =>
        Math.floor(position.x) === 4 &&
        Math.floor(position.y) === 66 &&
        Math.floor(position.z) === 0,
    })).toBe(false)
  })

  it('ignores blocker samples behind the Enderman target', () => {
    expect(isEndermanProvokedByLook({
      playerPosition,
      playerLookDirection: { x: 1, y: 0, z: 0 },
      endermanPosition,
      detectionRange: 24,
      isSightBlocked: (position) => Math.floor(position.x) === 9,
    })).toBe(true)
  })
})
