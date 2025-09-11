/**
 * Gameplay Components - Redesigned for Enhanced Game Mechanics
 * 
 * Features:
 * - Health and damage system with status effects
 * - Advanced inventory management with item stacking and metadata
 * - Player control with customizable input mapping
 * - AI system with behavior trees and state machines
 * - Target system with multiple target types
 */

import * as S from "effect/Schema"
import * as Data from 'effect/Data'
import { RegisterComponent } from '../registry'

// ===== HEALTH COMPONENT =====

export const StatusEffect = S.Struct({
  id: S.String,
  name: S.String,
  duration: S.Number.pipe(S.positive()), // in seconds
  remainingTime: S.Number.pipe(S.positive()),
  stackCount: S.Number.pipe(S.int(), S.positive()),
  maxStacks: S.Number.pipe(S.int(), S.positive()),
  // Effect properties
  healthRegenPerSecond: S.optional(S.Number),
  damagePerSecond: S.optional(S.Number),
  speedMultiplier: S.optional(S.Number.pipe(S.positive())),
  invulnerable: S.optional(S.Boolean),
})

export const HealthComponent = RegisterComponent({
  id: 'health',
  category: 'gameplay',
  priority: 1,
})(
  S.Struct({
    current: S.Number.pipe(S.positive()),
    maximum: S.Number.pipe(S.positive()),
    // Regeneration
    regenRate: S.Number, // HP per second
    regenDelay: S.Number.pipe(S.positive()), // Delay after damage before regen starts
    lastDamageTime: S.optional(S.Number),
    // Damage resistance
    armor: S.Number.pipe(S.between(0, 1)), // Damage reduction percentage
    magicResistance: S.Number.pipe(S.between(0, 1)),
    // Status effects
    statusEffects: S.Array(StatusEffect),
    // State flags
    isDead: S.Boolean,
    isInvulnerable: S.Boolean,
    canRegen: S.Boolean,
  })
)

export type HealthComponent = S.Schema.Type<typeof HealthComponent>
export type StatusEffect = S.Schema.Type<typeof StatusEffect>

// ===== INVENTORY COMPONENT =====

export const ItemStack = S.Struct({
  itemId: S.String,
  count: S.Number.pipe(S.int(), S.positive()),
  maxStack: S.Number.pipe(S.int(), S.positive()),
  // Item metadata
  durability: S.optional(S.Number.pipe(S.int(), S.between(0, 100))),
  enchantments: S.optional(S.Array(S.Struct({
    id: S.String,
    level: S.Number.pipe(S.int(), S.positive()),
  }))),
  customData: S.optional(S.Record({ key: S.String, value: S.Union(S.String, S.Number, S.Boolean) })),
})

export const InventoryComponent = RegisterComponent({
  id: 'inventory',
  category: 'gameplay',
  priority: 2,
})(
  S.Struct({
    // Main inventory slots
    slots: S.Array(S.Union(ItemStack, S.Undefined)),
    capacity: S.Number.pipe(S.int(), S.positive()),
    // Hotbar (quick access slots)
    hotbarSlots: S.Array(S.Union(ItemStack, S.Undefined)),
    hotbarCapacity: S.Number.pipe(S.int(), S.positive()),
    selectedHotbarSlot: S.Number.pipe(S.int(), S.between(0, 8)),
    // Equipment slots
    equipment: S.optional(S.Struct({
      helmet: S.optional(ItemStack),
      chestplate: S.optional(ItemStack),
      leggings: S.optional(ItemStack),
      boots: S.optional(ItemStack),
      mainHand: S.optional(ItemStack),
      offHand: S.optional(ItemStack),
    })),
    // Crafting
    craftingGrid: S.optional(S.Array(S.Union(ItemStack, S.Undefined))),
    // State
    isOpen: S.Boolean,
  })
)

export type InventoryComponent = S.Schema.Type<typeof InventoryComponent>
export type ItemStack = S.Schema.Type<typeof ItemStack>

// ===== PLAYER CONTROL COMPONENT =====

export const InputAction = S.Struct({
  id: S.String,
  keyBinding: S.Union(S.String, S.Array(S.String)),
  isPressed: S.Boolean,
  wasJustPressed: S.Boolean,
  wasJustReleased: S.Boolean,
  holdDuration: S.Number,
})

export const PlayerControlComponent = RegisterComponent({
  id: 'playerControl',
  category: 'gameplay',
  priority: 1,
  dependencies: ['position', 'velocity'] as const,
})(
  S.Struct({
    // Movement settings
    walkSpeed: S.Number.pipe(S.positive()),
    runSpeed: S.Number.pipe(S.positive()),
    jumpForce: S.Number.pipe(S.positive()),
    // Input state
    actions: S.Array(InputAction),
    // Mouse/camera
    mouseSensitivity: S.Number.pipe(S.positive()),
    invertY: S.Boolean,
    // Capabilities
    canMove: S.Boolean,
    canJump: S.Boolean,
    canFly: S.Boolean,
    isFlying: S.Boolean,
    // Ground detection
    isGrounded: S.Boolean,
    groundCheckDistance: S.Number.pipe(S.positive()),
  })
)

export type PlayerControlComponent = S.Schema.Type<typeof PlayerControlComponent>
export type InputAction = S.Schema.Type<typeof InputAction>

// ===== AI COMPONENT =====

export const AIState = S.Union(
  S.Struct({ type: S.Literal('idle') }),
  S.Struct({ 
    type: S.Literal('patrol'),
    waypoints: S.Array(S.Struct({ x: S.Number, y: S.Number, z: S.Number })),
    currentWaypoint: S.Number.pipe(S.int()),
  }),
  S.Struct({
    type: S.Literal('chase'),
    targetEntityId: S.Number.pipe(S.int()),
    chaseSpeed: S.Number.pipe(S.positive()),
    maxChaseDistance: S.Number.pipe(S.positive()),
  }),
  S.Struct({
    type: S.Literal('attack'),
    targetEntityId: S.Number.pipe(S.int()),
    attackRange: S.Number.pipe(S.positive()),
    attackCooldown: S.Number.pipe(S.positive()),
    lastAttackTime: S.Number,
  }),
  S.Struct({
    type: S.Literal('flee'),
    fleeFromEntityId: S.Number.pipe(S.int()),
    fleeSpeed: S.Number.pipe(S.positive()),
    safeDistance: S.Number.pipe(S.positive()),
  })
)

export const AIComponent = RegisterComponent({
  id: 'ai',
  category: 'gameplay',
  priority: 3,
  dependencies: ['position'] as const,
})(
  S.Struct({
    // Current state
    currentState: AIState,
    // Behavior settings
    detectionRadius: S.Number.pipe(S.positive()),
    fieldOfView: S.Number.pipe(S.between(0, Math.PI * 2)),
    // Decision making
    decisionInterval: S.Number.pipe(S.positive()), // seconds between decisions
    lastDecisionTime: S.Number,
    // Memory
    knownEntities: S.Array(S.Struct({
      entityId: S.Number.pipe(S.int()),
      lastSeenPosition: S.Struct({ x: S.Number, y: S.Number, z: S.Number }),
      lastSeenTime: S.Number,
      relationship: S.Literal('neutral', 'hostile', 'friendly'),
    })),
    // Pathfinding
    currentPath: S.optional(S.Array(S.Struct({ x: S.Number, y: S.Number, z: S.Number }))),
    pathfindingEnabled: S.Boolean,
    // State
    enabled: S.Boolean,
  })
)

export type AIComponent = S.Schema.Type<typeof AIComponent>
export type AIState = S.Schema.Type<typeof AIState>

// ===== TARGET COMPONENT =====

export const Target = S.Union(
  S.Struct({ 
    type: S.Literal('none') 
  }),
  S.Struct({
    type: S.Literal('block'),
    position: S.Struct({ x: S.Number, y: S.Number, z: S.Number }),
    blockType: S.String,
    face: S.Literal('top', 'bottom', 'north', 'south', 'east', 'west'),
    distance: S.Number.pipe(S.positive()),
  }),
  S.Struct({
    type: S.Literal('entity'),
    entityId: S.Number.pipe(S.int()),
    distance: S.Number.pipe(S.positive()),
  }),
  S.Struct({
    type: S.Literal('position'),
    position: S.Struct({ x: S.Number, y: S.Number, z: S.Number }),
    distance: S.Number.pipe(S.positive()),
  })
)

export const TargetComponent = RegisterComponent({
  id: 'target',
  category: 'gameplay',
  priority: 2,
})(
  S.Struct({
    current: Target,
    previous: S.optional(Target),
    // Targeting settings
    maxTargetDistance: S.Number.pipe(S.positive()),
    autoTarget: S.Boolean,
    // Raycast settings
    raycastAccuracy: S.Number.pipe(S.between(0.1, 1)), // Step size for raycast
    ignoreTransparent: S.Boolean,
    // Visual feedback
    showTargetHighlight: S.Boolean,
    highlightColor: S.optional(S.Struct({
      r: S.Number.pipe(S.between(0, 1)),
      g: S.Number.pipe(S.between(0, 1)),
      b: S.Number.pipe(S.between(0, 1)),
      a: S.Number.pipe(S.between(0, 1)),
    })),
  })
)

export type TargetComponent = S.Schema.Type<typeof TargetComponent>
export type Target = S.Schema.Type<typeof Target>

// ===== COMPONENT FACTORIES =====

export const createHealthComponent = (
  maxHealth: number,
  options?: Partial<Pick<HealthComponent, 'current' | 'regenRate' | 'armor' | 'magicResistance'>>
): HealthComponent =>
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

export const createInventoryComponent = (
  capacity: number = 36,
  hotbarCapacity: number = 9
): InventoryComponent =>
  Data.struct({
    slots: (() => { const arr: (ItemStack | undefined)[] = []; for (let i = 0; i < capacity; i++) arr.push(undefined); return arr; })(),
    capacity,
    hotbarSlots: (() => { const arr: (ItemStack | undefined)[] = []; for (let i = 0; i < hotbarCapacity; i++) arr.push(undefined); return arr; })(),
    hotbarCapacity,
    selectedHotbarSlot: 0,
    isOpen: false,
  })

export const createPlayerControlComponent = (
  options?: Partial<Pick<PlayerControlComponent, 'walkSpeed' | 'runSpeed' | 'jumpForce'>>
): PlayerControlComponent =>
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

export const createAIComponent = (
  initialState: AIState = { type: 'idle' },
  options?: Partial<Pick<AIComponent, 'detectionRadius' | 'fieldOfView'>>
): AIComponent =>
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

export const createTargetComponent = (
  maxDistance: number = 8,
  options?: Partial<Pick<TargetComponent, 'autoTarget' | 'showTargetHighlight'>>
): TargetComponent =>
  Data.struct({
    current: { type: 'none' as const },
    maxTargetDistance: maxDistance,
    autoTarget: options?.autoTarget ?? true,
    raycastAccuracy: 0.1,
    ignoreTransparent: true,
    showTargetHighlight: options?.showTargetHighlight ?? true,
    highlightColor: { r: 1, g: 1, b: 1, a: 0.3 },
  })

// ===== GAMEPLAY COMPONENT UTILITIES =====

export const GameplayComponents = {
  Health: HealthComponent,
  Inventory: InventoryComponent,
  PlayerControl: PlayerControlComponent,
  AI: AIComponent,
  Target: TargetComponent,
} as const

export type AnyGameplayComponent = 
  | HealthComponent 
  | InventoryComponent 
  | PlayerControlComponent 
  | AIComponent 
  | TargetComponent

export const GameplayComponentFactories = {
  createHealthComponent,
  createInventoryComponent,
  createPlayerControlComponent,
  createAIComponent,
  createTargetComponent,
} as const

// ===== ADDITIONAL COMPONENTS FOR DOMAIN QUERIES =====

export const PlayerComponent = RegisterComponent({
  id: 'player',
  category: 'gameplay',
  priority: 1,
})(
  S.Struct({
    isMainPlayer: S.Boolean,
    name: S.String,
  })
)
export type PlayerComponent = S.Schema.Type<typeof PlayerComponent>

export const InputStateComponent = RegisterComponent({
  id: 'inputState',
  category: 'gameplay',
  priority: 1,
})(
  S.Struct({
    forward: S.Boolean,
    backward: S.Boolean,
    left: S.Boolean,
    right: S.Boolean,
    jump: S.Boolean,
    sneak: S.Boolean,
    sprint: S.Boolean,
    interact: S.Boolean,
    attack: S.Boolean,
  })
)
export type InputStateComponent = S.Schema.Type<typeof InputStateComponent>

export const CameraStateComponent = RegisterComponent({
  id: 'cameraState',
  category: 'gameplay',
  priority: 1,
})(
  S.Struct({
    yaw: S.Number,
    pitch: S.Number,
    roll: S.Number,
    fov: S.Number.pipe(S.positive()),
  })
)
export type CameraStateComponent = S.Schema.Type<typeof CameraStateComponent>

export const HotbarComponent = RegisterComponent({
  id: 'hotbar',
  category: 'gameplay',
  priority: 1,
})(
  S.Struct({
    selectedSlot: S.Number.pipe(S.int(), S.between(0, 8)),
    slots: S.Array(S.Union(ItemStack, S.Undefined)),
  })
)
export type HotbarComponent = S.Schema.Type<typeof HotbarComponent>

export const GravityComponent = RegisterComponent({
  id: 'gravity',
  category: 'gameplay',
  priority: 1,
})(
  S.Struct({
    force: S.Number,
    enabled: S.Boolean,
  })
)
export type GravityComponent = S.Schema.Type<typeof GravityComponent>

// ===== TEST COMPONENTS =====

export const FrozenComponent = RegisterComponent({
  id: 'frozen',
  category: 'gameplay',
  priority: 0,
})(
  S.Struct({
    reason: S.String,
  })
)
export type FrozenComponent = S.Schema.Type<typeof FrozenComponent>

export const DisabledComponent = RegisterComponent({
  id: 'disabled',
  category: 'gameplay',
  priority: 0,
})(
  S.Struct({
    reason: S.String,
  })
)
export type DisabledComponent = S.Schema.Type<typeof DisabledComponent>

// Re-export for backward compatibility
export {
  HealthComponent as HealthComponentType,
  InventoryComponent as InventoryComponentType,
  PlayerControlComponent as PlayerControlComponentType,
  AIComponent as AIComponentType,
  TargetComponent as TargetComponentType,
  PlayerComponent as Player,
  InputStateComponent as InputState,
}

export type {
  HotbarComponent as Hotbar,
  PlayerComponent as PlayerType,
  InputStateComponent as InputStateType,
  CameraStateComponent as CameraState,
  TargetComponent as TargetBlock,
}

// Additional type aliases for backward compatibility  
export type TargetNone = { _tag: 'none' }
export type InputState = InputStateComponent
export type Player = PlayerComponent
export type CameraState = CameraStateComponent

// Aggregate all gameplay components for easy import
export const GameplayComponentFactories = {
  // Add factory functions here if needed
} as const

export const GameplayComponents = {
  Health: HealthComponent,
  Inventory: InventoryComponent,
  PlayerControl: PlayerControlComponent,
  AI: AIComponent,
  Target: TargetComponent,
  Player: PlayerComponent,
  InputState: InputStateComponent,
  CameraState: CameraStateComponent,
  Hotbar: HotbarComponent,
  Gravity: GravityComponent,
  Frozen: FrozenComponent,
  Disabled: DisabledComponent,
} as const