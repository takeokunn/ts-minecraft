/**
 * Camera Aggregate Root Module
 *
 * Camera Domain の中核となるAggregate Rootとそのファクトリーを提供します。
 */

// Aggregate Root
export { Camera, CameraOps } from './index'

// Factory
export { CameraFactory, type CameraSnapshot } from './index'
export type { Camera }

// Type Guards
export const isCamera = (value: unknown): value is Camera => {
  return typeof value === 'object' && value !== null && '_tag' in value && (value as any)._tag === 'Camera'
}

// Re-export for convenience
import { Camera } from './index'
export * from './index';
export * from './index';
export * from './camera';
