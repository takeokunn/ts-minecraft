/**
 * Central Component Registry
 * Aggregates all component definitions from categorized modules
 */

import * as S from 'effect/Schema'

// Import all component categories
import { 
  PositionComponent,
  VelocityComponent,
  GravityComponent,
  ColliderComponent,
} from './physics'

import {
  PlayerComponent,
  InputStateComponent,
  HotbarComponent,
  TargetComponent,
} from './gameplay'

import {
  CameraComponent,
  CameraStateComponent,
  RenderableComponent,
  InstancedMeshRenderableComponent,
} from './rendering'

import {
  ChunkComponent,
  ChunkLoaderStateComponent,
  TerrainBlockComponent,
  TargetBlockComponent,
} from './world'

// Export all components
export * from './physics'
export * from './gameplay'
export * from './rendering'
export * from './world'

// Component schema registry (matching original structure for compatibility)
export const ComponentSchemas = {
  // Physics components
  position: PositionComponent,
  velocity: VelocityComponent,
  gravity: GravityComponent,
  collider: ColliderComponent,
  
  // Gameplay components
  player: PlayerComponent,
  inputState: InputStateComponent,
  hotbar: HotbarComponent,
  target: TargetComponent,
  
  // Rendering components
  camera: CameraComponent,
  cameraState: CameraStateComponent,
  renderable: RenderableComponent,
  instancedMeshRenderable: InstancedMeshRenderableComponent,
  
  // World components
  chunk: ChunkComponent,
  chunkLoaderState: ChunkLoaderStateComponent,
  terrainBlock: TerrainBlockComponent,
  targetBlock: TargetBlockComponent,
} as const

// Type definitions
export type ComponentName = keyof typeof ComponentSchemas
export const componentNames = Object.keys(ComponentSchemas) as Array<ComponentName>
export const ComponentNameSchema = S.keyof(S.Struct(ComponentSchemas))
export const componentNamesSet = new Set<string>(componentNames)

export type ComponentOfName<T extends ComponentName> = S.Schema.Type<(typeof ComponentSchemas)[T]>

export type Components = {
  [K in ComponentName]: ComponentOfName<K>
}

// Union types for any component
export const AnyComponent = S.Union(...Object.values(ComponentSchemas))
export type AnyComponent = S.Schema.Type<typeof AnyComponent>

// Partial components schema
export const PartialComponentsSchema = S.partial(S.Struct(ComponentSchemas))
export type PartialComponents = S.Schema.Type<typeof PartialComponentsSchema>