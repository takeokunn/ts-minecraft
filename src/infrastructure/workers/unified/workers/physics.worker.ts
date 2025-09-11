/**
 * Physics Simulation Worker
 * Dedicated worker for physics calculations and collision detection
 */

import { Effect } from 'effect'
import {
  PhysicsSimulationRequest,
  PhysicsSimulationResponse,
  UpdatedBodyState,
  CollisionEvent,
  PhysicsPerformanceMetrics,
  Vector3,
  PhysicsBody,
  vectorOps,
  zeroVector3,
} from '../protocols/physics.protocol'

// Initialize worker capabilities
const workerCapabilities = {
  supportsSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  supportsTransferableObjects: typeof ArrayBuffer !== 'undefined',
  supportsWasm: typeof WebAssembly !== 'undefined',
  maxMemory: 100 * 1024 * 1024, // 100MB for physics
  threadCount: 1,
}

/**
 * Simple physics integration using Euler method
 * In production, you'd use a proper physics engine like Cannon.js or Ammo.js
 */
function integrateBody(body: PhysicsBody, deltaTime: number, gravity: Vector3): UpdatedBodyState {
  if (body.type === 'static') {
    return {
      id: body.id,
      transform: body.transform,
      velocity: body.velocity || zeroVector3(),
      angularVelocity: body.angularVelocity || zeroVector3(),
      isActive: body.isActive,
      isSleeping: body.isSleeping || false,
    }
  }

  // Apply gravity
  const acceleration = body.type === 'dynamic' ? vectorOps.add(gravity, vectorOps.multiply(body.force || zeroVector3(), 1 / body.mass)) : zeroVector3()

  // Update velocity
  const currentVelocity = body.velocity || zeroVector3()
  const newVelocity = vectorOps.add(currentVelocity, vectorOps.multiply(acceleration, deltaTime))

  // Apply damping
  const damping = body.material.damping
  if (damping) {
    const dampedVelocity = vectorOps.multiply(newVelocity, 1 - damping.linear * deltaTime)
    Object.assign(newVelocity, dampedVelocity)
  }

  // Update position
  const displacement = vectorOps.multiply(newVelocity, deltaTime)
  const newPosition = vectorOps.add(body.transform.position, displacement)

  // Angular integration (simplified)
  const currentAngularVel = body.angularVelocity || zeroVector3()
  const angularAcceleration = body.torque ? vectorOps.multiply(body.torque, 1 / body.mass) : zeroVector3()
  const newAngularVelocity = vectorOps.add(currentAngularVel, vectorOps.multiply(angularAcceleration, deltaTime))

  // Apply angular damping
  if (damping) {
    const dampedAngularVel = vectorOps.multiply(newAngularVelocity, 1 - damping.angular * deltaTime)
    Object.assign(newAngularVelocity, dampedAngularVel)
  }

  return {
    id: body.id,
    transform: {
      ...body.transform,
      position: newPosition,
    },
    velocity: newVelocity,
    angularVelocity: newAngularVelocity,
    isActive: vectorOps.length(newVelocity) > 0.001 || vectorOps.length(newAngularVelocity) > 0.001,
    isSleeping: vectorOps.length(newVelocity) < 0.001 && vectorOps.length(newAngularVelocity) < 0.001,
    acceleration,
    angularAcceleration,
    netForce: body.force,
    netTorque: body.torque,
  }
}

/**
 * Simple AABB collision detection
 */
function checkAABBCollision(bodyA: PhysicsBody, bodyB: PhysicsBody): boolean {
  if (bodyA.shape.type !== 'box' || bodyB.shape.type !== 'box') return false

  const posA = bodyA.transform.position
  const posB = bodyB.transform.position
  const extA = bodyA.shape.halfExtents
  const extB = bodyB.shape.halfExtents

  return Math.abs(posA.x - posB.x) < extA.x + extB.x && Math.abs(posA.y - posB.y) < extA.y + extB.y && Math.abs(posA.z - posB.z) < extA.z + extB.z
}

/**
 * Detect collisions between bodies
 */
function detectCollisions(bodies: PhysicsBody[]): CollisionEvent[] {
  const collisions: CollisionEvent[] = []

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const bodyA = bodies[i]
      const bodyB = bodies[j]

      // Skip if collision groups don't match
      if ((bodyA.collisionGroup & bodyB.collisionMask) === 0 || (bodyB.collisionGroup & bodyA.collisionMask) === 0) {
        continue
      }

      if (checkAABBCollision(bodyA, bodyB)) {
        const relativeVelocity = vectorOps.subtract(bodyA.velocity || zeroVector3(), bodyB.velocity || zeroVector3())

        collisions.push({
          bodyA: bodyA.id,
          bodyB: bodyB.id,
          contacts: [
            {
              worldPosition: bodyA.transform.position, // Simplified
              normalOnB: { x: 0, y: 1, z: 0 }, // Simplified
              distance: 0,
              impulse: vectorOps.length(relativeVelocity),
              lateralFriction1: 0,
              lateralFriction2: 0,
            },
          ],
          relativeVelocity,
          separatingVelocity: vectorOps.length(relativeVelocity),
          timestamp: Date.now(),
        })
      }
    }
  }

  return collisions
}

/**
 * Main physics simulation handler
 */
const physicsSimulationHandler = (request: PhysicsSimulationRequest): Effect.Effect<PhysicsSimulationResponse, never, never> =>
  Effect.gen(function* () {
    const startTime = performance.now()

    const { deltaTime, gravity, bodies, options } = request
    const subSteps = request.subSteps || 1
    const subDeltaTime = deltaTime / subSteps

    const updatedBodies: UpdatedBodyState[] = []
    let allCollisions: CollisionEvent[] = []

    // Perform simulation substeps
    for (let step = 0; step < subSteps; step++) {
      // Integration step
      const integrationStart = performance.now()
      const stepBodies = bodies.map((body) => integrateBody(body, subDeltaTime, gravity))
      const integrationTime = performance.now() - integrationStart

      // Collision detection step
      let collisions: CollisionEvent[] = []
      if (options?.enableCollisionDetection) {
        const collisionStart = performance.now()
        collisions = detectCollisions(bodies)
        allCollisions.push(...collisions)
      }

      // Update bodies array for next substep (simplified)
      bodies.forEach((body, i) => {
        const updatedBody = stepBodies[i]
        body.transform = updatedBody.transform
        body.velocity = updatedBody.velocity
        body.angularVelocity = updatedBody.angularVelocity
      })

      if (step === subSteps - 1) {
        updatedBodies.push(...stepBodies)
      }
    }

    const totalTime = performance.now() - startTime

    const metrics: PhysicsPerformanceMetrics = {
      totalTime,
      integrationTime: totalTime * 0.7, // Rough estimate
      collisionDetectionTime: totalTime * 0.2,
      constraintSolvingTime: totalTime * 0.1,
      bodiesSimulated: bodies.length,
      activeBodies: updatedBodies.filter((b) => b.isActive).length,
      sleepingBodies: updatedBodies.filter((b) => b.isSleeping).length,
      collisionPairs: allCollisions.length,
      contactPoints: allCollisions.reduce((sum, c) => sum + c.contacts.length, 0),
      constraintsSolved: 0,
      simulationStability: 1.0, // Simplified
    }

    return {
      updatedBodies,
      collisions: allCollisions,
      metrics,
      simulationTime: totalTime,
      frameNumber: Date.now(), // Simplified
      success: true,
    } as PhysicsSimulationResponse
  })

// Worker message handling
self.onmessage = async (event) => {
  const { id, type, payload, timestamp } = event.data

  if (type === 'capabilities') {
    self.postMessage({
      type: 'ready',
      timestamp: Date.now(),
      capabilities: workerCapabilities,
    })
    return
  }

  if (type === 'request') {
    try {
      const response = await Effect.runPromise(physicsSimulationHandler(payload))

      self.postMessage({
        id,
        type: 'response',
        data: response,
        timestamp: Date.now(),
      })
    } catch (error) {
      self.postMessage({
        id,
        type: 'error',
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        timestamp: Date.now(),
      })
    }
  }
}

// Send ready signal
self.postMessage({
  type: 'ready',
  timestamp: Date.now(),
  capabilities: workerCapabilities,
})
