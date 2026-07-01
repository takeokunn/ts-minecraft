import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  resolveDroppedItemThrow,
  DROPPED_ITEM_THROW_FORWARD_OFFSET,
  DROPPED_ITEM_THROW_VERTICAL_OFFSET,
  DROPPED_ITEM_THROW_FORWARD_VELOCITY,
  DROPPED_ITEM_THROW_UPWARD_VELOCITY,
} from './input-stage-inventory'

const makeCamera = (dx: number, dy: number, dz: number) => ({
  getWorldDirection: (target: THREE.Vector3) => {
    target.x = dx
    target.y = dy
    target.z = dz
    return target
  },
})

const playerPos = { x: 0, y: 1, z: 0 }

describe('resolveDroppedItemThrow', () => {
  it('throws forward in -Z when camera faces -Z', () => {
    const result = resolveDroppedItemThrow(playerPos, makeCamera(0, 0, -1))
    expect(result.position.x).toBeCloseTo(0)
    expect(result.position.z).toBeCloseTo(-DROPPED_ITEM_THROW_FORWARD_OFFSET)
    expect(result.velocity.x).toBeCloseTo(0)
    expect(result.velocity.z).toBeCloseTo(-DROPPED_ITEM_THROW_FORWARD_VELOCITY)
  })

  it('throws forward in +X when camera faces +X', () => {
    const result = resolveDroppedItemThrow(playerPos, makeCamera(1, 0, 0))
    expect(result.position.x).toBeCloseTo(DROPPED_ITEM_THROW_FORWARD_OFFSET)
    expect(result.position.z).toBeCloseTo(0)
    expect(result.velocity.x).toBeCloseTo(DROPPED_ITEM_THROW_FORWARD_VELOCITY)
    expect(result.velocity.z).toBeCloseTo(0)
  })

  it('normalizes diagonal directions so throw distance is constant', () => {
    const diagonal = resolveDroppedItemThrow(playerPos, makeCamera(1, 0, -1))
    const forward = resolveDroppedItemThrow(playerPos, makeCamera(0, 0, -1))
    const posXZDist = Math.hypot(diagonal.position.x - playerPos.x, diagonal.position.z - playerPos.z)
    const fwdXZDist = Math.hypot(forward.position.x - playerPos.x, forward.position.z - playerPos.z)
    expect(posXZDist).toBeCloseTo(fwdXZDist)
  })

  it('applies vertical offset to position regardless of camera direction', () => {
    const result = resolveDroppedItemThrow(playerPos, makeCamera(0, -1, 0))
    expect(result.position.y).toBeCloseTo(playerPos.y + DROPPED_ITEM_THROW_VERTICAL_OFFSET)
  })

  it('sets upward velocity component', () => {
    const result = resolveDroppedItemThrow(playerPos, makeCamera(0, 0, -1))
    expect(result.velocity.y).toBeCloseTo(DROPPED_ITEM_THROW_UPWARD_VELOCITY)
  })

  it('falls back to -Z direction when camera faces straight down (horizontal length ≈ 0)', () => {
    const result = resolveDroppedItemThrow(playerPos, makeCamera(0, -1, 0))
    expect(result.velocity.x).toBeCloseTo(0)
    expect(result.velocity.z).toBeCloseTo(-DROPPED_ITEM_THROW_FORWARD_VELOCITY)
  })

  it('offsets from player world position', () => {
    const nonOriginPlayer = { x: 10, y: 65, z: -20 }
    const result = resolveDroppedItemThrow(nonOriginPlayer, makeCamera(0, 0, -1))
    expect(result.position.x).toBeCloseTo(10)
    expect(result.position.y).toBeCloseTo(65 + DROPPED_ITEM_THROW_VERTICAL_OFFSET)
    expect(result.position.z).toBeCloseTo(-20 - DROPPED_ITEM_THROW_FORWARD_OFFSET)
  })
})
