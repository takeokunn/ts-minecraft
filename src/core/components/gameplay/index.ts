/**
 * Gameplay Components
 * Components related to game mechanics and player interaction
 */

export { PlayerComponent, type PlayerComponent as PlayerComponentType } from './player'
export { InputStateComponent, type InputStateComponent as InputStateComponentType } from './input-state'
export { HotbarComponent, type HotbarComponent as HotbarComponentType } from './hotbar'
export { 
  TargetComponent,
  TargetBlockComponent,
  TargetNoneComponent,
  type TargetComponent as TargetComponentType,
  type TargetBlockComponent as TargetBlockComponentType,
  type TargetNoneComponent as TargetNoneComponentType,
} from './target'

// Aggregate gameplay component schemas for registration
export const GameplayComponentSchemas = {
  player: () => import('./player').then(m => m.PlayerComponent),
  inputState: () => import('./input-state').then(m => m.InputStateComponent),
  hotbar: () => import('./hotbar').then(m => m.HotbarComponent),
  target: () => import('./target').then(m => m.TargetComponent),
} as const