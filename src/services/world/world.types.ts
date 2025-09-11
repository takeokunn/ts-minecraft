/**
 * World service type definitions
 * Contains types used across the World service
 */

export { type SoAResult } from '@/runtime/services'

// Re-export commonly used world types
export type { WorldState, Voxel } from '@/domain/world'
export type { EntityId } from '@/domain/entities'
export type { ComponentName, ComponentOfName } from '@/domain/entities/components'