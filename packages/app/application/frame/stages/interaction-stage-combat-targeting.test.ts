import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import * as THREE from 'three'
import { EntityId } from '@ts-minecraft/entity/domain/mob/entity'
import { hasAttackableTargetInCombatRange } from './interaction-stage-combat-targeting'

const makeCamera = (px: number, py: number, pz: number, dirX: number, dirY: number, dirZ: number): THREE.PerspectiveCamera => {
  const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
  cam.position.set(px, py, pz)
  cam.getWorldDirection = (target: THREE.Vector3) => {
    target.set(dirX, dirY, dirZ).normalize()
    return target
  }
  return cam
}

describe('hasAttackableTargetInCombatRange', () => {
  it('returns false when no attackable entity is present', () => {
    const cam = makeCamera(0, 65, 0, 0, 0, -1)

    expect(hasAttackableTargetInCombatRange([], cam, null)).toBe(false)
  })

  it('returns true when an entity is within attack range', () => {
    const cam = makeCamera(0, 65, 0, 0, 0, -1)
    const entity = { entityId: EntityId.make('e1'), position: { x: 0, y: 64.1, z: -2 } }

    expect(hasAttackableTargetInCombatRange([entity], cam, null)).toBe(true)
  })

  it('returns false when the entity is out of reach', () => {
    const cam = makeCamera(0, 65, 0, 0, 0, -1)
    const entity = { entityId: EntityId.make('e1'), position: { x: 0, y: 64.1, z: -60 } }

    expect(hasAttackableTargetInCombatRange([entity], cam, null)).toBe(false)
  })
})
