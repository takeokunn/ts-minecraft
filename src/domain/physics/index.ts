/**
 * 物理エンジンモジュール
 *
 * Minecraftの物理演算を再現する包括的なシステム
 * - 重力と終端速度
 * - AABB衝突検出
 * - ブロック別摩擦係数
 * - 流体物理（水・溶岩）
 *
 * @module domain/physics
 */

export * from './CollisionDetection'
export * from './FluidPhysics'
export * from './Friction'
export * from './Gravity'
export * from './PhysicsService'
export * from './PhysicsSystem'
export * from './types'
