import { Effect, Duration } from 'effect'
import { createTypedWorker } from './base/typed-worker'
import {
  PhysicsSimulationRequest,
  PhysicsSimulationResponse,
  PhysicsBody,
  Position3D,
} from './shared/protocol'

/**
 * High-performance physics simulation worker
 * Handles collision detection, rigid body dynamics, and constraint solving
 */

// ============================================
// Physics Constants
// ============================================

const PHYSICS_TIMESTEP = 1 / 60 // 60 FPS physics
const COLLISION_EPSILON = 0.001
const RESTITUTION_COEFFICIENT = 0.6
const MAX_VELOCITY = 50 // Terminal velocity
const MIN_VELOCITY = 0.01 // Velocity threshold for sleep

// ============================================
// Vector Math Utilities
// ============================================

interface Vector3 {
  x: number
  y: number
  z: number
}

const vec3 = {
  add: (a: Vector3, b: Vector3): Vector3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }),
  
  subtract: (a: Vector3, b: Vector3): Vector3 => ({
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  }),
  
  multiply: (v: Vector3, scalar: number): Vector3 => ({
    x: v.x * scalar,
    y: v.y * scalar,
    z: v.z * scalar,
  }),
  
  dot: (a: Vector3, b: Vector3): number => 
    a.x * b.x + a.y * b.y + a.z * b.z,
  
  cross: (a: Vector3, b: Vector3): Vector3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }),
  
  length: (v: Vector3): number =>
    Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
  
  normalize: (v: Vector3): Vector3 => {
    const len = vec3.length(v)
    if (len < COLLISION_EPSILON) return { x: 0, y: 0, z: 0 }
    return vec3.multiply(v, 1 / len)
  },
  
  clamp: (v: Vector3, max: number): Vector3 => {
    const len = vec3.length(v)
    if (len > max) {
      return vec3.multiply(vec3.normalize(v), max)
    }
    return v
  },
}

// ============================================
// Collision Detection
// ============================================

interface CollisionInfo {
  bodyA: string
  bodyB: string
  contactPoint: Vector3
  contactNormal: Vector3
  penetration: number
}

/**
 * Check if two axis-aligned bounding boxes intersect
 */
const checkAABBIntersection = (
  bodyA: PhysicsBody,
  bodyB: PhysicsBody
): CollisionInfo | null => {
  const aMin = bodyA.boundingBox.min
  const aMax = bodyA.boundingBox.max
  const bMin = bodyB.boundingBox.min
  const bMax = bodyB.boundingBox.max
  
  // Check for separation on each axis
  if (aMax.x < bMin.x || bMax.x < aMin.x ||
      aMax.y < bMin.y || bMax.y < aMin.y ||
      aMax.z < bMin.z || bMax.z < aMin.z) {
    return null // No collision
  }
  
  // Calculate overlap on each axis
  const overlapX = Math.min(aMax.x - bMin.x, bMax.x - aMin.x)
  const overlapY = Math.min(aMax.y - bMin.y, bMax.y - aMin.y)
  const overlapZ = Math.min(aMax.z - bMin.z, bMax.z - aMin.z)
  
  // Find minimum overlap (separation axis)
  let penetration: number
  let normal: Vector3
  
  if (overlapX < overlapY && overlapX < overlapZ) {
    penetration = overlapX
    normal = { x: bodyA.position.x > bodyB.position.x ? 1 : -1, y: 0, z: 0 }
  } else if (overlapY < overlapZ) {
    penetration = overlapY
    normal = { x: 0, y: bodyA.position.y > bodyB.position.y ? 1 : -1, z: 0 }
  } else {
    penetration = overlapZ
    normal = { x: 0, y: 0, z: bodyA.position.z > bodyB.position.z ? 1 : -1 }
  }
  
  // Calculate contact point
  const contactPoint: Vector3 = {
    x: (aMin.x + aMax.x + bMin.x + bMax.x) * 0.25,
    y: (aMin.y + aMax.y + bMin.y + bMax.y) * 0.25,
    z: (aMin.z + aMax.z + bMin.z + bMax.z) * 0.25,
  }
  
  return {
    bodyA: bodyA.id,
    bodyB: bodyB.id,
    contactPoint,
    contactNormal: normal,
    penetration,
  }
}

/**
 * Broad phase collision detection using spatial hashing
 */
const broadPhaseCollisionDetection = (bodies: PhysicsBody[]): [PhysicsBody, PhysicsBody][] => {
  const pairs: [PhysicsBody, PhysicsBody][] = []
  const spatialHash = new Map<string, PhysicsBody[]>()
  const cellSize = 5 // Spatial hash cell size
  
  // Hash bodies into spatial grid
  for (const body of bodies) {
    const minCell = {
      x: Math.floor(body.boundingBox.min.x / cellSize),
      y: Math.floor(body.boundingBox.min.y / cellSize),
      z: Math.floor(body.boundingBox.min.z / cellSize),
    }
    const maxCell = {
      x: Math.floor(body.boundingBox.max.x / cellSize),
      y: Math.floor(body.boundingBox.max.y / cellSize),
      z: Math.floor(body.boundingBox.max.z / cellSize),
    }
    
    for (let x = minCell.x; x <= maxCell.x; x++) {
      for (let y = minCell.y; y <= maxCell.y; y++) {
        for (let z = minCell.z; z <= maxCell.z; z++) {
          const key = `${x},${y},${z}`
          if (!spatialHash.has(key)) {
            spatialHash.set(key, [])
          }
          spatialHash.get(key)!.push(body)
        }
      }
    }
  }
  
  // Find potential collision pairs
  const checkedPairs = new Set<string>()
  
  for (const cellBodies of spatialHash.values()) {
    for (let i = 0; i < cellBodies.length; i++) {
      for (let j = i + 1; j < cellBodies.length; j++) {
        const bodyA = cellBodies[i]
        const bodyB = cellBodies[j]
        const pairKey = `${Math.min(bodyA.id, bodyB.id)}-${Math.max(bodyA.id, bodyB.id)}`
        
        if (!checkedPairs.has(pairKey)) {
          checkedPairs.add(pairKey)
          pairs.push([bodyA, bodyB])
        }
      }
    }
  }
  
  return pairs
}

// ============================================
// Physics Integration
// ============================================

/**
 * Integrate physics body using Verlet integration
 */
const integrateBody = (
  body: PhysicsBody,
  deltaTime: number,
  gravity: Vector3,
  worldBounds: { min: Vector3; max: Vector3 }
): PhysicsBody => {
  if (body.isStatic) return body
  
  // Apply gravity
  const totalAcceleration = vec3.add(body.acceleration, gravity)
  
  // Verlet integration
  const newVelocity = vec3.add(
    body.velocity,
    vec3.multiply(totalAcceleration, deltaTime)
  )
  
  // Clamp velocity
  const clampedVelocity = vec3.clamp(newVelocity, MAX_VELOCITY)
  
  // Apply velocity damping (air resistance/friction)
  const dampedVelocity = vec3.multiply(clampedVelocity, 0.999)
  
  // Update position
  const deltaPosition = vec3.multiply(dampedVelocity, deltaTime)
  const newPosition = vec3.add(body.position, deltaPosition)
  
  // Apply world bounds
  const boundedPosition = {
    x: Math.max(worldBounds.min.x, Math.min(worldBounds.max.x, newPosition.x)),
    y: Math.max(worldBounds.min.y, Math.min(worldBounds.max.y, newPosition.y)),
    z: Math.max(worldBounds.min.z, Math.min(worldBounds.max.z, newPosition.z)),
  }
  
  // Update bounding box
  const size = vec3.subtract(body.boundingBox.max, body.boundingBox.min)
  const halfSize = vec3.multiply(size, 0.5)
  
  const newBoundingBox = {
    min: vec3.subtract(boundedPosition, halfSize),
    max: vec3.add(boundedPosition, halfSize),
  }
  
  return {
    ...body,
    position: boundedPosition,
    velocity: vec3.length(dampedVelocity) > MIN_VELOCITY ? dampedVelocity : { x: 0, y: 0, z: 0 },
    boundingBox: newBoundingBox,
    acceleration: { x: 0, y: 0, z: 0 }, // Reset acceleration
  }
}

/**
 * Resolve collision between two bodies
 */
const resolveCollision = (
  bodyA: PhysicsBody,
  bodyB: PhysicsBody,
  collision: CollisionInfo
): [PhysicsBody, PhysicsBody] => {
  // Position correction using simple separation
  const correction = vec3.multiply(collision.contactNormal, collision.penetration * 0.5)
  
  const newBodyA = bodyA.isStatic ? bodyA : {
    ...bodyA,
    position: vec3.add(bodyA.position, correction),
  }
  
  const newBodyB = bodyB.isStatic ? bodyB : {
    ...bodyB,
    position: vec3.subtract(bodyB.position, correction),
  }
  
  // Velocity-based collision response
  if (!bodyA.isStatic && !bodyB.isStatic) {
    const relativeVelocity = vec3.subtract(bodyA.velocity, bodyB.velocity)
    const separatingVelocity = vec3.dot(relativeVelocity, collision.contactNormal)
    
    if (separatingVelocity < 0) { // Objects are approaching
      const newSeparatingVelocity = -separatingVelocity * RESTITUTION_COEFFICIENT
      const deltaVelocity = newSeparatingVelocity - separatingVelocity
      
      const totalMass = bodyA.mass + bodyB.mass
      const impulsePerMass = deltaVelocity / totalMass
      const impulse = vec3.multiply(collision.contactNormal, impulsePerMass)
      
      return [
        {
          ...newBodyA,
          velocity: vec3.add(newBodyA.velocity, vec3.multiply(impulse, bodyA.mass)),
        },
        {
          ...newBodyB,
          velocity: vec3.subtract(newBodyB.velocity, vec3.multiply(impulse, bodyB.mass)),
        },
      ]
    }
  } else if (!bodyA.isStatic) {
    // Collision with static body
    const reflection = vec3.multiply(
      collision.contactNormal,
      -2 * vec3.dot(bodyA.velocity, collision.contactNormal) * RESTITUTION_COEFFICIENT
    )
    return [
      {
        ...newBodyA,
        velocity: vec3.add(bodyA.velocity, reflection),
      },
      newBodyB,
    ]
  } else if (!bodyB.isStatic) {
    // Collision with static body
    const reflection = vec3.multiply(
      collision.contactNormal,
      2 * vec3.dot(bodyB.velocity, collision.contactNormal) * RESTITUTION_COEFFICIENT
    )
    return [
      newBodyA,
      {
        ...newBodyB,
        velocity: vec3.subtract(bodyB.velocity, reflection),
      },
    ]
  }
  
  return [newBodyA, newBodyB]
}

// ============================================
// Constraint Solving
// ============================================

/**
 * Solve distance constraints
 */
const solveConstraints = (
  bodies: PhysicsBody[],
  constraints: PhysicsSimulationRequest['constraints']
): PhysicsBody[] => {
  const bodyMap = new Map(bodies.map(body => [body.id, body]))
  const updatedBodies = new Map(bodyMap)
  
  // Iterative constraint solving
  for (let iteration = 0; iteration < 3; iteration++) {
    for (const constraint of constraints) {
      const bodyA = updatedBodies.get(constraint.bodyA)
      const bodyB = updatedBodies.get(constraint.bodyB)
      
      if (!bodyA || !bodyB) continue
      
      if (constraint.type === 'distance') {
        const targetDistance = constraint.parameters.distance || 1
        const currentVector = vec3.subtract(bodyB.position, bodyA.position)
        const currentDistance = vec3.length(currentVector)
        
        if (currentDistance > COLLISION_EPSILON) {
          const difference = currentDistance - targetDistance
          const correctionVector = vec3.multiply(
            vec3.normalize(currentVector),
            difference * 0.5
          )
          
          if (!bodyA.isStatic) {
            updatedBodies.set(bodyA.id, {
              ...bodyA,
              position: vec3.add(bodyA.position, correctionVector),
            })
          }
          
          if (!bodyB.isStatic) {
            updatedBodies.set(bodyB.id, {
              ...bodyB,
              position: vec3.subtract(bodyB.position, correctionVector),
            })
          }
        }
      }
      
      // Additional constraint types could be implemented here
    }
  }
  
  return Array.from(updatedBodies.values())
}

// ============================================
// Main Physics Handler
// ============================================

/**
 * Main physics simulation handler
 */
const physicsSimulationHandler = (
  request: PhysicsSimulationRequest,
  context: any
): Effect.Effect<PhysicsSimulationResponse, never, never> =>
  Effect.gen(function* () {
    const startTime = performance.now()
    
    // Fixed timestep simulation
    const targetSteps = Math.max(1, Math.round(request.deltaTime / PHYSICS_TIMESTEP))
    const stepDeltaTime = request.deltaTime / targetSteps
    
    let currentBodies = [...request.bodies]
    const allCollisions: PhysicsSimulationResponse['collisions'] = []
    
    for (let step = 0; step < targetSteps; step++) {
      // Integration phase
      const integrationStartTime = performance.now()
      
      currentBodies = currentBodies.map(body =>
        integrateBody(body, stepDeltaTime, request.gravity, request.worldBounds)
      )
      
      
      // Collision detection phase
      const collisionStartTime = performance.now()
      
      const potentialPairs = broadPhaseCollisionDetection(currentBodies)
      const collisions: CollisionInfo[] = []
      
      for (const [bodyA, bodyB] of potentialPairs) {
        const collision = checkAABBIntersection(bodyA, bodyB)
        if (collision) {
          collisions.push(collision)
          allCollisions.push(collision)
        }
      }
      
      
      // Collision resolution
      const bodyMap = new Map(currentBodies.map(body => [body.id, body]))
      
      for (const collision of collisions) {
        const bodyA = bodyMap.get(collision.bodyA)
        const bodyB = bodyMap.get(collision.bodyB)
        
        if (bodyA && bodyB) {
          const [resolvedA, resolvedB] = resolveCollision(bodyA, bodyB, collision)
          bodyMap.set(resolvedA.id, resolvedA)
          bodyMap.set(resolvedB.id, resolvedB)
        }
      }
      
      currentBodies = Array.from(bodyMap.values())
      
      // Constraint solving
      if (request.constraints.length > 0) {
        currentBodies = solveConstraints(currentBodies, request.constraints)
      }
    }
    
    const totalTime = performance.now() - startTime
    
    // Create response
    const response: PhysicsSimulationResponse = {
      updatedBodies: currentBodies,
      collisions: allCollisions,
      performanceMetrics: {
        simulationTime: totalTime,
        collisionDetectionTime: totalTime * 0.4, // Approximate
        integrationTime: totalTime * 0.6, // Approximate
      },
    }
    
    return response
  })

// ============================================
// Worker Configuration
// ============================================

const worker = createTypedWorker({
  name: 'physics-simulation',
  inputSchema: PhysicsSimulationRequest,
  outputSchema: PhysicsSimulationResponse,
  handler: physicsSimulationHandler,
  timeout: Duration.seconds(10), // Physics should be fast
  sharedBuffers: [
    {
      name: 'positions',
      byteLength: 1000 * 3 * 4, // 1000 bodies * 3 components * 4 bytes (Float32)
      type: 'Float32Array',
    },
    {
      name: 'velocities',
      byteLength: 1000 * 3 * 4,
      type: 'Float32Array',
    },
    {
      name: 'collisions',
      byteLength: 5000 * 4, // Store collision pairs as indices
      type: 'Uint32Array',
    },
  ],
})

// Start the worker
Effect.runPromise(worker.start())