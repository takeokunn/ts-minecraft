/**
 * Gameplay Component Utilities and Constants
 * 
 * Provides utility objects and type definitions for gameplay components
 */

import type {
  HealthComponent,
  InventoryComponent,
  PlayerControlComponent,
  AIComponent,
  TargetComponent,
  PlayerComponent,
  InputStateComponent,
  CameraStateComponent,
  HotbarComponent,
  GravityComponent,
  FrozenComponent,
  DisabledComponent
} from './gameplay-components'

import {
  HealthComponent as HealthComponentSchema,
  InventoryComponent as InventoryComponentSchema,
  PlayerControlComponent as PlayerControlComponentSchema,
  AIComponent as AIComponentSchema,
  TargetComponent as TargetComponentSchema,
  PlayerComponent as PlayerComponentSchema,
  InputStateComponent as InputStateComponentSchema,
  CameraStateComponent as CameraStateComponentSchema,
  HotbarComponent as HotbarComponentSchema,
  GravityComponent as GravityComponentSchema,
  FrozenComponent as FrozenComponentSchema,
  DisabledComponent as DisabledComponentSchema
} from './gameplay-components'

// ===== GAMEPLAY COMPONENT UTILITIES =====

export const GameplayComponents = {
  Health: HealthComponentSchema,
  Inventory: InventoryComponentSchema,
  PlayerControl: PlayerControlComponentSchema,
  AI: AIComponentSchema,
  Target: TargetComponentSchema,
  Player: PlayerComponentSchema,
  InputState: InputStateComponentSchema,
  CameraState: CameraStateComponentSchema,
  Hotbar: HotbarComponentSchema,
  Gravity: GravityComponentSchema,
  Frozen: FrozenComponentSchema,
  Disabled: DisabledComponentSchema,
} as const

export type AnyGameplayComponent = 
  | HealthComponent 
  | InventoryComponent 
  | PlayerControlComponent 
  | AIComponent 
  | TargetComponent
  | PlayerComponent
  | InputStateComponent
  | CameraStateComponent
  | HotbarComponent
  | GravityComponent
  | FrozenComponent
  | DisabledComponent

// Re-export for backward compatibility
export {
  HealthComponent as HealthComponentType,
  InventoryComponent as InventoryComponentType,
  PlayerControlComponent as PlayerControlComponentType,
  AIComponent as AIComponentType,
  TargetComponent as TargetComponentType,
}

export type { 
  HotbarComponent as Hotbar, 
  PlayerComponent as PlayerType, 
  InputStateComponent as InputStateType, 
  CameraStateComponent as CameraState, 
  TargetComponent as TargetBlock,
  PlayerComponent as Player,
  InputStateComponent as InputState
}

// Additional type aliases for backward compatibility
export type TargetNone = { _tag: 'none' }