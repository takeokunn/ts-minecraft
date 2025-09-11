import * as S from "effect/Schema"

/**
 * Physics Simulation Protocol
 * Type-safe message schemas for physics worker communication
 */

// ============================================
// Base Physics Types
// ============================================

/**
 * 3D Vector with validation
 */
export const Vector3 = S.Struct({
  x: S.Number.pipe(S.finite),
  y: S.Number.pipe(S.finite),
  z: S.Number.pipe(S.finite)
}).pipe(S.identifier('Vector3'))
export type Vector3 = S.Schema.Type<typeof Vector3>

/**
 * Quaternion for rotations
 */
export const Quaternion = S.Struct({
  x: S.Number.pipe(S.finite),
  y: S.Number.pipe(S.finite),
  z: S.Number.pipe(S.finite),
  w: S.Number.pipe(S.finite)
}).pipe(S.identifier('Quaternion'))
export type Quaternion = S.Schema.Type<typeof Quaternion>

/**
 * Transform data
 */
export const Transform = S.Struct({
  position: Vector3,
  rotation: Quaternion,
  scale: S.optional(Vector3)
}).pipe(S.identifier('Transform'))
export type Transform = S.Schema.Type<typeof Transform>

/**
 * Bounding box
 */
export const BoundingBox = S.Struct({
  min: Vector3,
  max: Vector3
}).pipe(S.identifier('BoundingBox'))
export type BoundingBox = S.Schema.Type<typeof BoundingBox>

/**
 * Bounding sphere
 */
export const BoundingSphere = S.Struct({
  center: Vector3,
  radius: S.Number.pipe(S.positive)
}).pipe(S.identifier('BoundingSphere'))
export type BoundingSphere = S.Schema.Type<typeof BoundingSphere>

// ============================================
// Physics Body Types
// ============================================

/**
 * Body type enumeration
 */
export const BodyType = S.Union(
  S.Literal('static'),
  S.Literal('kinematic'),
  S.Literal('dynamic'),
  S.Literal('ghost'),
  S.Literal('trigger')
).pipe(S.identifier('BodyType'))
export type BodyType = S.Schema.Type<typeof BodyType>

/**
 * Collision shape types
 */
export const CollisionShape = S.Union(
  S.Struct({
    type: S.Literal('box'),
    halfExtents: Vector3
  }),
  S.Struct({
    type: S.Literal('sphere'),
    radius: S.Number.pipe(S.positive)
  }),
  S.Struct({
    type: S.Literal('capsule'),
    radius: S.Number.pipe(S.positive),
    height: S.Number.pipe(S.positive)
  }),
  S.Struct({
    type: S.Literal('cylinder'),
    radius: S.Number.pipe(S.positive),
    height: S.Number.pipe(S.positive)
  }),
  S.Struct({
    type: S.Literal('cone'),
    radius: S.Number.pipe(S.positive),
    height: S.Number.pipe(S.positive)
  }),
  S.Struct({
    type: S.Literal('mesh'),
    vertices: S.Array(S.Number),
    indices: S.Array(S.Number.pipe(S.int(), S.nonNegative))
  }),
  S.Struct({
    type: S.Literal('heightfield'),
    width: S.Number.pipe(S.int(), S.positive),
    height: S.Number.pipe(S.int(), S.positive),
    heights: S.Array(S.Number),
    scale: S.optional(Vector3)
  })
).pipe(S.identifier('CollisionShape'))
export type CollisionShape = S.Schema.Type<typeof CollisionShape>

/**
 * Material properties
 */
export const PhysicsMaterial = S.Struct({
  friction: S.Number.pipe(S.between(0, 1)),
  restitution: S.Number.pipe(S.between(0, 1)),
  density: S.Number.pipe(S.positive),
  damping: S.optional(S.Struct({
    linear: S.Number.pipe(S.between(0, 1)),
    angular: S.Number.pipe(S.between(0, 1))
  })),
  surfaceVelocity: S.optional(Vector3)
}).pipe(S.identifier('PhysicsMaterial'))
export type PhysicsMaterial = S.Schema.Type<typeof PhysicsMaterial>

/**
 * Physics body definition
 */
export const PhysicsBody = S.Struct({
  // Identification
  id: S.String,
  group: S.optional(S.String),
  tags: S.optional(S.Array(S.String)),
  
  // Transform
  transform: Transform,
  
  // Physics properties
  type: BodyType,
  mass: S.Number.pipe(S.nonNegative),
  material: PhysicsMaterial,
  
  // Collision
  shape: CollisionShape,
  collisionGroup: S.Number.pipe(S.int(), S.nonNegative),
  collisionMask: S.Number.pipe(S.int(), S.nonNegative),
  
  // Motion
  velocity: S.optional(Vector3),
  angularVelocity: S.optional(Vector3),
  
  // Forces
  force: S.optional(Vector3),
  torque: S.optional(Vector3),
  
  // Constraints
  constraints: S.optional(S.Struct({
    freezeRotation: S.optional(S.Boolean),
    freezePosition: S.optional(S.Struct({
      x: S.Boolean,
      y: S.Boolean,
      z: S.Boolean
    }))
  })),
  
  // State
  isActive: S.Boolean,
  isSleeping: S.optional(S.Boolean),
  
  // User data
  userData: S.optional(S.Unknown)
}).pipe(S.identifier('PhysicsBody'))
export type PhysicsBody = S.Schema.Type<typeof PhysicsBody>

// ============================================
// Constraints and Joints
// ============================================

/**
 * Constraint types
 */
export const ConstraintType = S.Union(
  S.Literal('point_to_point'),
  S.Literal('hinge'),
  S.Literal('slider'),
  S.Literal('cone_twist'),
  S.Literal('generic_6dof'),
  S.Literal('spring'),
  S.Literal('distance'),
  S.Literal('rope')
).pipe(S.identifier('ConstraintType'))
export type ConstraintType = S.Schema.Type<typeof ConstraintType>

/**
 * Generic constraint definition
 */
export const PhysicsConstraint = S.Union(
  S.Struct({
    type: S.Literal('point_to_point'),
    bodyA: S.String,
    bodyB: S.String,
    pivotA: Vector3,
    pivotB: Vector3
  }),
  S.Struct({
    type: S.Literal('hinge'),
    bodyA: S.String,
    bodyB: S.String,
    pivotA: Vector3,
    pivotB: Vector3,
    axisA: Vector3,
    axisB: Vector3,
    limits: S.optional(S.Struct({
      low: S.Number,
      high: S.Number
    }))
  }),
  S.Struct({
    type: S.Literal('slider'),
    bodyA: S.String,
    bodyB: S.String,
    frameA: Transform,
    frameB: Transform,
    lowerLimit: S.optional(S.Number),
    upperLimit: S.optional(S.Number)
  }),
  S.Struct({
    type: S.Literal('spring'),
    bodyA: S.String,
    bodyB: S.String,
    anchorA: Vector3,
    anchorB: Vector3,
    stiffness: S.Number.pipe(S.positive),
    damping: S.Number.pipe(S.nonNegative),
    restLength: S.Number.pipe(S.positive)
  }),
  S.Struct({
    type: S.Literal('distance'),
    bodyA: S.String,
    bodyB: S.String,
    anchorA: Vector3,
    anchorB: Vector3,
    distance: S.Number.pipe(S.positive),
    tolerance: S.optional(S.Number.pipe(S.positive))
  })
).pipe(S.identifier('PhysicsConstraint'))
export type PhysicsConstraint = S.Schema.Type<typeof PhysicsConstraint>

// ============================================
// Forces and Effects
// ============================================

/**
 * Force types
 */
export const ForceType = S.Union(
  S.Literal('impulse'),
  S.Literal('force'),
  S.Literal('velocity_change'),
  S.Literal('acceleration')
).pipe(S.identifier('ForceType'))
export type ForceType = S.Schema.Type<typeof ForceType>

/**
 * Force application
 */
export const ForceApplication = S.Struct({
  bodyId: S.String,
  type: ForceType,
  vector: Vector3,
  point: S.optional(Vector3), // Local point of application
  duration: S.optional(S.Number.pipe(S.positive)) // For temporary forces
}).pipe(S.identifier('ForceApplication'))
export type ForceApplication = S.Schema.Type<typeof ForceApplication>

/**
 * Physics field/effect (gravity, wind, etc.)
 */
export const PhysicsField = S.Struct({
  id: S.String,
  type: S.Union(
    S.Literal('gravity'),
    S.Literal('wind'),
    S.Literal('magnetic'),
    S.Literal('buoyancy'),
    S.Literal('drag')
  ),
  
  // Field properties
  strength: S.Number,
  direction: Vector3,
  
  // Spatial constraints
  bounds: S.optional(BoundingBox),
  falloff: S.optional(S.Union(
    S.Literal('linear'),
    S.Literal('quadratic'),
    S.Literal('exponential'),
    S.Literal('constant')
  )),
  
  // Time properties
  isActive: S.Boolean,
  duration: S.optional(S.Number.pipe(S.positive))
}).pipe(S.identifier('PhysicsField'))
export type PhysicsField = S.Schema.Type<typeof PhysicsField>

// ============================================
// Collision Detection
// ============================================

/**
 * Contact point data
 */
export const ContactPoint = S.Struct({
  worldPosition: Vector3,
  normalOnB: Vector3,
  distance: S.Number,
  impulse: S.Number,
  lateralFriction1: S.Number,
  lateralFriction2: S.Number
}).pipe(S.identifier('ContactPoint'))
export type ContactPoint = S.Schema.Type<typeof ContactPoint>

/**
 * Collision event
 */
export const CollisionEvent = S.Struct({
  bodyA: S.String,
  bodyB: S.String,
  contacts: S.Array(ContactPoint),
  relativeVelocity: Vector3,
  separatingVelocity: S.Number,
  timestamp: S.Number.pipe(S.positive)
}).pipe(S.identifier('CollisionEvent'))
export type CollisionEvent = S.Schema.Type<typeof CollisionEvent>

// ============================================
// Request/Response Messages
// ============================================

/**
 * Physics simulation request
 */
export const PhysicsSimulationRequest = S.Struct({
  // Simulation parameters
  deltaTime: S.Number.pipe(S.positive),
  subSteps: S.optional(S.Number.pipe(S.int(), S.positive)),
  gravity: Vector3,
  
  // World bounds
  worldBounds: S.optional(BoundingBox),
  
  // Bodies to simulate
  bodies: S.Array(PhysicsBody),
  
  // Constraints
  constraints: S.optional(S.Array(PhysicsConstraint)),
  
  // Forces to apply this frame
  forces: S.optional(S.Array(ForceApplication)),
  
  // Physics fields
  fields: S.optional(S.Array(PhysicsField)),
  
  // Simulation options
  options: S.optional(S.Struct({
    enableCollisionDetection: S.Boolean,
    enableContinuousCollisionDetection: S.Boolean,
    enableSleeping: S.Boolean,
    sleepThreshold: S.optional(S.Number.pipe(S.positive)),
    enableDebugDraw: S.optional(S.Boolean),
    solverIterations: S.optional(S.Number.pipe(S.int(), S.positive))
  }))
}).pipe(S.identifier('PhysicsSimulationRequest'))
export type PhysicsSimulationRequest = S.Schema.Type<typeof PhysicsSimulationRequest>

/**
 * Updated body state
 */
export const UpdatedBodyState = S.Struct({
  id: S.String,
  transform: Transform,
  velocity: Vector3,
  angularVelocity: Vector3,
  isActive: S.Boolean,
  isSleeping: S.Boolean,
  
  // Optional detailed state
  acceleration: S.optional(Vector3),
  angularAcceleration: S.optional(Vector3),
  netForce: S.optional(Vector3),
  netTorque: S.optional(Vector3)
}).pipe(S.identifier('UpdatedBodyState'))
export type UpdatedBodyState = S.Schema.Type<typeof UpdatedBodyState>

/**
 * Performance metrics for physics simulation
 */
export const PhysicsPerformanceMetrics = S.Struct({
  totalTime: S.Number.pipe(S.positive),
  integrationTime: S.Number.pipe(S.positive),
  collisionDetectionTime: S.Number.pipe(S.positive),
  constraintSolvingTime: S.Number.pipe(S.positive),
  
  bodiesSimulated: S.Number.pipe(S.int(), S.nonNegative),
  activeBodies: S.Number.pipe(S.int(), S.nonNegative),
  sleepingBodies: S.Number.pipe(S.int(), S.nonNegative),
  
  collisionPairs: S.Number.pipe(S.int(), S.nonNegative),
  contactPoints: S.Number.pipe(S.int(), S.nonNegative),
  constraintsSolved: S.Number.pipe(S.int(), S.nonNegative),
  
  memoryUsed: S.optional(S.Number.pipe(S.positive)),
  simulationStability: S.optional(S.Number.pipe(S.between(0, 1)))
}).pipe(S.identifier('PhysicsPerformanceMetrics'))
export type PhysicsPerformanceMetrics = S.Schema.Type<typeof PhysicsPerformanceMetrics>

/**
 * Physics simulation response
 */
export const PhysicsSimulationResponse = S.Struct({
  // Updated body states
  updatedBodies: S.Array(UpdatedBodyState),
  
  // Collision events
  collisions: S.Array(CollisionEvent),
  
  // Constraint feedback
  constraintFeedback: S.optional(S.Array(S.Struct({
    constraintId: S.String,
    appliedImpulse: S.Number,
    breakingThreshold: S.optional(S.Number)
  }))),
  
  // Performance metrics
  metrics: PhysicsPerformanceMetrics,
  
  // Simulation state
  simulationTime: S.Number.pipe(S.positive),
  frameNumber: S.Number.pipe(S.int(), S.nonNegative),
  
  // Status and warnings
  success: S.Boolean,
  warnings: S.optional(S.Array(S.String)),
  errors: S.optional(S.Array(S.String)),
  
  // Debug data
  debugData: S.optional(S.Unknown)
}).pipe(S.identifier('PhysicsSimulationResponse'))
export type PhysicsSimulationResponse = S.Schema.Type<typeof PhysicsSimulationResponse>

// ============================================
// Raycast and Queries
// ============================================

/**
 * Raycast request
 */
export const RaycastRequest = S.Struct({
  origin: Vector3,
  direction: Vector3,
  maxDistance: S.Number.pipe(S.positive),
  collisionGroup: S.optional(S.Number.pipe(S.int(), S.nonNegative)),
  collisionMask: S.optional(S.Number.pipe(S.int(), S.nonNegative)),
  queryTriggers: S.optional(S.Boolean)
}).pipe(S.identifier('RaycastRequest'))
export type RaycastRequest = S.Schema.Type<typeof RaycastRequest>

/**
 * Raycast result
 */
export const RaycastResult = S.Struct({
  hit: S.Boolean,
  bodyId: S.optional(S.String),
  hitPoint: S.optional(Vector3),
  hitNormal: S.optional(Vector3),
  distance: S.optional(S.Number.pipe(S.positive))
}).pipe(S.identifier('RaycastResult'))
export type RaycastResult = S.Schema.Type<typeof RaycastResult>

/**
 * Overlap query
 */
export const OverlapQuery = S.Struct({
  shape: CollisionShape,
  transform: Transform,
  collisionGroup: S.optional(S.Number.pipe(S.int(), S.nonNegative)),
  collisionMask: S.optional(S.Number.pipe(S.int(), S.nonNegative))
}).pipe(S.identifier('OverlapQuery'))
export type OverlapQuery = S.Schema.Type<typeof OverlapQuery>

// ============================================
// Utility Functions
// ============================================

/**
 * Create zero vector
 */
export const zeroVector3 = (): Vector3 => ({ x: 0, y: 0, z: 0 })

/**
 * Create identity quaternion
 */
export const identityQuaternion = (): Quaternion => ({ x: 0, y: 0, z: 0, w: 1 })

/**
 * Create identity transform
 */
export const identityTransform = (): Transform => ({
  position: zeroVector3(),
  rotation: identityQuaternion()
})

/**
 * Create basic physics material
 */
export const createPhysicsMaterial = (
  friction: number = 0.5,
  restitution: number = 0.3,
  density: number = 1.0
): PhysicsMaterial => ({
  friction,
  restitution,
  density
})

/**
 * Create box collision shape
 */
export const createBoxShape = (halfExtents: Vector3): CollisionShape => ({
  type: 'box',
  halfExtents
})

/**
 * Create sphere collision shape
 */
export const createSphereShape = (radius: number): CollisionShape => ({
  type: 'sphere',
  radius
})

/**
 * Validate physics simulation request
 */
export const validatePhysicsRequest = (request: unknown) =>
  S.decodeUnknown(PhysicsSimulationRequest)(request)

/**
 * Validate physics simulation response
 */
export const validatePhysicsResponse = (response: unknown) =>
  S.decodeUnknown(PhysicsSimulationResponse)(response)

/**
 * Create default simulation options
 */
export const createDefaultSimulationOptions = () => ({
  enableCollisionDetection: true,
  enableContinuousCollisionDetection: false,
  enableSleeping: true,
  sleepThreshold: 0.01,
  enableDebugDraw: false,
  solverIterations: 10
})

/**
 * Vector operations
 */
export const vectorOps = {
  add: (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  subtract: (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
  multiply: (v: Vector3, scalar: number): Vector3 => ({ x: v.x * scalar, y: v.y * scalar, z: v.z * scalar }),
  dot: (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z,
  length: (v: Vector3): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
  normalize: (v: Vector3): Vector3 => {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
    return len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : zeroVector3()
  }
}