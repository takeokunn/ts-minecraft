export * from './vector3.value-object'
export * from './quaternion.value-object'

// Namespace exports to avoid naming conflicts
import * as Vector3Ops from './vector3.value-object'
import * as QuaternionOps from './quaternion.value-object'

export { Vector3Ops, QuaternionOps }
