import { GameMode, RenderDistance } from '@shared/types'
import { CHUNK_SIZE, RENDER_DISTANCE as DEFAULT_RENDER_DISTANCE } from '@shared/constants/world'
import { PLAYER_SPEED, JUMP_FORCE, GRAVITY } from '@shared/constants/physics'

/**
 * Game-specific configuration
 */

export interface GameConfig {
  // World settings
  world: {
    seed: number
    chunkSize: number
    renderDistance: RenderDistance
    maxLoadedChunks: number
    worldHeight: number
    seaLevel: number
    generateCaves: boolean
    generateOres: boolean
    generateStructures: boolean
  }

  // Player settings
  player: {
    defaultGameMode: GameMode
    spawnPosition: { x: number; y: number; z: number }
    respawnPosition?: { x: number; y: number; z: number }
    allowFlying: boolean
    movementSpeed: number
    jumpForce: number
    maxHealth: number
    maxHunger: number
  }

  // Physics settings
  physics: {
    gravity: number
    friction: number
    airResistance: number
    waterResistance: number
    enableCollision: boolean
    enableGravity: boolean
  }

  // Gameplay settings
  gameplay: {
    difficulty: 'peaceful' | 'easy' | 'normal' | 'hard'
    enableDayNightCycle: boolean
    dayLength: number // in milliseconds
    enableWeather: boolean
    enableMobs: boolean
    enableHunger: boolean
    keepInventory: boolean
  }

  // Performance settings
  performance: {
    targetFPS: number
    vSync: boolean
    lodEnabled: boolean
    frustumCulling: boolean
    occlusionCulling: boolean
    shadowsEnabled: boolean
    particlesEnabled: boolean
    maxParticles: number
  }

  // Graphics settings
  graphics: {
    renderDistance: number
    fieldOfView: number
    brightness: number
    contrast: number
    saturation: number
    antiAliasing: boolean
    textureFiltering: 'nearest' | 'linear' | 'trilinear'
    mipmapping: boolean
  }

  // Audio settings
  audio: {
    masterVolume: number
    soundVolume: number
    musicVolume: number
    ambientVolume: number
    enableSpatialAudio: boolean
  }

  // Controls settings
  controls: {
    mouseSensitivity: number
    invertMouseY: boolean
    keyBindings: {
      forward: string
      backward: string
      left: string
      right: string
      jump: string
      sneak: string
      sprint: string
      inventory: string
      chat: string
      debug: string
    }
  }
}

const defaultGameConfig: GameConfig = {
  world: {
    seed: Math.floor(Math.random() * 1000000),
    chunkSize: CHUNK_SIZE,
    renderDistance: DEFAULT_RENDER_DISTANCE as RenderDistance,
    maxLoadedChunks: 100,
    worldHeight: 256,
    seaLevel: 64,
    generateCaves: true,
    generateOres: true,
    generateStructures: true,
  },

  player: {
    defaultGameMode: 'creative',
    spawnPosition: { x: 0, y: 70, z: 0 },
    allowFlying: true,
    movementSpeed: PLAYER_SPEED,
    jumpForce: JUMP_FORCE,
    maxHealth: 20,
    maxHunger: 20,
  },

  physics: {
    gravity: GRAVITY,
    friction: 0.98,
    airResistance: 0.02,
    waterResistance: 0.8,
    enableCollision: true,
    enableGravity: true,
  },

  gameplay: {
    difficulty: 'normal',
    enableDayNightCycle: true,
    dayLength: 20 * 60 * 1000, // 20 minutes
    enableWeather: true,
    enableMobs: false, // Disabled for now
    enableHunger: false, // Disabled for creative mode
    keepInventory: true,
  },

  performance: {
    targetFPS: 60,
    vSync: true,
    lodEnabled: true,
    frustumCulling: true,
    occlusionCulling: false, // TODO: Implement
    shadowsEnabled: true,
    particlesEnabled: true,
    maxParticles: 1000,
  },

  graphics: {
    renderDistance: 8,
    fieldOfView: 75,
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    antiAliasing: true,
    textureFiltering: 'linear',
    mipmapping: true,
  },

  audio: {
    masterVolume: 1.0,
    soundVolume: 0.8,
    musicVolume: 0.6,
    ambientVolume: 0.7,
    enableSpatialAudio: true,
  },

  controls: {
    mouseSensitivity: 1.0,
    invertMouseY: false,
    keyBindings: {
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
    },
  },
}

// Create configuration with environment overrides
const createGameConfig = (): GameConfig => {
  const config = { ...defaultGameConfig }

  // Development overrides
  if (import.meta.env.MODE === 'development') {
    config.gameplay.enableMobs = false
    config.performance.targetFPS = 120 // Uncapped for development
    config.graphics.renderDistance = 4 // Lower for development
  }

  // Production optimizations
  if (import.meta.env.MODE === 'production') {
    config.performance.lodEnabled = true
    config.performance.frustumCulling = true
    config.graphics.renderDistance = 6
  }

  return config
}

export const GAME_CONFIG = createGameConfig()

// Configuration validation
export const validateGameConfig = (config: GameConfig): boolean => {
  if (config.world.chunkSize <= 0) {
    console.error('Chunk size must be positive')
    return false
  }

  if (config.world.renderDistance < 1 || config.world.renderDistance > 32) {
    console.error('Render distance must be between 1 and 32')
    return false
  }

  if (config.player.maxHealth <= 0) {
    console.error('Max health must be positive')
    return false
  }

  if (config.physics.gravity < 0) {
    console.error('Gravity cannot be negative')
    return false
  }

  if (config.performance.targetFPS <= 0) {
    console.error('Target FPS must be positive')
    return false
  }

  if (config.graphics.fieldOfView < 30 || config.graphics.fieldOfView > 120) {
    console.error('Field of view must be between 30 and 120 degrees')
    return false
  }

  return true
}

// Load user preferences from localStorage
export const loadUserGameConfig = (): Partial<GameConfig> => {
  try {
    const saved = localStorage.getItem('ts-minecraft-game-config')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.warn('Failed to load game config:', error)
  }
  return {}
}

// Save user preferences to localStorage
export const saveUserGameConfig = (config: Partial<GameConfig>): void => {
  try {
    localStorage.setItem('ts-minecraft-game-config', JSON.stringify(config))
  } catch (error) {
    console.warn('Failed to save game config:', error)
  }
}

// Merge user preferences with default config
export const getUserGameConfig = (): GameConfig => {
  const userConfig = loadUserGameConfig()
  return {
    ...GAME_CONFIG,
    ...userConfig,
    // Deep merge for nested objects
    world: { ...GAME_CONFIG.world, ...userConfig.world },
    player: { ...GAME_CONFIG.player, ...userConfig.player },
    physics: { ...GAME_CONFIG.physics, ...userConfig.physics },
    gameplay: { ...GAME_CONFIG.gameplay, ...userConfig.gameplay },
    performance: { ...GAME_CONFIG.performance, ...userConfig.performance },
    graphics: { ...GAME_CONFIG.graphics, ...userConfig.graphics },
    audio: { ...GAME_CONFIG.audio, ...userConfig.audio },
    controls: {
      ...GAME_CONFIG.controls,
      ...userConfig.controls,
      keyBindings: { ...GAME_CONFIG.controls.keyBindings, ...userConfig.controls?.keyBindings },
    },
  }
}

// Validate configuration on load
if (!validateGameConfig(GAME_CONFIG)) {
  throw new Error('Invalid game configuration')
}
