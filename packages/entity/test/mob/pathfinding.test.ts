import { describe, expect, it } from 'vitest'
import type { Position } from '@ts-minecraft/core'
import { findDetourDirection, type SolidProbe } from '@ts-minecraft/entity/domain/mob/pathfinding'

// Voxel world builder: floor at y=63 (solid below 64) plus explicit walls.
const makeWorld = (walls: ReadonlyArray<readonly [number, number, number]>): SolidProbe => {
  const wallSet = new Set(walls.map(([x, y, z]) => `${x},${y},${z}`))
  return (position: Position): boolean => {
    const x = Math.floor(position.x)
    const y = Math.floor(position.y)
    const z = Math.floor(position.z)
    if (y < 64) return true // ground
    return wallSet.has(`${x},${y},${z}`)
  }
}

const at = (x: number, z: number): Position => ({ x: x + 0.5, y: 64.9, z: z + 0.5 })

describe('findDetourDirection', () => {
  it('routes around an adjacent wall segment between mob and player', () => {
    // Wall along x=1 from z=-2..2 (two blocks high) directly beside the mob.
    const walls: Array<readonly [number, number, number]> = []
    for (let z = -2; z <= 2; z++) {
      walls.push([1, 64, z], [1, 65, z])
    }
    const world = makeWorld(walls)
    const direction = findDetourDirection(at(0, 0), at(4, 0), world)
    expect(direction).not.toBeNull()
    // Straight east is blocked immediately; the first step must deviate along z.
    expect(Math.abs(direction!.z)).toBeGreaterThan(0.5)
  })

  it('steps up one-block terrain toward the player', () => {
    // Single raised block in the path — still walkable via step-up.
    const world = makeWorld([[2, 64, 0]])
    const direction = findDetourDirection(at(0, 0), at(4, 0), world)
    expect(direction).not.toBeNull()
  })

  it('returns null when the player is fully enclosed (node cap)', () => {
    // Box the player in with a full 3x3 ring of 2-high walls (including
    // diagonals — a diagonal-adjacent voxel is inside the goal tolerance).
    const walls: Array<readonly [number, number, number]> = []
    for (let wx = 3; wx <= 5; wx++) {
      for (let wz = -1; wz <= 1; wz++) {
        if (wx === 4 && wz === 0) continue
        walls.push([wx, 64, wz], [wx, 65, wz])
      }
    }
    const world = makeWorld(walls)
    const direction = findDetourDirection(at(0, 0), at(4, 0), world, 128)
    expect(direction).toBeNull()
  })

  it('returns null when already adjacent to the player', () => {
    const world = makeWorld([])
    const direction = findDetourDirection(at(0, 0), at(1, 0), world)
    expect(direction).toBeNull()
  })

  it('finds the open side of an L-shaped wall', () => {
    // Wall east of the mob and wall north — the route must go south first.
    const walls: Array<readonly [number, number, number]> = []
    for (let z = -1; z <= 3; z++) walls.push([1, 64, z], [1, 65, z])
    for (let x = 1; x <= 3; x++) walls.push([x, 64, -1], [x, 65, -1])
    const world = makeWorld(walls)
    const direction = findDetourDirection(at(0, 0), at(3, 1), world)
    expect(direction).not.toBeNull()
  })
})
