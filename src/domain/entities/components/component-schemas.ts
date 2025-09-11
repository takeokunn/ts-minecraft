/**
 * Unified Component Schemas and Type Definitions
 *
 * This module consolidates all component schemas and provides type definitions.
 * Moved from index.ts to separate concerns and maintain pure barrel exports.
 */

import * as S from 'effect/Schema'

// Import all component modules
import * as PhysicsModule from '@domain/entities/components/physics'
import * as RenderingModule from '@domain/entities/components/rendering'
import * as GameplayModule from '@domain/entities/components/gameplay'
import * as WorldModule from '@domain/entities/components/world'

// Aggregate all component schemas for the central registry
export const ComponentSchemas = {
  // Physics components
  position: PhysicsModule.PositionComponent,
  velocity: PhysicsModule.VelocityComponent,
  acceleration: PhysicsModule.AccelerationComponent,
  mass: PhysicsModule.MassComponent,
  collider: PhysicsModule.ColliderComponent,

  // Rendering components
  mesh: RenderingModule.MeshComponent,
  material: RenderingModule.MaterialComponent,
  light: RenderingModule.LightComponent,
  camera: RenderingModule.CameraComponent,
  renderable: RenderingModule.RenderableComponent,

  // Gameplay components
  health: GameplayModule.HealthComponent,
  inventory: GameplayModule.InventoryComponent,
  playerControl: GameplayModule.PlayerControlComponent,
  ai: GameplayModule.AIComponent,
  target: GameplayModule.TargetComponent,
  player: GameplayModule.PlayerComponent,
  inputState: GameplayModule.InputStateComponent,
  cameraState: GameplayModule.CameraStateComponent,
  hotbar: GameplayModule.HotbarComponent,
  gravity: GameplayModule.GravityComponent,
  frozen: GameplayModule.FrozenComponent,
  disabled: GameplayModule.DisabledComponent,

  // World components
  chunk: WorldModule.ChunkComponent,
  chunkLoaderState: WorldModule.ChunkLoaderStateComponent,
  terrainBlock: WorldModule.TerrainBlockComponent,
  targetBlock: WorldModule.TargetBlockComponent,
} as const

// Type definitions
export type ComponentName = keyof typeof ComponentSchemas
export const componentNames = Object.keys(ComponentSchemas) as Array<ComponentName>
export const ComponentNameSchema = S.Literal(...componentNames)
export const componentNamesSet = new Set<string>(componentNames)

export type ComponentOfName<T extends ComponentName> = S.Schema.Type<(typeof ComponentSchemas)[T]>

export type Components = {
  [K in ComponentName]: ComponentOfName<K>
}

// Component factory aggregation
export const ComponentFactories = {
  // Physics
  ...PhysicsModule.PhysicsComponentFactories,
  // Rendering
  ...RenderingModule.RenderingComponentFactories,
  // Gameplay
  ...GameplayModule.GameplayComponentFactories,
} as const

// Component aggregations by category
export const ComponentCategories = {
  Physics: PhysicsModule.PhysicsComponents,
  Rendering: RenderingModule.RenderingComponents,
  Gameplay: GameplayModule.GameplayComponents,
} as const
