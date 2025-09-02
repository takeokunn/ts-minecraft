import { Effect } from 'effect'
import { AABB, areAABBsIntersecting, createAABB } from '@/domain/geometry'
import { playerColliderQuery, positionColliderQuery } from '@/domain/queries'
import { SpatialGridService } from '@/runtime/services'
import { World } from '@/runtime/world'
import { EntityId } from '@/domain/entity'

export const collisionSystem = Effect.gen(function* (_) {
  const world = yield* _(World)
  const spatialGrid = yield* _(SpatialGridService)

  const players = yield* _(world.querySoA(playerColliderQuery))
  const colliders = yield* _(world.querySoA(positionColliderQuery))

  if (players.entities.length === 0) {
    return
  }

  // --- Pre-computation: Create a map for quick collider data lookup ---
  const colliderIndexMap = new Map<EntityId, number>()
  for (let i = 0; i < colliders.entities.length; i++) {
    const entityId = colliders.entities[i]
    if (entityId) {
      colliderIndexMap.set(entityId, i)
    }
  }

  // --- Main Loop: Iterate through players ---
  for (let i = 0; i < players.entities.length; i++) {
    // --- 1. Read data into local variables and apply type guard ---
    const playerId = players.entities[i]
    const posX = players.position.x[i]
    const posY = players.position.y[i]
    const posZ = players.position.z[i]
    const velX = players.velocity.dx[i]
    const velY = players.velocity.dy[i]
    const velZ = players.velocity.dz[i]
    const colW = players.collider.width[i]
    const colH = players.collider.height[i]
    const colD = players.collider.depth[i]

    if (
      playerId === undefined ||
      posX === undefined ||
      posY === undefined ||
      posZ === undefined ||
      velX === undefined ||
      velY === undefined ||
      velZ === undefined ||
      colW === undefined ||
      colH === undefined ||
      colD === undefined
    ) {
      continue
    }

    // --- 2. Broad-phase: Query spatial grid for nearby colliders ---
    const broadphaseAABB = createAABB(
      { x: posX + velX / 2, y: posY + velY / 2, z: posZ + velZ / 2 },
      { width: colW + Math.abs(velX), height: colH + Math.abs(velY), depth: colD + Math.abs(velZ) },
    )
    const nearbyEntityIds = yield* _(spatialGrid.query(broadphaseAABB))

    const nearbyAABBs: AABB[] = []
    for (const nearbyId of nearbyEntityIds) {
      if (nearbyId === playerId) continue
      const colliderIndex = colliderIndexMap.get(nearbyId)
      if (colliderIndex !== undefined) {
        const cPosX = colliders.position.x[colliderIndex]
        const cPosY = colliders.position.y[colliderIndex]
        const cPosZ = colliders.position.z[colliderIndex]
        const cColW = colliders.collider.width[colliderIndex]
        const cColH = colliders.collider.height[colliderIndex]
        const cColD = colliders.collider.depth[colliderIndex]

        if (cPosX !== undefined && cPosY !== undefined && cPosZ !== undefined && cColW !== undefined && cColH !== undefined && cColD !== undefined) {
          nearbyAABBs.push(createAABB({ x: cPosX, y: cPosY, z: cPosZ }, { width: cColW, height: cColH, depth: cColD }))
        }
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
    newPosY += newVelY
    let playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
    for (const blockAABB of nearbyAABBs) {
      if (areAABBsIntersecting(playerAABB, blockAABB)) {
        if (newVelY > 0) {
          newPosY = blockAABB.minY - colH
        } else {
          newPosY = blockAABB.maxY
          isGrounded = true
        }
        newVelY = 0
        playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
      }
    }

    // X-axis
    newPosX += newVelX
    playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
    for (const blockAABB of nearbyAABBs) {
      if (areAABBsIntersecting(playerAABB, blockAABB)) {
        if (newVelX > 0) {
          newPosX = blockAABB.minX - colW / 2
        } else {
          newPosX = blockAABB.maxX + colW / 2
        }
        newVelX = 0
        playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
      }
    }

    // Z-axis
    newPosZ += newVelZ
    playerAABB = createAABB({ x: newPosX, y: newPosY, z: newPosZ }, { width: colW, height: colH, depth: colD })
    for (const blockAABB of nearbyAABBs) {
      if (areAABBsIntersecting(playerAABB, blockAABB)) {
        if (newVelZ > 0) {
          newPosZ = blockAABB.minZ - colD / 2
        } else {
          newPosZ = blockAABB.maxZ + colD / 2
        }
        newVelZ = 0
      }
    }

    // --- 4. Write results back to SoA arrays ---
    players.position.x[i] = newPosX
    players.position.y[i] = newPosY
    players.position.z[i] = newPosZ
    players.velocity.dx[i] = newVelX
    players.velocity.dy[i] = newVelY
    players.velocity.dz[i] = newVelZ
    players.player.isGrounded[i] = isGrounded
  }
})
