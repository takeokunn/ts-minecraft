/**
 * Gameplay Component Factory Functions
 * 
 * Provides factory functions for creating gameplay components with sensible defaults
 */

import * as Data from 'effect/Data'
import type { 
  HealthComponent, 
  InventoryComponent, 
  PlayerControlComponent, 
  AIComponent, 
  TargetComponent,
  AIState,
  ItemStack
} from '@domain/entities/components/gameplay/gameplay-components'

// ===== COMPONENT FACTORIES =====

export const createHealthComponent = (maxHealth: number, options?: Partial<Pick<HealthComponent, 'current' | 'regenRate' | 'armor' | 'magicResistance'>>): HealthComponent =>
  Data.struct({
    current: options?.current ?? maxHealth,
    maximum: maxHealth,
    regenRate: options?.regenRate ?? 0,
    regenDelay: 5, // 5 seconds
    armor: options?.armor ?? 0,
    magicResistance: options?.magicResistance ?? 0,
    statusEffects: [],
    isDead: false,
    isInvulnerable: false,
    canRegen: true,
  })

export const createInventoryComponent = (capacity: number = 36, hotbarCapacity: number = 9): InventoryComponent =>
  Data.struct({
    slots: (() => {
      const arr: (ItemStack | undefined)[] = []
      for (let i = 0; i < capacity; i++) arr.push(undefined)
      return arr
    })(),
    capacity,
    hotbarSlots: (() => {
      const arr: (ItemStack | undefined)[] = []
      for (let i = 0; i < hotbarCapacity; i++) arr.push(undefined)
      return arr
    })(),
    hotbarCapacity,
    selectedHotbarSlot: 0,
    isOpen: false,
  })

export const createPlayerControlComponent = (options?: Partial<Pick<PlayerControlComponent, 'walkSpeed' | 'runSpeed' | 'jumpForce'>>): PlayerControlComponent =>
  Data.struct({
    walkSpeed: options?.walkSpeed ?? 4.3,
    runSpeed: options?.runSpeed ?? 5.6,
    jumpForce: options?.jumpForce ?? 7.5,
    actions: [],
    mouseSensitivity: 1.0,
    invertY: false,
    canMove: true,
    canJump: true,
    canFly: false,
    isFlying: false,
    isGrounded: false,
    groundCheckDistance: 0.1,
  })

export const createAIComponent = (initialState: AIState = { type: 'idle' }, options?: Partial<Pick<AIComponent, 'detectionRadius' | 'fieldOfView'>>): AIComponent =>
  Data.struct({
    currentState: initialState,
    detectionRadius: options?.detectionRadius ?? 16,
    fieldOfView: options?.fieldOfView ?? Math.PI,
    decisionInterval: 1, // 1 second
    lastDecisionTime: 0,
    knownEntities: [],
    pathfindingEnabled: true,
    enabled: true,
  })

export const createTargetComponent = (maxDistance: number = 8, options?: Partial<Pick<TargetComponent, 'autoTarget' | 'showTargetHighlight'>>): TargetComponent =>
  Data.struct({
    current: { type: 'none' as const },
    maxTargetDistance: maxDistance,
    autoTarget: options?.autoTarget ?? true,
    raycastAccuracy: 0.1,
    ignoreTransparent: true,
    showTargetHighlight: options?.showTargetHighlight ?? true,
    highlightColor: { r: 1, g: 1, b: 1, a: 0.3 },
  })

// ===== GAMEPLAY COMPONENT FACTORIES =====

export const GameplayComponentFactories = {
  createHealthComponent,
  createInventoryComponent,
  createPlayerControlComponent,
  createAIComponent,
  createTargetComponent,
} as const