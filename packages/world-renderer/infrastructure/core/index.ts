// Re-export core types from shared math layer for DDD purity
// Core mathematical types should be pure and independent of external dependencies

// Import specific types needed by infrastructure
export type { Vector3 } from '@ts-minecraft/kernel'
export type { Quaternion } from '@ts-minecraft/kernel'
export type { Matrix4 } from '@ts-minecraft/kernel'
export type { Color } from '@ts-minecraft/kernel'

// Export runtime values from vector3 module
export { makeVector3, zero, one, up, down, left, right, forward, backward } from '@ts-minecraft/kernel'
