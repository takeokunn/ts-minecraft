import * as S from 'effect/Schema'
import {
  PositiveNumber,
  PositiveInteger,
  NonNegativeNumber,
  VolumeLevel,
  FieldOfView,
  RenderDistance,
  ChunkSize,
  GameMode,
  Difficulty,
  TextureFiltering,
  Position3D,
  KeyBinding,
  DurationMs,
  TargetFPS,
  MouseSensitivity,
  ColorAdjustment,
} from './common.schema'

/**
 * GameConfig schemas for comprehensive type-safe configuration
 */

// World Configuration Schema
export const WorldConfigSchema = S.Struct({
  seed: S.Number.pipe(
    S.annotations({
      title: 'World Seed',
      description: 'Random seed for world generation'
    })
  ),
  chunkSize: ChunkSize.pipe(
    S.annotations({
      title: 'Chunk Size',
      description: 'Size of each chunk in blocks (must be power of 2)'
    })
  ),
  renderDistance: RenderDistance.pipe(
    S.annotations({
      title: 'Render Distance',
      description: 'Distance in chunks to render around the player'
    })
  ),
  maxLoadedChunks: PositiveInteger.pipe(
    S.annotations({
      title: 'Max Loaded Chunks',
      description: 'Maximum number of chunks to keep loaded in memory'
    })
  ),
  worldHeight: PositiveInteger.pipe(
    S.between(128, 512),
    S.annotations({
      title: 'World Height',
      description: 'Total height of the world in blocks (128-512)'
    })
  ),
  seaLevel: S.Int.pipe(
    S.between(32, 128),
    S.annotations({
      title: 'Sea Level',
      description: 'Y-coordinate of sea level (32-128)'
    })
  ),
  generateCaves: S.Boolean.pipe(
    S.annotations({
      title: 'Generate Caves',
      description: 'Whether to generate cave systems'
    })
  ),
  generateOres: S.Boolean.pipe(
    S.annotations({
      title: 'Generate Ores',
      description: 'Whether to generate ore deposits'
    })
  ),
  generateStructures: S.Boolean.pipe(
    S.annotations({
      title: 'Generate Structures',
      description: 'Whether to generate villages, dungeons, etc.'
    })
  ),
})

// Player Configuration Schema
export const PlayerConfigSchema = S.Struct({
  defaultGameMode: GameMode.pipe(
    S.annotations({
      title: 'Default Game Mode',
      description: 'Default game mode for new players'
    })
  ),
  spawnPosition: Position3D.pipe(
    S.annotations({
      title: 'Spawn Position',
      description: 'Default spawn position for new players'
    })
  ),
  respawnPosition: S.optional(Position3D).pipe(
    S.annotations({
      title: 'Respawn Position',
      description: 'Position to respawn at after death'
    })
  ),
  allowFlying: S.Boolean.pipe(
    S.annotations({
      title: 'Allow Flying',
      description: 'Whether flying is allowed in this world'
    })
  ),
  movementSpeed: PositiveNumber.pipe(
    S.between(0.1, 20),
    S.annotations({
      title: 'Movement Speed',
      description: 'Player movement speed multiplier (0.1-20)'
    })
  ),
  jumpForce: PositiveNumber.pipe(
    S.between(0.1, 10),
    S.annotations({
      title: 'Jump Force',
      description: 'Player jump force multiplier (0.1-10)'
    })
  ),
  maxHealth: PositiveInteger.pipe(
    S.between(1, 100),
    S.annotations({
      title: 'Max Health',
      description: 'Maximum player health points (1-100)'
    })
  ),
  maxHunger: PositiveInteger.pipe(
    S.between(1, 100),
    S.annotations({
      title: 'Max Hunger',
      description: 'Maximum player hunger points (1-100)'
    })
  ),
})

// Physics Configuration Schema
export const PhysicsConfigSchema = S.Struct({
  gravity: PositiveNumber.pipe(
    S.between(0.1, 50),
    S.annotations({
      title: 'Gravity',
      description: 'Gravitational acceleration (0.1-50)'
    })
  ),
  friction: S.Number.pipe(
    S.between(0, 1),
    S.annotations({
      title: 'Friction',
      description: 'Surface friction coefficient (0-1)'
    })
  ),
  airResistance: S.Number.pipe(
    S.between(0, 1),
    S.annotations({
      title: 'Air Resistance',
      description: 'Air resistance coefficient (0-1)'
    })
  ),
  waterResistance: S.Number.pipe(
    S.between(0, 1),
    S.annotations({
      title: 'Water Resistance',
      description: 'Water resistance coefficient (0-1)'
    })
  ),
  enableCollision: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Collision',
      description: 'Whether collision detection is enabled'
    })
  ),
  enableGravity: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Gravity',
      description: 'Whether gravity physics are enabled'
    })
  ),
})

// Gameplay Configuration Schema
export const GameplayConfigSchema = S.Struct({
  difficulty: Difficulty.pipe(
    S.annotations({
      title: 'Difficulty',
      description: 'Game difficulty level'
    })
  ),
  enableDayNightCycle: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Day/Night Cycle',
      description: 'Whether day/night cycle is enabled'
    })
  ),
  dayLength: DurationMs.pipe(
    S.between(60000, 3600000), // 1 minute to 1 hour
    S.annotations({
      title: 'Day Length',
      description: 'Length of a full day in milliseconds (1 min - 1 hour)'
    })
  ),
  enableWeather: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Weather',
      description: 'Whether weather effects are enabled'
    })
  ),
  enableMobs: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Mobs',
      description: 'Whether hostile mobs spawn'
    })
  ),
  enableHunger: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Hunger',
      description: 'Whether hunger mechanic is enabled'
    })
  ),
  keepInventory: S.Boolean.pipe(
    S.annotations({
      title: 'Keep Inventory',
      description: 'Whether items are kept on death'
    })
  ),
})

// Performance Configuration Schema
export const PerformanceConfigSchema = S.Struct({
  targetFPS: TargetFPS.pipe(
    S.annotations({
      title: 'Target FPS',
      description: 'Target frames per second for rendering'
    })
  ),
  vSync: S.Boolean.pipe(
    S.annotations({
      title: 'VSync',
      description: 'Whether vertical synchronization is enabled'
    })
  ),
  lodEnabled: S.Boolean.pipe(
    S.annotations({
      title: 'LOD Enabled',
      description: 'Whether level-of-detail optimization is enabled'
    })
  ),
  frustumCulling: S.Boolean.pipe(
    S.annotations({
      title: 'Frustum Culling',
      description: 'Whether frustum culling is enabled'
    })
  ),
  occlusionCulling: S.Boolean.pipe(
    S.annotations({
      title: 'Occlusion Culling',
      description: 'Whether occlusion culling is enabled'
    })
  ),
  shadowsEnabled: S.Boolean.pipe(
    S.annotations({
      title: 'Shadows Enabled',
      description: 'Whether shadow rendering is enabled'
    })
  ),
  particlesEnabled: S.Boolean.pipe(
    S.annotations({
      title: 'Particles Enabled',
      description: 'Whether particle effects are enabled'
    })
  ),
  maxParticles: PositiveInteger.pipe(
    S.between(100, 10000),
    S.annotations({
      title: 'Max Particles',
      description: 'Maximum number of particles to render (100-10000)'
    })
  ),
})

// Graphics Configuration Schema
export const GraphicsConfigSchema = S.Struct({
  renderDistance: S.Int.pipe(
    S.between(1, 32),
    S.annotations({
      title: 'Graphics Render Distance',
      description: 'Render distance for graphics (1-32 chunks)'
    })
  ),
  fieldOfView: FieldOfView.pipe(
    S.annotations({
      title: 'Field of View',
      description: 'Camera field of view in degrees'
    })
  ),
  brightness: ColorAdjustment.pipe(
    S.annotations({
      title: 'Brightness',
      description: 'Screen brightness adjustment'
    })
  ),
  contrast: ColorAdjustment.pipe(
    S.annotations({
      title: 'Contrast',
      description: 'Screen contrast adjustment'
    })
  ),
  saturation: ColorAdjustment.pipe(
    S.annotations({
      title: 'Saturation',
      description: 'Color saturation adjustment'
    })
  ),
  antiAliasing: S.Boolean.pipe(
    S.annotations({
      title: 'Anti-aliasing',
      description: 'Whether anti-aliasing is enabled'
    })
  ),
  textureFiltering: TextureFiltering.pipe(
    S.annotations({
      title: 'Texture Filtering',
      description: 'Texture filtering method'
    })
  ),
  mipmapping: S.Boolean.pipe(
    S.annotations({
      title: 'Mipmapping',
      description: 'Whether texture mipmapping is enabled'
    })
  ),
})

// Audio Configuration Schema
export const AudioConfigSchema = S.Struct({
  masterVolume: VolumeLevel.pipe(
    S.annotations({
      title: 'Master Volume',
      description: 'Overall audio volume level'
    })
  ),
  soundVolume: VolumeLevel.pipe(
    S.annotations({
      title: 'Sound Volume',
      description: 'Sound effects volume level'
    })
  ),
  musicVolume: VolumeLevel.pipe(
    S.annotations({
      title: 'Music Volume',
      description: 'Background music volume level'
    })
  ),
  ambientVolume: VolumeLevel.pipe(
    S.annotations({
      title: 'Ambient Volume',
      description: 'Ambient sound volume level'
    })
  ),
  enableSpatialAudio: S.Boolean.pipe(
    S.annotations({
      title: 'Enable Spatial Audio',
      description: 'Whether 3D positional audio is enabled'
    })
  ),
})

// Key Bindings Configuration Schema
export const KeyBindingsSchema = S.Struct({
  forward: KeyBinding.pipe(
    S.annotations({
      title: 'Forward Key',
      description: 'Key binding for forward movement'
    })
  ),
  backward: KeyBinding.pipe(
    S.annotations({
      title: 'Backward Key',
      description: 'Key binding for backward movement'
    })
  ),
  left: KeyBinding.pipe(
    S.annotations({
      title: 'Left Key',
      description: 'Key binding for left movement'
    })
  ),
  right: KeyBinding.pipe(
    S.annotations({
      title: 'Right Key',
      description: 'Key binding for right movement'
    })
  ),
  jump: KeyBinding.pipe(
    S.annotations({
      title: 'Jump Key',
      description: 'Key binding for jumping'
    })
  ),
  sneak: KeyBinding.pipe(
    S.annotations({
      title: 'Sneak Key',
      description: 'Key binding for sneaking'
    })
  ),
  sprint: KeyBinding.pipe(
    S.annotations({
      title: 'Sprint Key',
      description: 'Key binding for sprinting'
    })
  ),
  inventory: KeyBinding.pipe(
    S.annotations({
      title: 'Inventory Key',
      description: 'Key binding for opening inventory'
    })
  ),
  chat: KeyBinding.pipe(
    S.annotations({
      title: 'Chat Key',
      description: 'Key binding for opening chat'
    })
  ),
  debug: KeyBinding.pipe(
    S.annotations({
      title: 'Debug Key',
      description: 'Key binding for debug information'
    })
  ),
})

// Controls Configuration Schema
export const ControlsConfigSchema = S.Struct({
  mouseSensitivity: MouseSensitivity.pipe(
    S.annotations({
      title: 'Mouse Sensitivity',
      description: 'Mouse sensitivity for camera movement'
    })
  ),
  invertMouseY: S.Boolean.pipe(
    S.annotations({
      title: 'Invert Mouse Y',
      description: 'Whether to invert Y-axis mouse movement'
    })
  ),
  keyBindings: KeyBindingsSchema.pipe(
    S.annotations({
      title: 'Key Bindings',
      description: 'Keyboard key bindings for game controls'
    })
  ),
})

// Main Game Configuration Schema
export const GameConfigSchema = S.Struct({
  world: WorldConfigSchema.pipe(
    S.annotations({
      title: 'World Configuration',
      description: 'World generation and management settings'
    })
  ),
  player: PlayerConfigSchema.pipe(
    S.annotations({
      title: 'Player Configuration',
      description: 'Player-related settings and attributes'
    })
  ),
  physics: PhysicsConfigSchema.pipe(
    S.annotations({
      title: 'Physics Configuration',
      description: 'Physics simulation parameters'
    })
  ),
  gameplay: GameplayConfigSchema.pipe(
    S.annotations({
      title: 'Gameplay Configuration',
      description: 'Core gameplay mechanics settings'
    })
  ),
  performance: PerformanceConfigSchema.pipe(
    S.annotations({
      title: 'Performance Configuration',
      description: 'Performance and optimization settings'
    })
  ),
  graphics: GraphicsConfigSchema.pipe(
    S.annotations({
      title: 'Graphics Configuration',
      description: 'Visual rendering and display settings'
    })
  ),
  audio: AudioConfigSchema.pipe(
    S.annotations({
      title: 'Audio Configuration',
      description: 'Audio and sound settings'
    })
  ),
  controls: ControlsConfigSchema.pipe(
    S.annotations({
      title: 'Controls Configuration',
      description: 'Input and control settings'
    })
  ),
}).pipe(
  S.annotations({
    title: 'Game Configuration',
    description: 'Complete game configuration with all subsections'
  })
)

// Export type
export type GameConfig = S.Schema.Type<typeof GameConfigSchema>

// Individual section types for convenience
export type WorldConfig = S.Schema.Type<typeof WorldConfigSchema>
export type PlayerConfig = S.Schema.Type<typeof PlayerConfigSchema>
export type PhysicsConfig = S.Schema.Type<typeof PhysicsConfigSchema>
export type GameplayConfig = S.Schema.Type<typeof GameplayConfigSchema>
export type PerformanceConfig = S.Schema.Type<typeof PerformanceConfigSchema>
export type GraphicsConfig = S.Schema.Type<typeof GraphicsConfigSchema>
export type AudioConfig = S.Schema.Type<typeof AudioConfigSchema>
export type ControlsConfig = S.Schema.Type<typeof ControlsConfigSchema>
export type KeyBindings = S.Schema.Type<typeof KeyBindingsSchema>

// Default configurations
export const defaultWorldConfig: WorldConfig = {
  seed: Math.floor(Math.random() * 1000000),
  chunkSize: 16,
  renderDistance: 8,
  maxLoadedChunks: 100,
  worldHeight: 256,
  seaLevel: 64,
  generateCaves: true,
  generateOres: true,
  generateStructures: true,
}

export const defaultPlayerConfig: PlayerConfig = {
  defaultGameMode: 'creative',
  spawnPosition: { x: 0, y: 70, z: 0 },
  allowFlying: true,
  movementSpeed: 4.317,
  jumpForce: 0.42,
  maxHealth: 20,
  maxHunger: 20,
}

export const defaultPhysicsConfig: PhysicsConfig = {
  gravity: 9.8,
  friction: 0.98,
  airResistance: 0.02,
  waterResistance: 0.8,
  enableCollision: true,
  enableGravity: true,
}

export const defaultGameplayConfig: GameplayConfig = {
  difficulty: 'normal',
  enableDayNightCycle: true,
  dayLength: 1200000, // 20 minutes
  enableWeather: true,
  enableMobs: false,
  enableHunger: false,
  keepInventory: true,
}

export const defaultPerformanceConfig: PerformanceConfig = {
  targetFPS: 60,
  vSync: true,
  lodEnabled: true,
  frustumCulling: true,
  occlusionCulling: false,
  shadowsEnabled: true,
  particlesEnabled: true,
  maxParticles: 1000,
}

export const defaultGraphicsConfig: GraphicsConfig = {
  renderDistance: 8,
  fieldOfView: 75,
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  antiAliasing: true,
  textureFiltering: 'linear',
  mipmapping: true,
}

export const defaultAudioConfig: AudioConfig = {
  masterVolume: 1.0,
  soundVolume: 0.8,
  musicVolume: 0.6,
  ambientVolume: 0.7,
  enableSpatialAudio: true,
}

export const defaultKeyBindings: KeyBindings = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sneak: 'ShiftLeft',
  sprint: 'ControlLeft',
  inventory: 'KeyE',
  chat: 'KeyT',
  debug: 'F3',
}

export const defaultControlsConfig: ControlsConfig = {
  mouseSensitivity: 1.0,
  invertMouseY: false,
  keyBindings: defaultKeyBindings,
}

export const defaultGameConfig: GameConfig = {
  world: defaultWorldConfig,
  player: defaultPlayerConfig,
  physics: defaultPhysicsConfig,
  gameplay: defaultGameplayConfig,
  performance: defaultPerformanceConfig,
  graphics: defaultGraphicsConfig,
  audio: defaultAudioConfig,
  controls: defaultControlsConfig,
}