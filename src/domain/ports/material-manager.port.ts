/**
 * Material Manager Port
 *
 * Domain port interface for material management operations.
 * Abstracts away technical details of material creation and management.
 */

import { Effect, Context } from 'effect'

/**
 * Material configuration interface
 */
export interface MaterialConfig {
  readonly type: 'standard' | 'basic' | 'lambert' | 'phong'
  readonly color?: number
  readonly opacity?: number
  readonly transparent?: boolean
  readonly wireframe?: boolean
}

/**
 * Material manager interface
 */
export interface IMaterialManager {
  readonly createMaterial: (config: MaterialConfig) => Effect.Effect<unknown, Error, never>
  readonly getMaterial: (id: string) => Effect.Effect<unknown | null, Error, never>
  readonly updateMaterial: (id: string, config: Partial<MaterialConfig>) => Effect.Effect<void, Error, never>
  readonly disposeMaterial: (id: string) => Effect.Effect<void, Error, never>
  readonly disposeAll: () => Effect.Effect<void, Error, never>
}

/**
 * Material Manager Port Context
 */
export const MaterialManagerPort = Context.GenericTag<IMaterialManager>('MaterialManagerPort')
