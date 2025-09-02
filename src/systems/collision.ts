import { Effect } from 'effect'
import { AABB, areAABBsIntersecting, createAABB } from '@/domain/geometry'
import { playerColliderQuery, positionColliderQuery } from '@/domain/queries'
import { SpatialGridService } from '@/runtime/services'
import { World } from '@/runtime/world'

export const collisionSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const spatialGrid = yield* _(SpatialGridService)

  const players = yield* _(world.query(playerColliderQuery))
  const colliders = yield* _(world.query(positionColliderQuery))

  if (players.length === 0) {
    return
  }

  // --- Pre-computation: Create a map for quick collider data lookup ---
  const colliderMap = new Map(colliders.map((c) => [c.entityId, c]))

  // --- Main Loop: Iterate through players ---
  for (const player of players) {
    // --- 1. Read data into local variables ---
    const {
      entityId: playerId,
      position: { x: posX, y: posY, z: posZ },
      velocity: { dx: velX, dy: velY, dz: velZ },
      collider: { width: colW, height: colH, depth: colD },
    } = player

    // --- 2. Broad-phase: Query spatial grid for nearby colliders ---
    const broadphaseAABB = createAABB(
      { x: posX + velX / 2, y: posY + velY / 2, z: posZ + velZ / 2 },
      { width: colW + Math.abs(velX), height: colH + Math.abs(velY), depth: colD + Math.abs(velZ) },
    )
    const nearbyEntityIds = yield* _(spatialGrid.query(broadphaseAABB))

    const nearbyAABBs: AABB[] = []
    for (const nearbyId of nearbyEntityIds) {
      if (nearbyId === playerId) continue
      const collider = colliderMap.get(nearbyId)
      if (collider) {
        nearbyAABBs.push(createAABB(collider.position, collider.collider))
      }
    }

    // --- 3. Narrow-phase: Resolve collisions axis by axis ---
    let newPosX = posX
    let newPosY = posY
    let newPosZ = posZ
    let newVelX = velX
    let newVelY = velY
    let newVelZ = velZ
    let isGrounded = false

    // Y-axis
    let playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
    for (const blockAABB of nearbyAABBs) {
      if (areAABBsIntersecting(playerAABB, blockAABB)) {
        if (velY > 0) {
          newPosY = blockAABB.minY - colH / 2
        } else if (velY < 0) {
          newPosY = blockAABB.maxY + colH / 2
          isGrounded = true
        }
        newVelY = 0
        playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
      }
    }

    // X-axis
    playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
    for (const blockAABB of nearbyAABBs) {
      if (areAABBsIntersecting(playerAABB, blockAABB)) {
        if (velX > 0) {
          newPosX = blockAABB.minX - colW / 2
        } else if (velX < 0) {
          newPosX = blockAABB.maxX + colW / 2
        }
        newVelX = 0
        playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
      }
    }

    // Z-axis
    playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
    for (const blockAABB of nearbyAABBs) {
      if (areAABBsIntersecting(playerAABB, blockAABB)) {
        if (velZ > 0) {
          newPosZ = blockAABB.minZ - colD / 2
        } else if (velZ < 0) {
          newPosZ = blockAABB.maxZ + colD / 2
        }
        newVelZ = 0
      }
    }

    // --- 4. Write results back to components ---
    yield* _(
      world.updateComponent(playerId, 'position', {
        ...player.position,
        x: newPosX,
        y: newPosY,
        z: newPosZ,
      }),
    )
    yield* _(
      world.updateComponent(playerId, 'velocity', {
        ...player.velocity,
        dx: newVelX,
        dy: newVelY,
        dz: newVelZ,
      }),
    )
    yield* _(world.updateComponent(playerId, 'player', { ...player.player, isGrounded }))
  }
})
