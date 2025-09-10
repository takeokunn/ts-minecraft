/**
 * World service type definitions
 * Contains types used across the World service
 */

export { type SoAResult } from './world.service'

// Re-export commonly used world types
export type { WorldState, Voxel } from '@/domain/world'
export type { EntityId } from '@/domain/entity'
export type { ComponentName, ComponentOfName } from '@/core/components'