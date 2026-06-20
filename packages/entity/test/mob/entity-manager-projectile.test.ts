import { describe } from '@effect/vitest'
import { expect, it as plainIt } from 'vitest'
import { EntityId, EntityType } from '@ts-minecraft/entity/domain/mob/entity';
import { isShotPathBlocked, makeSkeletonShotSourcePosition, makeSkeletonShotTargetPosition } from '../../application/mob/entity-manager-projectile'
import { makeTestManagedEntity } from './test-utils'

describe('entity/entityManagerProjectile', () => {
  plainIt('builds the skeleton shot source and target positions with the expected offsets', () => {
    const entity = makeTestManagedEntity({
      entityId: EntityId.make('entity-skeleton-projectile-source'),
      type: EntityType.Skeleton,
      position: { x: 2, y: 64, z: -3 },
    })

    expect(makeSkeletonShotSourcePosition(entity)).toEqual({ x: 2, y: 65.6, z: -3 })
    expect(makeSkeletonShotTargetPosition({ x: 10, y: 64, z: 4 })).toEqual({ x: 10, y: 65, z: 4 })
  })

  plainIt('detects a blocked sample along the projectile path', () => {
    const isBlocked = (position: { x: number; y: number; z: number }) =>
      Math.floor(position.x) === 5
      && Math.floor(position.y) === 65
      && Math.floor(position.z) === 0

    expect(
      isShotPathBlocked(
        { x: 0, y: 65.6, z: 0 },
        { x: 10, y: 65, z: 0 },
        isBlocked,
      ),
    ).toBe(true)
  })

  plainIt('ignores zero-length projectile paths', () => {
    expect(
      isShotPathBlocked(
        { x: 0, y: 65.6, z: 0 },
        { x: 0, y: 65.6, z: 0 },
        () => true,
      ),
    ).toBe(false)
  })
})
