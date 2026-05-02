import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import * as THREE from 'three'
import { EntityId } from '@ts-minecraft/entities'
import { findAttackableEntity } from './attack-targeting'

const makeCamera = (px: number, py: number, pz: number, dirX: number, dirY: number, dirZ: number): THREE.PerspectiveCamera => {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.position.set(px, py, pz)
  cam.getWorldDirection = (target: THREE.Vector3) => {
    target.set(dirX, dirY, dirZ).normalize()
    return target
  }
  return cam
}

describe('findAttackableEntity', () => {
  it('returns none when entity list is empty', () => {
    const cam = makeCamera(0, 65, 0, 0, 0, -1)
    const result = findAttackableEntity([], cam, Option.none())
    expect(Option.isNone(result)).toBe(true)
  })

  it('returns the entity id when one entity is in range', () => {
    const cam = makeCamera(0, 65, 0, 0, 0, -1)
    const entity = { entityId: EntityId.make('e1'), position: { x: 0, y: 64.1, z: -2 } }
    const result = findAttackableEntity([entity], cam, Option.none())
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe(entity.entityId)
  })

  it('returns none when entity is behind the camera', () => {
    const cam = makeCamera(0, 65, 0, 0, 0, -1)
    // behind camera: positive z
    const entity = { entityId: EntityId.make('e1'), position: { x: 0, y: 64.1, z: 2 } }
    const result = findAttackableEntity([entity], cam, Option.none())
    expect(Option.isNone(result)).toBe(true)
  })

  it('selects the CLOSER of two entities in range (covers the alongRay < best.dist replacement branch)', () => {
    const cam = makeCamera(0, 65, 0, 0, 0, -1)
    // Farther entity along ray: z = -3 → alongRay ≈ 3
    const far = { entityId: EntityId.make('far'), position: { x: 0, y: 64.1, z: -3 } }
    // Closer entity along ray: z = -1.5 → alongRay ≈ 1.5
    const close = { entityId: EntityId.make('close'), position: { x: 0, y: 64.1, z: -1.5 } }
    // Pass far first so the first iteration sets best={far}, then second iteration triggers the replacement
    const result = findAttackableEntity([far, close], cam, Option.none())
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrThrow(result)).toBe(close.entityId)
  })

  it('respects maxDistance and excludes entities beyond it', () => {
    const cam = makeCamera(0, 65, 0, 0, 0, -1)
    // entity at z=-5, alongRay≈5 > maxDistance=3
    const entity = { entityId: EntityId.make('e1'), position: { x: 0, y: 64.1, z: -5 } }
    const result = findAttackableEntity([entity], cam, Option.some(3))
    expect(Option.isNone(result)).toBe(true)
  })
})
