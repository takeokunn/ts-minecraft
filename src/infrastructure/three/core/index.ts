// Re-export core types from shared math layer for DDD purity
// Core mathematical types should be pure and independent of external dependencies

// Import specific types needed by infrastructure
export type { Vector3 } from '@/shared/math/three/vector3'
export type { Quaternion } from '@/shared/math/three/quaternion'
export type { Matrix4 } from '@/shared/math/three/matrix4'
export type { Color } from '@/shared/math/three/color'

// Import specific utility functions
export type { MakeVector3 } from '@/shared/math/three/vector3'
export type { MakeColor, FromHex, ToThreeColor } from '@/shared/math/three/color'

// Export runtime values from vector3 module
export { makeVector3, zero, one, up, down, left, right, forward, backward } from '@/shared/math/three/vector3'
