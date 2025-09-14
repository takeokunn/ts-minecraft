---
title: "07 Potion Effects"
description: "07 Potion Effectsに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'effect-ts', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "30分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Potion Effects System

The Potion Effects System provides temporary and persistent status effects for entities in the TypeScript Minecraft clone. Built with Effect-TS 3.17+ functional architecture and DDD layer separation, this system manages complex effect interactions, brewing mechanics, and visual feedback while maintaining type safety and predictable behavior.

## System Overview and Responsibilities

The Potion Effects System serves as an enhanced feature built on top of Player and Crafting Systems, providing:

- **Effect Definition & Management**: Comprehensive effect type definitions with amplification and duration control
- **Brewing Mechanics**: Full brewing stand functionality with recipe validation and progression
- **Effect Application Logic**: Type-safe effect stacking, overriding, and removal mechanisms
- **Effect Interactions**: Complex interaction patterns including conflicts, enhancements, and neutralization
- **Visual Integration**: Particle systems, UI overlays, and screen effects
- **Status Calculations**: Real-time modification of entity attributes (speed, damage, health)
- **Persistence**: Effect serialization and world save integration
- **Performance Optimization**: ECS integration with Structure of Arrays patterns

### Architecture Overview

```
Domain/
├── PotionEffect/         # Core effect definitions and calculations
├── BrewingSystem/        # Brewing mechanics and recipes
├── EffectInteraction/    # Complex interaction rules and resolution
└── StatusCalculation/    # Pure functions for attribute modification

Application/
├── EffectManager/        # Effect lifecycle management
├── BrewingProcess/       # Brewing workflow coordination
├── EffectApplication/    # Application strategies and validation
└── EffectPersistence/    # Save/load coordination

Infrastructure/
├── EffectStorage/        # Data persistence implementation
├── ParticleRenderer/     # Visual effect rendering
├── EffectTimer/          # Time-based effect management
└── PerformanceCache/     # Optimization and caching
```

## Effect Definition System

### Core Effect Types

```typescript
// Domain Layer - Effect Type Definitions
const PotionEffectType = Schema.Literal(
  "Speed", "Slowness", "Haste", "MiningFatigue",
  "Strength", "InstantHealth", "InstantDamage", "JumpBoost",
  "Nausea", "Regeneration", "Resistance", "FireResistance",
  "WaterBreathing", "Invisibility", "Blindness", "NightVision",
  "Hunger", "Weakness", "Poison", "Wither",
  "HealthBoost", "Absorption", "Saturation", "Glowing",
  "Levitation", "Luck", "Unluck", "SlowFalling",
  "ConduitPower", "DolphinsGrace", "BadOmen", "HeroOfTheVillage"
)

type PotionEffectType = Schema.Schema.Type<typeof PotionEffectType>

// Effect Instance Definition
const PotionEffect = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("EffectId")),
  type: PotionEffectType,
  amplifier: Schema.Number.pipe(
    Schema.clamp(0, 255),
    Schema.brand("EffectAmplifier")
  ),
  duration: Schema.Number.pipe(
    Schema.positive(),
    Schema.brand("EffectDuration") // in ticks (1 tick = 50ms)
  ),
  remainingDuration: Schema.Number.pipe(Schema.brand("EffectDuration")),
  showParticles: Schema.Boolean.pipe(Schema.default(true)),
  showIcon: Schema.Boolean.pipe(Schema.default(true)),
  ambient: Schema.Boolean.pipe(Schema.default(false)), // beacon effects
  source: Schema.Struct({
    type: Schema.Literal("Potion", "Splash", "Lingering", "Arrow", "Beacon", "Food", "Command", "Natural"),
    sourceId: Schema.optional(Schema.String),
    appliedBy: Schema.optional(Schema.String) // Entity ID that applied this effect
  }),
  hiddenEffect: Schema.optional(PotionEffectType), // For suspicious stew
  factorData: Schema.optional(Schema.Record(Schema.String, Schema.Number))
})

type PotionEffect = Schema.Schema.Type<typeof PotionEffect>

// Effect Properties Template
const EffectProperties = Schema.Struct({
  type: PotionEffectType,
  category: Schema.Literal("Beneficial", "Harmful", "Neutral"),
  instant: Schema.Boolean,
  color: Schema.Struct({
    r: Schema.Number.pipe(Schema.clamp(0, 255)),
    g: Schema.Number.pipe(Schema.clamp(0, 255)),
    b: Schema.Number.pipe(Schema.clamp(0, 255))
  }),
  baseValue: Schema.Number,
  scalingFactor: Schema.Number,
  maxAmplifier: Schema.Number.pipe(Schema.default(3)),
  tickInterval: Schema.Number.pipe(Schema.default(20)), // ticks between applications
  conflictsWith: Schema.Array(PotionEffectType),
  enhancesWith: Schema.Array(PotionEffectType),
  neutralizesWith: Schema.Array(PotionEffectType)
})

type EffectProperties = Schema.Schema.Type<typeof EffectProperties>
```

### Pure Effect Calculations

```typescript
// Pure function for effect value calculation
const calculateEffectValue = (
  effect: PotionEffect,
  properties: EffectProperties
): number => {
  const amplifierMultiplier = effect.amplifier + 1
  return properties.baseValue + (properties.scalingFactor * amplifierMultiplier)
}

// Duration calculations
const calculateRemainingTicks = (
  effect: PotionEffect,
  currentTick: number,
  startTick: number
): number => Math.max(0, effect.duration - (currentTick - startTick))

// Effect strength comparison
const compareEffectStrength = (
  effect1: PotionEffect,
  effect2: PotionEffect
): number => {
  if (effect1.type !== effect2.type) return 0

  const amplifierDiff = effect1.amplifier - effect2.amplifier
  if (amplifierDiff !== 0) return amplifierDiff

  return effect1.remainingDuration - effect2.remainingDuration
}

// Effect applicability check
const canApplyEffect = (
  newEffect: PotionEffect,
  existingEffects: readonly PotionEffect[],
  properties: EffectProperties
): boolean => {
  const conflicting = existingEffects.find(existing =>
    properties.conflictsWith.includes(existing.type)
  )

  if (conflicting) return false

  const sameType = existingEffects.find(existing =>
    existing.type === newEffect.type
  )

  if (!sameType) return true

  return compareEffectStrength(newEffect, sameType) > 0
}
```

## Potion Brewing System

### Brewing Recipe Definitions

```typescript
// Brewing Ingredient Types
const BrewingIngredient = Schema.Struct({
  type: Schema.Literal(
    "NetherWart", "RedstoneDust", "GlowstoneDust", "Gunpowder", "DragonBreath",
    "FermentedSpiderEye", "MagmaCream", "Sugar", "RabbitFoot", "GlisteringMelon",
    "SpiderEye", "GoldenCarrot", "BlazePowder", "GhastTear", "TurtleHelmet",
    "PhantomMembrane", "Pufferfish", "GoldIngot", "Redstone"
  ),
  count: Schema.Number.pipe(Schema.positive(), Schema.default(1)),
  nbt: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

type BrewingIngredient = Schema.Schema.Type<typeof BrewingIngredient>

// Brewing Recipe Structure
const BrewingRecipe = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("RecipeId")),
  name: Schema.String,
  ingredient: BrewingIngredient,
  basePotion: Schema.Literal("Water", "Awkward", "Thick", "Mundane"),
  resultPotion: Schema.Struct({
    type: PotionEffectType,
    amplifier: Schema.Number.pipe(Schema.default(0)),
    duration: Schema.Number.pipe(Schema.default(3600)) // 3 minutes in ticks
  }),
  brewingTime: Schema.Number.pipe(Schema.default(400)), // 20 seconds in ticks
  fuelCost: Schema.Number.pipe(Schema.default(1)),
  successRate: Schema.Number.pipe(Schema.clamp(0, 1), Schema.default(1))
})

type BrewingRecipe = Schema.Schema.Type<typeof BrewingRecipe>

// Potion Modification Types
const PotionModification = Schema.Literal("Extended", "Enhanced", "Splash", "Lingering")
type PotionModification = Schema.Schema.Type<typeof PotionModification>

const ModificationRecipe = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("ModificationId")),
  baseEffectType: PotionEffectType,
  modification: PotionModification,
  ingredient: BrewingIngredient,
  durationMultiplier: Schema.Number.pipe(Schema.default(1)),
  amplifierBonus: Schema.Number.pipe(Schema.default(0)),
  splashRadius: Schema.optional(Schema.Number),
  lingeringDuration: Schema.optional(Schema.Number)
})

type ModificationRecipe = Schema.Schema.Type<typeof ModificationRecipe>
```

### Brewing Station Management

```typescript
// Application Layer - Brewing Process
interface BrewingSystemInterface {
  readonly startBrewing: (
    stationId: string,
    ingredients: BrewingIngredients,
    recipe: BrewingRecipe
  ) => Effect.Effect<BrewingProcess, BrewingError>

  readonly updateBrewing: (
    processId: string,
    deltaTicks: number
  ) => Effect.Effect<BrewingProcess, BrewingError>

  readonly completeBrewing: (
    processId: string
  ) => Effect.Effect<readonly PotionItem[], BrewingError>

  readonly validateRecipe: (
    ingredients: BrewingIngredients
  ) => Effect.Effect<Option.Option<BrewingRecipe>, never>

  readonly calculateBrewingTime: (
    recipe: BrewingRecipe,
    efficiency: number
  ) => Effect.Effect<number, never>
}

const BrewingSystem = Context.GenericTag<BrewingSystemInterface>("@app/BrewingSystem")

// Brewing Station State
const BrewingStation = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("BrewingStationId")),
  position: Position,
  fuel: Schema.Number.pipe(Schema.clamp(0, 20)),
  slots: Schema.Struct({
    ingredient: Schema.NullOr(ItemStack),
    bottles: Schema.Tuple(
      Schema.NullOr(ItemStack),
      Schema.NullOr(ItemStack),
      Schema.NullOr(ItemStack)
    )
  }),
  brewingProgress: Schema.Number.pipe(Schema.clamp(0, 400)),
  isActive: Schema.Boolean,
  efficiency: Schema.Number.pipe(Schema.clamp(0.5, 2.0), Schema.default(1.0))
})

type BrewingStation = Schema.Schema.Type<typeof BrewingStation>

// Brewing Process State
const BrewingProcess = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("ProcessId")),
  stationId: Schema.String.pipe(Schema.brand("BrewingStationId")),
  recipe: BrewingRecipe,
  startTick: Schema.Number,
  totalTicks: Schema.Number,
  remainingTicks: Schema.Number,
  stage: Schema.Literal("Preparing", "Brewing", "Complete", "Failed"),
  bubbleIntensity: Schema.Number.pipe(Schema.clamp(0, 1)),
  fuelConsumed: Schema.Number
})

type BrewingProcess = Schema.Schema.Type<typeof BrewingProcess>
```

## Effect Application and Removal Mechanisms

### Effect Management Service

```typescript
// Application Layer - Effect Management
interface EffectManagerInterface {
  readonly applyEffect: (
    entityId: EntityId,
    effect: PotionEffect,
    force?: boolean
  ) => Effect.Effect<ActiveEffect, EffectError>

  readonly removeEffect: (
    entityId: EntityId,
    effectType: PotionEffectType
  ) => Effect.Effect<void, EffectError>

  readonly removeAllEffects: (
    entityId: EntityId,
    category?: EffectCategory
  ) => Effect.Effect<void, EffectError>

  readonly getActiveEffects: (
    entityId: EntityId
  ) => Effect.Effect<readonly ActiveEffect[], never>

  readonly hasEffect: (
    entityId: EntityId,
    effectType: PotionEffectType
  ) => Effect.Effect<boolean, never>

  readonly updateEffects: (
    entityId: EntityId,
    deltaTicks: number
  ) => Effect.Effect<readonly ActiveEffect[], EffectError>

  readonly getEffectAmplifier: (
    entityId: EntityId,
    effectType: PotionEffectType
  ) => Effect.Effect<number, never>
}

const EffectManager = Context.GenericTag<EffectManagerInterface>("@app/EffectManager")

// Active Effect State
const ActiveEffect = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("ActiveEffectId")),
  entityId: EntityId,
  effect: PotionEffect,
  appliedTick: Schema.Number,
  lastTickApplied: Schema.Number,
  ticksActive: Schema.Number,
  suspended: Schema.Boolean.pipe(Schema.default(false)),
  immunityEndTick: Schema.optional(Schema.Number)
})

type ActiveEffect = Schema.Schema.Type<typeof ActiveEffect>
```

### Effect Application Logic

```typescript
// Effect application with interaction handling
const applyEffectToEntity = (
  entityId: EntityId,
  effect: PotionEffect,
  currentTick: number,
  force: boolean = false
): Effect.Effect<ActiveEffect, EffectError> =>
  Effect.gen(function* () {
    // Early return: Entity validation
    const entity = yield* EntityManager.getEntity(entityId)
    if (!entity) {
      return yield* Effect.fail(createEffectError("Entity not found", entityId))
    }

    // Early return: Effect properties validation
    const properties = yield* getEffectProperties(effect.type)
    if (!properties) {
      return yield* Effect.fail(createEffectError("Unknown effect type", effect.type))
    }

    // Get existing effects
    const existingEffects = yield* EffectStorage.getEntityEffects(entityId)

    // Process interactions
    const interactionResult = yield* processEffectInteraction(effect, existingEffects, properties)

    return yield* Match.value(interactionResult).pipe(
      Match.tag("Apply", () => addNewEffect(entityId, effect, currentTick)),
      Match.tag("Replace", ({ oldEffect }) =>
        Effect.gen(function* () {
          yield* removeEffectFromEntity(entityId, oldEffect.effect.type)
          return yield* addNewEffect(entityId, effect, currentTick)
        })
      ),
      Match.tag("Enhance", ({ existingEffect, newAmplifier, newDuration }) =>
        enhanceExistingEffect(entityId, existingEffect, newAmplifier, newDuration)
      ),
      Match.tag("Stack", ({ existingEffect }) =>
        stackEffectAmplifier(entityId, existingEffect, effect.amplifier)
      ),
      Match.tag("Block", () =>
        Effect.fail(createEffectError("Effect application blocked by existing effect"))
      ),
      Match.tag("Neutralize", ({ neutralizedEffects }) =>
        Effect.gen(function* () {
          yield* Effect.forEach(neutralizedEffects, neutralized =>
            removeEffectFromEntity(entityId, neutralized.effect.type)
          )
          return yield* addNewEffect(entityId, effect, currentTick)
        })
      ),
      Match.exhaustive
    )
  })

// Effect removal with cleanup
const removeEffectFromEntity = (
  entityId: EntityId,
  effectType: PotionEffectType
): Effect.Effect<void, EffectError> =>
  Effect.gen(function* () {
    const activeEffect = yield* EffectStorage.getEntityEffect(entityId, effectType)

    if (!activeEffect) return

    // Apply removal side effects
    yield* applyEffectRemovalSideEffects(entityId, activeEffect)

    // Remove from storage
    yield* EffectStorage.removeEntityEffect(entityId, effectType)

    // Update entity attributes
    yield* recalculateEntityAttributes(entityId)

    // Trigger removal events
    yield* EventBus.publish({
      type: "EffectRemoved",
      entityId,
      effectType,
      wasExpired: false,
      timestamp: Date.now()
    })
  })
```

## Effect Interaction System

### Interaction Patterns

```typescript
// Effect Interaction Result Types
type EffectInteractionResult =
  | { readonly _tag: "Apply" }
  | { readonly _tag: "Replace"; readonly oldEffect: ActiveEffect }
  | { readonly _tag: "Enhance"; readonly existingEffect: ActiveEffect; readonly newAmplifier: number; readonly newDuration: number }
  | { readonly _tag: "Stack"; readonly existingEffect: ActiveEffect }
  | { readonly _tag: "Block" }
  | { readonly _tag: "Neutralize"; readonly neutralizedEffects: readonly ActiveEffect[] }

// Interaction processing
const processEffectInteraction = (
  newEffect: PotionEffect,
  existingEffects: readonly ActiveEffect[],
  properties: EffectProperties
): Effect.Effect<EffectInteractionResult, never> =>
  Effect.gen(function* () {
    // Check for same type effects
    const sameTypeEffect = existingEffects.find(e => e.effect.type === newEffect.type)

    if (sameTypeEffect) {
      return yield* handleSameTypeInteraction(newEffect, sameTypeEffect, properties)
    }

    // Check for conflicting effects
    const conflictingEffects = existingEffects.filter(e =>
      properties.conflictsWith.includes(e.effect.type)
    )

    if (conflictingEffects.length > 0) {
      const strongestConflict = conflictingEffects.reduce((strongest, current) =>
        compareEffectStrength(current.effect, strongest.effect) > 0 ? current : strongest
      )

      if (compareEffectStrength(newEffect, strongestConflict.effect) > 0) {
        return { _tag: "Replace", oldEffect: strongestConflict } as const
      } else {
        return { _tag: "Block" } as const
      }
    }

    // Check for neutralizing effects
    const neutralizingEffects = existingEffects.filter(e =>
      properties.neutralizesWith.includes(e.effect.type) ||
      isOppositeEffect(newEffect.type, e.effect.type)
    )

    if (neutralizingEffects.length > 0) {
      return { _tag: "Neutralize", neutralizedEffects: neutralizingEffects } as const
    }

    // Check for enhancing effects
    const enhancingEffects = existingEffects.filter(e =>
      properties.enhancesWith.includes(e.effect.type)
    )

    if (enhancingEffects.length > 0) {
      const enhancer = enhancingEffects[0]
      const enhancedAmplifier = Math.min(255, newEffect.amplifier + 1)
      const enhancedDuration = Math.floor(newEffect.duration * 1.5)

      return {
        _tag: "Enhance",
        existingEffect: enhancer,
        newAmplifier: enhancedAmplifier,
        newDuration: enhancedDuration
      } as const
    }

    return { _tag: "Apply" } as const
  })

// Pure functions for effect relationships
const isOppositeEffect = (effect1: PotionEffectType, effect2: PotionEffectType): boolean => {
  const opposites: Record<PotionEffectType, PotionEffectType[]> = {
    "Speed": ["Slowness"],
    "Slowness": ["Speed"],
    "Strength": ["Weakness"],
    "Weakness": ["Strength"],
    "JumpBoost": [],
    "Haste": ["MiningFatigue"],
    "MiningFatigue": ["Haste"],
    "Regeneration": ["Poison", "Wither"],
    "Poison": ["Regeneration", "InstantHealth"],
    "InstantHealth": ["InstantDamage", "Poison", "Wither"],
    "InstantDamage": ["InstantHealth"],
    "Resistance": [],
    "FireResistance": [],
    "WaterBreathing": [],
    "Invisibility": ["Glowing"],
    "Glowing": ["Invisibility"],
    "Blindness": ["NightVision"],
    "NightVision": ["Blindness", "Darkness"],
    "Darkness": ["NightVision"],
    "Hunger": ["Saturation"],
    "Saturation": ["Hunger"],
    "Wither": ["Regeneration", "InstantHealth"],
    "HealthBoost": [],
    "Absorption": [],
    "Levitation": ["SlowFalling"],
    "SlowFalling": [],
    "Luck": ["Unluck"],
    "Unluck": ["Luck"],
    "Nausea": [],
    "ConduitPower": [],
    "DolphinsGrace": [],
    "BadOmen": ["HeroOfTheVillage"],
    "HeroOfTheVillage": ["BadOmen"]
  }

  return opposites[effect1]?.includes(effect2) ?? false
}

const isEnhancingEffect = (effect1: PotionEffectType, effect2: PotionEffectType): boolean => {
  const enhancements: Record<PotionEffectType, PotionEffectType[]> = {
    "Speed": ["JumpBoost", "DolphinsGrace"],
    "JumpBoost": ["Speed"],
    "Strength": ["Haste"],
    "Haste": ["Strength"],
    "Regeneration": ["HealthBoost"],
    "HealthBoost": ["Regeneration", "Absorption"],
    "Absorption": ["HealthBoost"],
    "NightVision": ["ConduitPower"],
    "ConduitPower": ["NightVision", "WaterBreathing"],
    "WaterBreathing": ["ConduitPower", "DolphinsGrace"],
    "DolphinsGrace": ["WaterBreathing", "Speed"],
    "Luck": ["HeroOfTheVillage"],
    "HeroOfTheVillage": ["Luck"]
  }

  return enhancements[effect1]?.includes(effect2) ?? false
}
```

## Visual Effects Integration

### Particle System Integration

```typescript
// Effect Particle Configuration
const EffectParticleConfig = Schema.Struct({
  type: Schema.Literal("Ambient", "Spell", "InstantSpell", "WitchSpell", "Note", "Portal", "Enchant", "Flame", "Lava", "Footstep", "Splash", "Wake", "Smoke", "Redstone", "Snowball", "Slime", "Heart", "Barrier", "ItemCrack", "BlockCrack", "BlockDust", "DropletRain", "DropletSplash", "Sweep", "Bubble", "Cloud", "Explosion"),
  color: Schema.Struct({
    r: Schema.Number.pipe(Schema.clamp(0, 1)),
    g: Schema.Number.pipe(Schema.clamp(0, 1)),
    b: Schema.Number.pipe(Schema.clamp(0, 1)),
    a: Schema.Number.pipe(Schema.clamp(0, 1))
  }),
  velocity: Vector3,
  count: Schema.Number.pipe(Schema.positive()),
  lifetime: Schema.Number.pipe(Schema.positive()),
  size: Schema.Number.pipe(Schema.positive()),
  gravity: Schema.Number
})

type EffectParticleConfig = Schema.Schema.Type<typeof EffectParticleConfig>

// Effect-specific particle mappings
const getEffectParticleConfigs = (effectType: PotionEffectType): readonly EffectParticleConfig[] => {
  const particleMap: Record<PotionEffectType, readonly EffectParticleConfig[]> = {
    "Speed": [{
      type: "Spell",
      color: { r: 0.5, g: 0.9, b: 1.0, a: 0.8 },
      velocity: { x: 0.1, y: 0.1, z: 0.1 },
      count: 3,
      lifetime: 40,
      size: 0.5,
      gravity: -0.02
    }],
    "Strength": [{
      type: "Spell",
      color: { r: 0.9, g: 0.4, b: 0.2, a: 0.8 },
      velocity: { x: 0.05, y: 0.15, z: 0.05 },
      count: 4,
      lifetime: 50,
      size: 0.6,
      gravity: -0.01
    }],
    "Regeneration": [{
      type: "Heart",
      color: { r: 1.0, g: 0.4, b: 0.4, a: 0.9 },
      velocity: { x: 0.02, y: 0.2, z: 0.02 },
      count: 2,
      lifetime: 60,
      size: 0.4,
      gravity: -0.03
    }],
    "Poison": [{
      type: "Spell",
      color: { r: 0.3, g: 0.8, b: 0.3, a: 0.7 },
      velocity: { x: 0.08, y: 0.05, z: 0.08 },
      count: 5,
      lifetime: 35,
      size: 0.3,
      gravity: 0.01
    }],
    "Invisibility": [{
      type: "Spell",
      color: { r: 0.8, g: 0.8, b: 1.0, a: 0.3 },
      velocity: { x: 0.12, y: 0.08, z: 0.12 },
      count: 8,
      lifetime: 30,
      size: 0.2,
      gravity: -0.02
    }],
    "NightVision": [{
      type: "Spell",
      color: { r: 0.2, g: 0.2, b: 1.0, a: 0.6 },
      velocity: { x: 0.06, y: 0.12, z: 0.06 },
      count: 3,
      lifetime: 45,
      size: 0.4,
      gravity: -0.015
    }],
    "FireResistance": [{
      type: "Flame",
      color: { r: 1.0, g: 0.6, b: 0.0, a: 0.8 },
      velocity: { x: 0.04, y: 0.18, z: 0.04 },
      count: 6,
      lifetime: 25,
      size: 0.3,
      gravity: -0.05
    }]
    // Additional effects...
  }

  return particleMap[effectType] ?? []
}

// Particle Rendering Service
interface EffectParticleRendererInterface {
  readonly spawnEffectParticles: (
    entityId: EntityId,
    effect: PotionEffect,
    position: Position,
    intensity: number
  ) => Effect.Effect<void, RenderError>

  readonly updateParticles: (
    deltaTicks: number
  ) => Effect.Effect<void, never>

  readonly getActiveParticleSystems: (
    entityId: EntityId
  ) => Effect.Effect<readonly ParticleSystem[], never>

  readonly clearEntityParticles: (
    entityId: EntityId,
    effectType?: PotionEffectType
  ) => Effect.Effect<void, never>
}

const EffectParticleRenderer = Context.GenericTag<EffectParticleRendererInterface>("@app/EffectParticleRenderer")
```

### UI Display System

```typescript
// Effect Status UI Components
const EffectStatusIcon = Schema.Struct({
  effectType: PotionEffectType,
  amplifier: Schema.Number,
  remainingTicks: Schema.Number,
  color: Schema.Struct({
    r: Schema.Number,
    g: Schema.Number,
    b: Schema.Number,
    a: Schema.Number
  }),
  texturePath: Schema.String,
  blinking: Schema.Boolean,
  ambient: Schema.Boolean,
  sortOrder: Schema.Number
})

type EffectStatusIcon = Schema.Schema.Type<typeof EffectStatusIcon>

// Screen Overlay Effects
const ScreenOverlayEffect = Schema.Struct({
  effectType: PotionEffectType,
  overlayType: Schema.Literal("ColorTint", "Distortion", "Border", "Vignette", "Particles"),
  intensity: Schema.Number.pipe(Schema.clamp(0, 1)),
  color: Schema.optional(Schema.Struct({
    r: Schema.Number,
    g: Schema.Number,
    b: Schema.Number,
    a: Schema.Number
  })),
  blendMode: Schema.Literal("Normal", "Multiply", "Screen", "Overlay", "Add"),
  animationPhase: Schema.Number
})

type ScreenOverlayEffect = Schema.Schema.Type<typeof ScreenOverlayEffect>

// UI Management Service
interface EffectUIInterface {
  readonly updateStatusDisplay: (
    playerId: PlayerId,
    activeEffects: readonly ActiveEffect[]
  ) => Effect.Effect<void, UIError>

  readonly createScreenOverlays: (
    activeEffects: readonly ActiveEffect[],
    currentTick: number
  ) => Effect.Effect<readonly ScreenOverlayEffect[], never>

  readonly showEffectNotification: (
    playerId: PlayerId,
    effect: PotionEffect,
    action: "Applied" | "Removed" | "Expired" | "Enhanced"
  ) => Effect.Effect<void, UIError>

  readonly calculateStatusIconLayout: (
    effects: readonly ActiveEffect[],
    screenWidth: number,
    screenHeight: number
  ) => Effect.Effect<readonly EffectStatusIcon[], never>
}

const EffectUI = Context.GenericTag<EffectUIInterface>("@app/EffectUI")
```

## Status Effect Calculations

### Attribute Modification System

```typescript
// Attribute Modifier Types
const AttributeModifier = Schema.Struct({
  attribute: Schema.Literal(
    "MaxHealth", "MovementSpeed", "AttackDamage", "AttackSpeed",
    "Armor", "ArmorToughness", "KnockbackResistance", "JumpHeight",
    "FlyingSpeed", "Luck", "FollowRange"
  ),
  operation: Schema.Literal("Add", "MultiplyBase", "MultiplyTotal"),
  value: Schema.Number,
  uuid: Schema.String.pipe(Schema.brand("ModifierUUID"))
})

type AttributeModifier = Schema.Schema.Type<typeof AttributeModifier>

// Effect to modifier mapping
const getEffectModifiers = (
  effect: PotionEffect
): readonly AttributeModifier[] => {
  const amplifier = effect.amplifier + 1

  const modifierMap: Record<PotionEffectType, (amp: number) => readonly AttributeModifier[]> = {
    "Speed": (amp) => [{
      attribute: "MovementSpeed",
      operation: "MultiplyBase",
      value: 0.2 * amp,
      uuid: `speed_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Slowness": (amp) => [{
      attribute: "MovementSpeed",
      operation: "MultiplyBase",
      value: -0.15 * amp,
      uuid: `slowness_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Haste": (amp) => [{
      attribute: "AttackSpeed",
      operation: "MultiplyBase",
      value: 0.1 * amp,
      uuid: `haste_${effect.id}` as AttributeModifier["uuid"]
    }],
    "MiningFatigue": (amp) => [{
      attribute: "AttackSpeed",
      operation: "MultiplyBase",
      value: -0.1 * amp,
      uuid: `mining_fatigue_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Strength": (amp) => [{
      attribute: "AttackDamage",
      operation: "Add",
      value: 3 * amp,
      uuid: `strength_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Weakness": (amp) => [{
      attribute: "AttackDamage",
      operation: "Add",
      value: -4 * amp,
      uuid: `weakness_${effect.id}` as AttributeModifier["uuid"]
    }],
    "JumpBoost": (amp) => [{
      attribute: "JumpHeight",
      operation: "Add",
      value: 0.1 * amp,
      uuid: `jump_boost_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Resistance": (amp) => [{
      attribute: "Armor",
      operation: "Add",
      value: 2 * amp,
      uuid: `resistance_${effect.id}` as AttributeModifier["uuid"]
    }],
    "HealthBoost": (amp) => [{
      attribute: "MaxHealth",
      operation: "Add",
      value: 4 * amp,
      uuid: `health_boost_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Absorption": (amp) => [{
      attribute: "MaxHealth",
      operation: "Add",
      value: 4 * amp,
      uuid: `absorption_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Luck": (amp) => [{
      attribute: "Luck",
      operation: "Add",
      value: amp,
      uuid: `luck_${effect.id}` as AttributeModifier["uuid"]
    }],
    "Unluck": (amp) => [{
      attribute: "Luck",
      operation: "Add",
      value: -amp,
      uuid: `unluck_${effect.id}` as AttributeModifier["uuid"]
    }]
  }

  const generator = modifierMap[effect.type]
  return generator ? generator(amplifier) : []
}

// Status Calculation Service
interface StatusCalculatorInterface {
  readonly calculateEntityAttributes: (
    entityId: EntityId,
    baseAttributes: EntityAttributes
  ) => Effect.Effect<EntityAttributes, never>

  readonly applyModifiers: (
    baseValue: number,
    modifiers: readonly AttributeModifier[]
  ) => number

  readonly getEffectiveMovementSpeed: (
    entityId: EntityId
  ) => Effect.Effect<number, never>

  readonly getEffectiveAttackDamage: (
    entityId: EntityId
  ) => Effect.Effect<number, never>
}

const StatusCalculator = Context.GenericTag<StatusCalculatorInterface>("@app/StatusCalculator")

// Pure modifier application function
const applyAttributeModifiers = (
  baseValue: number,
  modifiers: readonly AttributeModifier[]
): number => {
  // Group modifiers by operation type
  const addModifiers = modifiers.filter(m => m.operation === "Add")
  const multiplyBaseModifiers = modifiers.filter(m => m.operation === "MultiplyBase")
  const multiplyTotalModifiers = modifiers.filter(m => m.operation === "MultiplyTotal")

  // Apply additive modifiers first
  const afterAdd = addModifiers.reduce(
    (value, modifier) => value + modifier.value,
    baseValue
  )

  // Apply base multiplication modifiers
  const afterMultiplyBase = multiplyBaseModifiers.reduce(
    (value, modifier) => value * (1 + modifier.value),
    afterAdd
  )

  // Apply total multiplication modifiers
  const final = multiplyTotalModifiers.reduce(
    (value, modifier) => value * (1 + modifier.value),
    afterMultiplyBase
  )

  return Math.max(0, final)
}
```

## Effect Persistence and Save System

### Persistence Schema

```typescript
// Serializable Effect Data
const SerializableEffect = Schema.Struct({
  type: PotionEffectType,
  amplifier: Schema.Number,
  remainingTicks: Schema.Number,
  ambient: Schema.Boolean,
  showParticles: Schema.Boolean,
  showIcon: Schema.Boolean,
  source: Schema.Struct({
    type: Schema.String,
    sourceId: Schema.optional(Schema.String)
  }),
  appliedTick: Schema.Number,
  lastTickApplied: Schema.Number
})

type SerializableEffect = Schema.Schema.Type<typeof SerializableEffect>

// Entity Effect Save Data
const EntityEffectSaveData = Schema.Struct({
  entityId: EntityId,
  effects: Schema.Array(SerializableEffect),
  lastUpdateTick: Schema.Number,
  worldTick: Schema.Number
})

type EntityEffectSaveData = Schema.Schema.Type<typeof EntityEffectSaveData>

// World Effect Data
const WorldEffectData = Schema.Struct({
  entities: Schema.Array(EntityEffectSaveData),
  brewingStations: Schema.Array(BrewingStation),
  globalEffects: Schema.Array(Schema.Struct({
    type: Schema.String,
    data: Schema.Record(Schema.String, Schema.Unknown)
  })),
  version: Schema.Number,
  timestamp: Schema.Number
})

type WorldEffectData = Schema.Schema.Type<typeof WorldEffectData>
```

### Persistence Service

```typescript
// Persistence Management
interface EffectPersistenceInterface {
  readonly saveWorldEffects: (
    worldId: WorldId
  ) => Effect.Effect<void, PersistenceError>

  readonly loadWorldEffects: (
    worldId: WorldId
  ) => Effect.Effect<WorldEffectData, PersistenceError>

  readonly saveEntityEffects: (
    entityId: EntityId,
    effects: readonly ActiveEffect[]
  ) => Effect.Effect<void, PersistenceError>

  readonly loadEntityEffects: (
    entityId: EntityId
  ) => Effect.Effect<readonly ActiveEffect[], PersistenceError>

  readonly createWorldBackup: (
    worldId: WorldId,
    includeEffects: boolean
  ) => Effect.Effect<string, PersistenceError> // Returns backup path

  readonly restoreFromBackup: (
    backupPath: string
  ) => Effect.Effect<WorldEffectData, PersistenceError>
}

const EffectPersistence = Context.GenericTag<EffectPersistenceInterface>("@app/EffectPersistence")

// Serialization helpers
const serializeActiveEffect = (activeEffect: ActiveEffect): SerializableEffect => ({
  type: activeEffect.effect.type,
  amplifier: activeEffect.effect.amplifier,
  remainingTicks: activeEffect.effect.remainingDuration,
  ambient: activeEffect.effect.ambient,
  showParticles: activeEffect.effect.showParticles,
  showIcon: activeEffect.effect.showIcon,
  source: activeEffect.effect.source,
  appliedTick: activeEffect.appliedTick,
  lastTickApplied: activeEffect.lastTickApplied
})

const deserializeEffect = (
  serialized: SerializableEffect,
  currentTick: number
): Effect.Effect<ActiveEffect, never> =>
  Effect.gen(function* () {
    const effect: PotionEffect = {
      id: crypto.randomUUID() as PotionEffect["id"],
      type: serialized.type,
      amplifier: serialized.amplifier as PotionEffect["amplifier"],
      duration: (serialized.remainingTicks + (currentTick - serialized.appliedTick)) as PotionEffect["duration"],
      remainingDuration: serialized.remainingTicks as PotionEffect["remainingDuration"],
      showParticles: serialized.showParticles,
      showIcon: serialized.showIcon,
      ambient: serialized.ambient,
      source: serialized.source as PotionEffect["source"],
      factorData: undefined
    }

    const activeEffect: ActiveEffect = {
      id: crypto.randomUUID() as ActiveEffect["id"],
      entityId: "" as EntityId, // Will be set by caller
      effect,
      appliedTick: serialized.appliedTick,
      lastTickApplied: serialized.lastTickApplied,
      ticksActive: currentTick - serialized.appliedTick,
      suspended: false
    }

    return activeEffect
  })
```

## Performance Optimization

### ECS Integration and Memory Management

```typescript
// Effect Component (ECS Integration)
interface EffectComponentArrays {
  readonly entityIds: Int32Array
  readonly effectTypeCounts: Int32Array
  readonly effectTypes: Int32Array // Packed effect type enums
  readonly amplifiers: Int32Array
  readonly remainingDurations: Int32Array
  readonly lastTickApplied: Int32Array
  readonly showParticles: Int8Array // Boolean flags
  readonly showIcons: Int8Array
  readonly ambient: Int8Array
  readonly particleTimers: Float32Array
}

// Structure of Arrays implementation
const createEffectComponentArrays = (capacity: number): EffectComponentArrays => ({
  entityIds: new Int32Array(capacity),
  effectTypeCounts: new Int32Array(capacity),
  effectTypes: new Int32Array(capacity * 8), // Max 8 effects per entity
  amplifiers: new Int32Array(capacity * 8),
  remainingDurations: new Int32Array(capacity * 8),
  lastTickApplied: new Int32Array(capacity * 8),
  showParticles: new Int8Array(capacity * 8),
  showIcons: new Int8Array(capacity * 8),
  ambient: new Int8Array(capacity * 8),
  particleTimers: new Float32Array(capacity * 8)
})

// Batch effect updates
const updateEffectsBatch = (
  arrays: EffectComponentArrays,
  deltaTicks: number,
  currentTick: number,
  startIndex: number,
  endIndex: number
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    for (let entityIndex = startIndex; entityIndex < endIndex; entityIndex++) {
      const entityId = arrays.entityIds[entityIndex]
      if (entityId === 0) continue // Empty slot

      const effectCount = arrays.effectTypeCounts[entityIndex]
      const effectStartIndex = entityIndex * 8

      for (let effectIndex = 0; effectIndex < effectCount; effectIndex++) {
        const arrayIndex = effectStartIndex + effectIndex
        const remainingDuration = arrays.remainingDurations[arrayIndex]

        if (remainingDuration <= 0) {
          // Effect expired - remove it
          removeEffectFromArrays(arrays, entityIndex, effectIndex)
          continue
        }

        // Update remaining duration
        arrays.remainingDurations[arrayIndex] = Math.max(0, remainingDuration - deltaTicks)

        // Update particle timers
        arrays.particleTimers[arrayIndex] -= deltaTicks
        if (arrays.particleTimers[arrayIndex] <= 0 && arrays.showParticles[arrayIndex]) {
          arrays.particleTimers[arrayIndex] = 20 // Reset to 1 second
          // Trigger particle spawn
        }

        // Apply tick effects
        const tickInterval = getEffectTickInterval(arrays.effectTypes[arrayIndex])
        if (currentTick - arrays.lastTickApplied[arrayIndex] >= tickInterval) {
          arrays.lastTickApplied[arrayIndex] = currentTick
          // Apply tick-based effect logic
        }
      }
    }
  })

// Memory pool for effect instances
interface EffectMemoryPool {
  readonly activeEffects: ActiveEffect[]
  readonly freeIndices: Set<number>
  readonly usedCount: number
  readonly capacity: number
}

const createEffectMemoryPool = (initialCapacity: number = 10000): Effect.Effect<EffectMemoryPool, never> =>
  Effect.sync(() => ({
    activeEffects: new Array(initialCapacity),
    freeIndices: new Set(Array.from({ length: initialCapacity }, (_, i) => i)),
    usedCount: 0,
    capacity: initialCapacity
  }))
```

### Performance Monitoring and Optimization

```typescript
// Performance metrics
const EffectPerformanceMetrics = Schema.Struct({
  totalActiveEffects: Schema.Number,
  effectUpdatesPerSecond: Schema.Number,
  particleRenderTime: Schema.Number,
  memoryUsage: Schema.Number,
  cacheHitRate: Schema.Number,
  averageEffectsPerEntity: Schema.Number,
  peakEffectsThisFrame: Schema.Number
})

type EffectPerformanceMetrics = Schema.Schema.Type<typeof EffectPerformanceMetrics>

// Adaptive quality system
const adaptiveEffectQuality = (
  performanceMetrics: EffectPerformanceMetrics,
  targetFPS: number,
  currentFPS: number
): Effect.Effect<EffectQualitySettings, never> =>
  Effect.gen(function* () {
    const performanceRatio = currentFPS / targetFPS

    let particleQuality = 1.0
    let updateFrequency = 1
    let maxEffectsPerEntity = 8
    let enableScreenEffects = true

    if (performanceRatio < 0.8) { // Running slow
      particleQuality = 0.6
      updateFrequency = 2 // Update every 2 frames
      maxEffectsPerEntity = 6
      enableScreenEffects = false
    } else if (performanceRatio < 0.9) {
      particleQuality = 0.8
      updateFrequency = 1
      maxEffectsPerEntity = 7
      enableScreenEffects = true
    }

    return {
      particleQuality,
      updateFrequency,
      maxEffectsPerEntity,
      enableScreenEffects,
      enableParticles: particleQuality > 0,
      particleDensityMultiplier: particleQuality,
      effectUpdateInterval: updateFrequency
    }
  })
```

## Implementation Examples and Code Samples

### Complete Usage Example

```typescript
// Main implementation example - Potion consumption
const drinkPotion = (
  playerId: PlayerId,
  potionItem: PotionItem
): Effect.Effect<void, GameError> =>
  Effect.gen(function* () {
    // Early return: Player validation
    const player = yield* PlayerManager.getPlayer(playerId)
    if (!player) {
      return yield* Effect.fail(createGameError("Player not found"))
    }

    // Early return: Item validation
    const potionEffects = yield* validateAndExtractEffects(potionItem)
    if (potionEffects.length === 0) {
      return yield* Effect.fail(createGameError("Invalid potion - no effects"))
    }

    const currentTick = yield* WorldSystem.getCurrentTick()

    // Apply all effects from the potion
    yield* Effect.forEach(potionEffects, effect =>
      EffectManager.applyEffect(player.entityId, effect)
    )

    // Consume the item
    yield* PlayerInventory.removeItem(playerId, potionItem.id, 1)

    // Add empty bottle
    const emptyBottle = createGlassBottle()
    yield* PlayerInventory.addItem(playerId, emptyBottle)

    // Play consumption effects
    yield* SoundManager.playSound(player.position, "potion.drink")
    yield* EffectParticleRenderer.spawnEffectParticles(
      player.entityId,
      potionEffects[0], // Use first effect for particle color
      player.position,
      1.0
    )

    // Log action
    yield* GameLogger.logAction({
      type: "PotionConsumed",
      playerId,
      potionType: potionItem.type,
      effectsApplied: potionEffects.map(e => e.type),
      timestamp: currentTick
    })
  })

// Splash potion explosion
const explodeSplashPotion = (
  position: Position,
  splashPotion: SplashPotionItem,
  throwerEntityId: EntityId
): Effect.Effect<void, GameError> =>
  Effect.gen(function* () {
    const splashRadius = 4.0
    const potionEffects = yield* extractPotionEffects(splashPotion)
    const nearbyEntities = yield* EntityManager.getEntitiesInRadius(position, splashRadius)

    // Apply effects to all entities in range
    yield* Effect.forEach(nearbyEntities, entity =>
      Effect.gen(function* () {
        const distance = calculateDistance(position, entity.position)
        const intensity = Math.max(0.25, 1 - (distance / splashRadius))

        // Apply each effect with distance-based intensity
        yield* Effect.forEach(potionEffects, baseEffect => {
          const adjustedEffect: PotionEffect = {
            ...baseEffect,
            amplifier: Math.floor(baseEffect.amplifier * intensity) as PotionEffect["amplifier"],
            duration: Math.floor(baseEffect.duration * intensity) as PotionEffect["duration"],
            remainingDuration: Math.floor(baseEffect.duration * intensity) as PotionEffect["remainingDuration"],
            source: {
              type: "Splash",
              sourceId: splashPotion.id,
              appliedBy: throwerEntityId
            }
          }

          return EffectManager.applyEffect(entity.id, adjustedEffect)
        })
      })
    )

    // Create splash visual effects
    yield* ParticleManager.spawnExplosion(position, {
      type: "PotionSplash",
      color: getPotionColor(splashPotion),
      radius: splashRadius,
      particleCount: 50
    })

    yield* SoundManager.playSound(position, "potion.splash")
  })

// Lingering potion area effect
const createLingeringPotionCloud = (
  position: Position,
  lingeringPotion: LingeringPotionItem,
  duration: number = 600 // 30 seconds
): Effect.Effect<LingeringEffectCloud, GameError> =>
  Effect.gen(function* () {
    const cloudId = crypto.randomUUID()
    const potionEffects = yield* extractPotionEffects(lingeringPotion)

    const cloud: LingeringEffectCloud = {
      id: cloudId as LingeringEffectCloud["id"],
      position,
      radius: 3.0,
      effects: potionEffects,
      remainingTicks: duration,
      particleIntensity: 1.0,
      reapplicationInterval: 20, // Every second
      lastApplicationTick: 0,
      affectedEntities: new Set()
    }

    // Register the cloud for updates
    yield* LingeringEffectManager.registerCloud(cloud)

    // Initial particle spawn
    yield* ParticleManager.spawnLingeringCloud(position, {
      color: getPotionColor(lingeringPotion),
      radius: cloud.radius,
      duration
    })

    return cloud
  })
```

### Brewing System Implementation

```typescript
// Complete brewing process
const startBrewingProcess = (
  brewingStandId: string,
  recipe: BrewingRecipe,
  basePotions: readonly PotionItem[]
): Effect.Effect<BrewingProcess, BrewingError> =>
  Effect.gen(function* () {
    // Early return: Station validation
    const station = yield* BrewingStationManager.getStation(brewingStandId)
    if (!station) {
      return yield* Effect.fail(createBrewingError("Brewing stand not found"))
    }

    if (station.fuel <= 0) {
      return yield* Effect.fail(createBrewingError("No fuel in brewing stand"))
    }

    // Early return: Recipe validation
    const isValidCombination = yield* validateBrewingCombination(recipe, basePotions)
    if (!isValidCombination) {
      return yield* Effect.fail(createBrewingError("Invalid brewing combination"))
    }

    const currentTick = yield* WorldSystem.getCurrentTick()
    const brewingTime = calculateBrewingTime(recipe, station.efficiency)

    const process: BrewingProcess = {
      id: crypto.randomUUID() as BrewingProcess["id"],
      stationId: brewingStandId as BrewingProcess["stationId"],
      recipe,
      startTick: currentTick,
      totalTicks: brewingTime,
      remainingTicks: brewingTime,
      stage: "Brewing",
      bubbleIntensity: 0.0,
      fuelConsumed: 0
    }

    // Update station state
    yield* BrewingStationManager.updateStation(brewingStandId, {
      ...station,
      isActive: true,
      brewingProgress: 0
    })

    // Start visual effects
    yield* startBrewingEffects(station.position, brewingTime)

    return process
  })

// Brewing update loop
const updateBrewingProcess = (
  processId: string,
  deltaTicks: number
): Effect.Effect<BrewingProcess, BrewingError> =>
  Effect.gen(function* () {
    const process = yield* BrewingProcessManager.getProcess(processId)
    if (!process) {
      return yield* Effect.fail(createBrewingError("Brewing process not found"))
    }

    const newRemainingTicks = Math.max(0, process.remainingTicks - deltaTicks)
    const progress = 1 - (newRemainingTicks / process.totalTicks)

    // Calculate bubble intensity with sine wave animation
    const bubbleIntensity = Math.sin(progress * Math.PI * 6) * 0.3 + 0.7

    // Calculate fuel consumption
    const fuelRate = 1 / 400 // 1 fuel per 400 ticks (20 seconds)
    const fuelConsumed = process.fuelConsumed + (deltaTicks * fuelRate)

    const updatedProcess: BrewingProcess = {
      ...process,
      remainingTicks: newRemainingTicks,
      stage: newRemainingTicks <= 0 ? "Complete" : "Brewing",
      bubbleIntensity,
      fuelConsumed
    }

    // Update visual effects
    const station = yield* BrewingStationManager.getStation(process.stationId)
    if (station) {
      yield* updateBrewingEffects(station.position, bubbleIntensity, progress)
    }

    // Check for completion
    if (updatedProcess.stage === "Complete") {
      yield* completeBrewingProcess(processId)
    }

    return updatedProcess
  })
```

### Testing Implementation

```typescript
// Comprehensive test suite
describe("Potion Effects System", () => {
  const TestLayer = Layer.mergeAll(
    PotionEffectsSystemLayer,
    TestWorldSystemLayer,
    TestEntitySystemLayer
  )

  describe("Effect Application", () => {
    it("should apply basic effects correctly", () =>
      Effect.gen(function* () {
        const effectManager = yield* EffectManager

        const testEntity = createTestEntity("player")
        const speedEffect = createSpeedEffect(1, 1200) // Speed II for 60 seconds

        const activeEffect = yield* effectManager.applyEffect(
          testEntity.id,
          speedEffect
        )

        expect(activeEffect.effect.type).toBe("Speed")
        expect(activeEffect.effect.amplifier).toBe(1)

        const hasEffect = yield* effectManager.hasEffect(testEntity.id, "Speed")
        expect(hasEffect).toBe(true)

        const effects = yield* effectManager.getActiveEffects(testEntity.id)
        expect(effects.length).toBe(1)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it("should handle effect interactions correctly", () =>
      Effect.gen(function* () {
        const effectManager = yield* EffectManager

        const testEntity = createTestEntity("player")
        const speedEffect = createSpeedEffect(0, 1200) // Speed I
        const slowEffect = createSlowEffect(0, 1200) // Slowness I

        yield* effectManager.applyEffect(testEntity.id, speedEffect)
        yield* effectManager.applyEffect(testEntity.id, slowEffect)

        // Speed and Slowness should neutralize each other
        const effects = yield* effectManager.getActiveEffects(testEntity.id)
        expect(effects.length).toBe(0) // Both should be neutralized
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it("should calculate modifiers correctly", () =>
      Effect.gen(function* () {
        const statusCalculator = yield* StatusCalculator

        const testEntity = createTestEntity("player")
        const strengthEffect = createStrengthEffect(1, 1200) // Strength II

        yield* EffectManager.applyEffect(testEntity.id, strengthEffect)

        const attackDamage = yield* statusCalculator.getEffectiveAttackDamage(testEntity.id)
        expect(attackDamage).toBeGreaterThan(testEntity.baseAttackDamage)
        expect(attackDamage).toBe(testEntity.baseAttackDamage + 6) // +3 per amplifier level
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })

  describe("Brewing System", () => {
    it("should validate recipes correctly", () =>
      Effect.gen(function* () {
        const brewingSystem = yield* BrewingSystem

        const validIngredients = {
          primaryIngredient: "Sugar" as const,
          basePotions: ["Awkward" as const]
        }

        const recipe = yield* brewingSystem.validateRecipe(validIngredients)
        expect(Option.isSome(recipe)).toBe(true)

        const invalidIngredients = {
          primaryIngredient: "Diamond" as const, // Invalid brewing ingredient
          basePotions: ["Water" as const]
        }

        const invalidRecipe = yield* brewingSystem.validateRecipe(invalidIngredients)
        expect(Option.isNone(invalidRecipe)).toBe(true)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))

    it("should complete brewing process", () =>
      Effect.gen(function* () {
        const brewingSystem = yield* BrewingSystem

        const recipe = createSpeedPotionRecipe()
        const ingredients = {
          primaryIngredient: "Sugar" as const,
          basePotions: ["Awkward" as const]
        }

        const process = yield* brewingSystem.startBrewing(
          "test_stand",
          ingredients,
          recipe
        )

        expect(process.stage).toBe("Brewing")

        // Fast-forward through brewing
        let currentProcess = process
        while (currentProcess.stage === "Brewing") {
          currentProcess = yield* brewingSystem.updateBrewing(
            process.id,
            100 // 100 ticks at a time
          )
        }

        expect(currentProcess.stage).toBe("Complete")

        const results = yield* brewingSystem.completeBrewing(process.id)
        expect(results.length).toBeGreaterThan(0)
        expect(results[0].effects.some(e => e.type === "Speed")).toBe(true)
      }).pipe(Effect.provide(TestLayer), Effect.runPromise))
  })

  describe("Performance", () => {
    it("should handle many effects efficiently", () =>
      Effect.gen(function* () {
        const effectManager = yield* EffectManager
        const entityCount = 1000
        const effectsPerEntity = 3

        // Create many entities with multiple effects
        const entities = Array.from({ length: entityCount }, (_, i) =>
          createTestEntity(`entity_${i}`)
        )

        const startTime = performance.now()

        yield* Effect.forEach(entities, entity =>
          Effect.gen(function* () {
            for (let i = 0; i < effectsPerEntity; i++) {
              const effect = createRandomEffect()
              yield* effectManager.applyEffect(entity.id, effect)
            }
          })
        )

        // Update all effects
        yield* Effect.forEach(entities, entity =>
          effectManager.updateEffects(entity.id, 20) // 1 tick
        )

        const endTime = performance.now()
        const duration = endTime - startTime

        expect(duration).toBeLessThan(1000) // Should complete within 1 second

        // Verify all effects are applied
        const totalEffects = yield* Effect.reduce(
          entities,
          0,
          (acc, entity) =>
            Effect.gen(function* () {
              const effects = yield* effectManager.getActiveEffects(entity.id)
              return acc + effects.length
            })
        )

        expect(totalEffects).toBe(entityCount * effectsPerEntity)
      }).pipe(
        Effect.provide(TestLayer),
        Effect.runPromise
      ))
  })
})
```

## Performance Optimization Strategies

### Batch Processing and Memory Optimization

```typescript
// Batch effect updates for improved performance
const batchUpdateAllEffects = (
  entityIds: readonly EntityId[],
  deltaTicks: number,
  batchSize: number = 100
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const batches = chunk(entityIds, batchSize)

    yield* Effect.forEach(batches, batch =>
      Effect.gen(function* () {
        yield* Effect.forEach(
          batch,
          entityId => EffectManager.updateEffects(entityId, deltaTicks),
          { concurrency: 8 } // Process 8 entities concurrently
        )

        // Brief yield to prevent blocking
        yield* Effect.yieldNow()
      })
    )
  })

// Spatial optimization for particle rendering
const spatiallyOptimizedParticleRender = (
  entities: readonly Entity[],
  camera: CameraState,
  maxRenderDistance: number = 64
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Sort entities by distance from camera
    const entitiesByDistance = entities
      .map(entity => ({
        entity,
        distance: calculateDistance(entity.position, camera.position)
      }))
      .filter(({ distance }) => distance <= maxRenderDistance)
      .sort((a, b) => a.distance - b.distance)

    // Render particles with LOD
    yield* Effect.forEach(entitiesByDistance, ({ entity, distance }) =>
      Effect.gen(function* () {
        const effects = yield* EffectManager.getActiveEffects(entity.id)
        if (effects.length === 0) return

        // Calculate quality based on distance
        let quality = 1.0
        if (distance > 16) quality = 0.5
        if (distance > 32) quality = 0.25

        yield* EffectParticleRenderer.spawnEffectParticles(
          entity.id,
          effects[0], // Use primary effect for particles
          entity.position,
          quality
        )
      })
    )
  })
```

The Potion Effects System represents a sophisticated enhancement to the TypeScript Minecraft clone, providing rich gameplay mechanics through complex status effects, brewing systems, and visual feedback. By leveraging Effect-TS's functional architecture and maintaining strict type safety, the system delivers predictable behavior while supporting extensive customization and interaction patterns that enhance the overall gameplay experience.