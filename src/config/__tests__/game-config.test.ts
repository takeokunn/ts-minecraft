import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect } from 'effect'
import * as S from 'effect/Schema'
import {
  GameConfigSchema,
  WorldConfigSchema,
  PlayerConfigSchema,
  PhysicsConfigSchema,
  GameplayConfigSchema,
  PerformanceConfigSchema,
  GraphicsConfigSchema,
  AudioConfigSchema,
  ControlsConfigSchema,
  KeyBindingsSchema,
  defaultGameConfig,
  defaultWorldConfig,
  defaultPlayerConfig,
  defaultPhysicsConfig,
  defaultGameplayConfig,
  defaultPerformanceConfig,
  defaultGraphicsConfig,
  defaultAudioConfig,
  defaultControlsConfig,
  defaultKeyBindings,
  type GameConfig,
  type WorldConfig,
  type PlayerConfig,
  type PhysicsConfig,
  type GameplayConfig,
  type PerformanceConfig,
  type GraphicsConfig,
  type AudioConfig,
  type ControlsConfig,
  type KeyBindings,
} from '../schemas/game.schema'
import {
  GAME_CONFIG,
} from '../game-config'


describe('GameConfig Schemas', () => {

  describe('WorldConfigSchema', () => {
    it('should validate correct world configuration', async () => {
      const validConfig: WorldConfig = {
        seed: 12345,
        chunkSize: 16,
        renderDistance: 8,
        maxLoadedChunks: 100,
        worldHeight: 256,
        seaLevel: 64,
        generateCaves: true,
        generateOres: true,
        generateStructures: true,
      }

      const result = await Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept power-of-two chunk sizes', async () => {
      const powerOfTwoSizes = [2, 4, 8, 16, 32, 64, 128]
      
      for (const chunkSize of powerOfTwoSizes) {
        const config = {
          ...defaultWorldConfig,
          chunkSize,
        }
        
        const result = await Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(config))
        expect(result.chunkSize).toBe(chunkSize)
      }
    })

    it('should reject non-power-of-two chunk sizes', async () => {
      const invalidSizes = [3, 5, 6, 7, 9, 10, 15, 17]
      
      for (const chunkSize of invalidSizes) {
        const config = {
          ...defaultWorldConfig,
          chunkSize,
        }
        
        await expect(
          Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate render distance bounds', async () => {
      const validDistances = [1, 2, 8, 16, 32]
      const invalidDistances = [0, -1, 33, 50]
      
      for (const renderDistance of validDistances) {
        const config = { ...defaultWorldConfig, renderDistance }
        const result = await Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(config))
        expect(result.renderDistance).toBe(renderDistance)
      }
      
      for (const renderDistance of invalidDistances) {
        const config = { ...defaultWorldConfig, renderDistance }
        await expect(
          Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate world height bounds', async () => {
      const validHeights = [128, 256, 384, 512]
      const invalidHeights = [64, 127, 513, 1024]
      
      for (const worldHeight of validHeights) {
        const config = { ...defaultWorldConfig, worldHeight }
        const result = await Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(config))
        expect(result.worldHeight).toBe(worldHeight)
      }
      
      for (const worldHeight of invalidHeights) {
        const config = { ...defaultWorldConfig, worldHeight }
        await expect(
          Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate sea level bounds', async () => {
      const validLevels = [32, 64, 100, 128]
      const invalidLevels = [31, 129, 0, -10]
      
      for (const seaLevel of validLevels) {
        const config = { ...defaultWorldConfig, seaLevel }
        const result = await Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(config))
        expect(result.seaLevel).toBe(seaLevel)
      }
      
      for (const seaLevel of invalidLevels) {
        const config = { ...defaultWorldConfig, seaLevel }
        await expect(
          Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should reject invalid boolean values for generation flags', async () => {
      const invalidConfigs = [
        { ...defaultWorldConfig, generateCaves: 'true' },
        { ...defaultWorldConfig, generateOres: 1 },
        { ...defaultWorldConfig, generateStructures: null },
      ]

      for (const config of invalidConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('PlayerConfigSchema', () => {
    it('should validate correct player configuration', async () => {
      const validConfig: PlayerConfig = {
        defaultGameMode: 'creative',
        spawnPosition: { x: 0, y: 70, z: 0 },
        allowFlying: true,
        movementSpeed: 4.317,
        jumpForce: 0.42,
        maxHealth: 20,
        maxHunger: 20,
      }

      const result = await Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept all valid game modes', async () => {
      const gameModes = ['survival', 'creative', 'adventure', 'spectator'] as const
      
      for (const gameMode of gameModes) {
        const config = { ...defaultPlayerConfig, defaultGameMode: gameMode }
        const result = await Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(config))
        expect(result.defaultGameMode).toBe(gameMode)
      }
    })

    it('should reject invalid game modes', async () => {
      const invalidModes = ['hardcore', 'peaceful', 'easy', 'normal']
      
      for (const gameMode of invalidModes) {
        const config = { ...defaultPlayerConfig, defaultGameMode: gameMode }
        await expect(
          Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate movement speed bounds', async () => {
      const validSpeeds = [0.1, 1.0, 4.317, 10.0, 20.0]
      const invalidSpeeds = [0, -1, 21, 100]
      
      for (const speed of validSpeeds) {
        const config = { ...defaultPlayerConfig, movementSpeed: speed }
        const result = await Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(config))
        expect(result.movementSpeed).toBe(speed)
      }
      
      for (const speed of invalidSpeeds) {
        const config = { ...defaultPlayerConfig, movementSpeed: speed }
        await expect(
          Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate jump force bounds', async () => {
      const validForces = [0.1, 0.42, 1.0, 5.0, 10.0]
      const invalidForces = [0, -1, 11, 20]
      
      for (const force of validForces) {
        const config = { ...defaultPlayerConfig, jumpForce: force }
        const result = await Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(config))
        expect(result.jumpForce).toBe(force)
      }
      
      for (const force of invalidForces) {
        const config = { ...defaultPlayerConfig, jumpForce: force }
        await expect(
          Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate health and hunger bounds', async () => {
      const validValues = [1, 10, 20, 50, 100]
      const invalidValues = [0, -1, 101, 200]
      
      for (const value of validValues) {
        const healthConfig = { ...defaultPlayerConfig, maxHealth: value }
        const hungerConfig = { ...defaultPlayerConfig, maxHunger: value }
        
        const healthResult = await Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(healthConfig))
        const hungerResult = await Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(hungerConfig))
        
        expect(healthResult.maxHealth).toBe(value)
        expect(hungerResult.maxHunger).toBe(value)
      }
      
      for (const value of invalidValues) {
        const healthConfig = { ...defaultPlayerConfig, maxHealth: value }
        const hungerConfig = { ...defaultPlayerConfig, maxHunger: value }
        
        await expect(
          Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(healthConfig))
        ).rejects.toThrow()
        
        await expect(
          Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(hungerConfig))
        ).rejects.toThrow()
      }
    })

    it('should accept optional respawn position', async () => {
      const configWithRespawn = {
        ...defaultPlayerConfig,
        respawnPosition: { x: 100, y: 80, z: -50 },
      }
      
      const configWithoutRespawn = {
        ...defaultPlayerConfig,
        // respawnPosition is optional
      }
      
      const resultWith = await Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(configWithRespawn))
      const resultWithout = await Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(configWithoutRespawn))
      
      expect(resultWith.respawnPosition).toEqual({ x: 100, y: 80, z: -50 })
      expect(resultWithout.respawnPosition).toBeUndefined()
    })
  })

  describe('PhysicsConfigSchema', () => {
    it('should validate correct physics configuration', async () => {
      const validConfig: PhysicsConfig = {
        gravity: 9.8,
        friction: 0.98,
        airResistance: 0.02,
        waterResistance: 0.8,
        enableCollision: true,
        enableGravity: true,
      }

      const result = await Effect.runPromise(S.decodeUnknown(PhysicsConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate gravity bounds', async () => {
      const validGravityValues = [0.1, 1.0, 9.8, 25.0, 50.0]
      const invalidGravityValues = [0, -1, 51, 100]
      
      for (const gravity of validGravityValues) {
        const config = { ...defaultPhysicsConfig, gravity }
        const result = await Effect.runPromise(S.decodeUnknown(PhysicsConfigSchema)(config))
        expect(result.gravity).toBe(gravity)
      }
      
      for (const gravity of invalidGravityValues) {
        const config = { ...defaultPhysicsConfig, gravity }
        await expect(
          Effect.runPromise(S.decodeUnknown(PhysicsConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate resistance coefficients bounds (0-1)', async () => {
      const validCoefficients = [0, 0.02, 0.5, 0.98, 1.0]
      const invalidCoefficients = [-0.1, 1.1, 2.0]
      const resistanceFields = ['friction', 'airResistance', 'waterResistance'] as const
      
      for (const field of resistanceFields) {
        for (const value of validCoefficients) {
          const config = { ...defaultPhysicsConfig, [field]: value }
          const result = await Effect.runPromise(S.decodeUnknown(PhysicsConfigSchema)(config))
          expect(result[field]).toBe(value)
        }
        
        for (const value of invalidCoefficients) {
          const config = { ...defaultPhysicsConfig, [field]: value }
          await expect(
            Effect.runPromise(S.decodeUnknown(PhysicsConfigSchema)(config))
          ).rejects.toThrow()
        }
      }
    })
  })

  describe('GameplayConfigSchema', () => {
    it('should validate correct gameplay configuration', async () => {
      const validConfig: GameplayConfig = {
        difficulty: 'normal',
        enableDayNightCycle: true,
        dayLength: 1200000,
        enableWeather: true,
        enableMobs: false,
        enableHunger: false,
        keepInventory: true,
      }

      const result = await Effect.runPromise(S.decodeUnknown(GameplayConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should accept all valid difficulty levels', async () => {
      const difficulties = ['peaceful', 'easy', 'normal', 'hard'] as const
      
      for (const difficulty of difficulties) {
        const config = { ...defaultGameplayConfig, difficulty }
        const result = await Effect.runPromise(S.decodeUnknown(GameplayConfigSchema)(config))
        expect(result.difficulty).toBe(difficulty)
      }
    })

    it('should validate day length bounds', async () => {
      const validLengths = [60000, 300000, 1200000, 3600000] // 1min to 1hour
      const invalidLengths = [30000, 59999, 3600001, 7200000]
      
      for (const dayLength of validLengths) {
        const config = { ...defaultGameplayConfig, dayLength }
        const result = await Effect.runPromise(S.decodeUnknown(GameplayConfigSchema)(config))
        expect(result.dayLength).toBe(dayLength)
      }
      
      for (const dayLength of invalidLengths) {
        const config = { ...defaultGameplayConfig, dayLength }
        await expect(
          Effect.runPromise(S.decodeUnknown(GameplayConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('PerformanceConfigSchema', () => {
    it('should validate correct performance configuration', async () => {
      const validConfig: PerformanceConfig = {
        targetFPS: 60,
        vSync: true,
        lodEnabled: true,
        frustumCulling: true,
        occlusionCulling: false,
        shadowsEnabled: true,
        particlesEnabled: true,
        maxParticles: 1000,
      }

      const result = await Effect.runPromise(S.decodeUnknown(PerformanceConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate target FPS bounds', async () => {
      const validFPS = [30, 60, 120, 144, 240]
      const invalidFPS = [29, 241, 0, -30]
      
      for (const targetFPS of validFPS) {
        const config = { ...defaultPerformanceConfig, targetFPS }
        const result = await Effect.runPromise(S.decodeUnknown(PerformanceConfigSchema)(config))
        expect(result.targetFPS).toBe(targetFPS)
      }
      
      for (const targetFPS of invalidFPS) {
        const config = { ...defaultPerformanceConfig, targetFPS }
        await expect(
          Effect.runPromise(S.decodeUnknown(PerformanceConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate max particles bounds', async () => {
      const validParticleCounts = [100, 500, 1000, 5000, 10000]
      const invalidParticleCounts = [99, 10001, 0, -100]
      
      for (const maxParticles of validParticleCounts) {
        const config = { ...defaultPerformanceConfig, maxParticles }
        const result = await Effect.runPromise(S.decodeUnknown(PerformanceConfigSchema)(config))
        expect(result.maxParticles).toBe(maxParticles)
      }
      
      for (const maxParticles of invalidParticleCounts) {
        const config = { ...defaultPerformanceConfig, maxParticles }
        await expect(
          Effect.runPromise(S.decodeUnknown(PerformanceConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('GraphicsConfigSchema', () => {
    it('should validate correct graphics configuration', async () => {
      const validConfig: GraphicsConfig = {
        renderDistance: 8,
        fieldOfView: 75,
        brightness: 1.0,
        contrast: 1.0,
        saturation: 1.0,
        antiAliasing: true,
        textureFiltering: 'linear',
        mipmapping: true,
      }

      const result = await Effect.runPromise(S.decodeUnknown(GraphicsConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate field of view bounds', async () => {
      const validFOV = [30, 60, 75, 90, 120]
      const invalidFOV = [29, 121, 0, 180]
      
      for (const fieldOfView of validFOV) {
        const config = { ...defaultGraphicsConfig, fieldOfView }
        const result = await Effect.runPromise(S.decodeUnknown(GraphicsConfigSchema)(config))
        expect(result.fieldOfView).toBe(fieldOfView)
      }
      
      for (const fieldOfView of invalidFOV) {
        const config = { ...defaultGraphicsConfig, fieldOfView }
        await expect(
          Effect.runPromise(S.decodeUnknown(GraphicsConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should validate color adjustment bounds', async () => {
      const validAdjustments = [0.1, 0.5, 1.0, 1.5, 2.0]
      const invalidAdjustments = [0.09, 2.01, -1, 3]
      const adjustmentFields = ['brightness', 'contrast', 'saturation'] as const
      
      for (const field of adjustmentFields) {
        for (const value of validAdjustments) {
          const config = { ...defaultGraphicsConfig, [field]: value }
          const result = await Effect.runPromise(S.decodeUnknown(GraphicsConfigSchema)(config))
          expect(result[field]).toBe(value)
        }
        
        for (const value of invalidAdjustments) {
          const config = { ...defaultGraphicsConfig, [field]: value }
          await expect(
            Effect.runPromise(S.decodeUnknown(GraphicsConfigSchema)(config))
          ).rejects.toThrow()
        }
      }
    })

    it('should accept all valid texture filtering modes', async () => {
      const filteringModes = ['nearest', 'linear', 'trilinear'] as const
      
      for (const mode of filteringModes) {
        const config = { ...defaultGraphicsConfig, textureFiltering: mode }
        const result = await Effect.runPromise(S.decodeUnknown(GraphicsConfigSchema)(config))
        expect(result.textureFiltering).toBe(mode)
      }
    })
  })

  describe('AudioConfigSchema', () => {
    it('should validate correct audio configuration', async () => {
      const validConfig: AudioConfig = {
        masterVolume: 1.0,
        soundVolume: 0.8,
        musicVolume: 0.6,
        ambientVolume: 0.7,
        enableSpatialAudio: true,
      }

      const result = await Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate volume level bounds (0-1)', async () => {
      const validVolumes = [0, 0.1, 0.5, 0.8, 1.0]
      const invalidVolumes = [-0.1, 1.1, 2.0, -1]
      const volumeFields = ['masterVolume', 'soundVolume', 'musicVolume', 'ambientVolume'] as const
      
      for (const field of volumeFields) {
        for (const volume of validVolumes) {
          const config = { ...defaultAudioConfig, [field]: volume }
          const result = await Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
          expect(result[field]).toBe(volume)
        }
        
        for (const volume of invalidVolumes) {
          const config = { ...defaultAudioConfig, [field]: volume }
          await expect(
            Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(config))
          ).rejects.toThrow()
        }
      }
    })
  })

  describe('KeyBindingsSchema', () => {
    it('should validate correct key bindings', async () => {
      const validBindings: KeyBindings = {
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

      const result = await Effect.runPromise(S.decodeUnknown(KeyBindingsSchema)(validBindings))
      expect(result).toEqual(validBindings)
    })

    it('should reject empty key bindings', async () => {
      const invalidBindings = {
        ...defaultKeyBindings,
        forward: '',
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(KeyBindingsSchema)(invalidBindings))
      ).rejects.toThrow()
    })

    it('should accept various key formats', async () => {
      const validKeys = ['KeyA', 'Space', 'F3', 'ShiftLeft', 'ControlRight', 'AltLeft']
      
      for (const key of validKeys) {
        const bindings = { ...defaultKeyBindings, forward: key }
        const result = await Effect.runPromise(S.decodeUnknown(KeyBindingsSchema)(bindings))
        expect(result.forward).toBe(key)
      }
    })
  })

  describe('ControlsConfigSchema', () => {
    it('should validate correct controls configuration', async () => {
      const validConfig: ControlsConfig = {
        mouseSensitivity: 1.0,
        invertMouseY: false,
        keyBindings: defaultKeyBindings,
      }

      const result = await Effect.runPromise(S.decodeUnknown(ControlsConfigSchema)(validConfig))
      expect(result).toEqual(validConfig)
    })

    it('should validate mouse sensitivity bounds', async () => {
      const validSensitivities = [0.1, 0.5, 1.0, 2.5, 5.0]
      const invalidSensitivities = [0.09, 5.01, 0, -1]
      
      for (const sensitivity of validSensitivities) {
        const config = { ...defaultControlsConfig, mouseSensitivity: sensitivity }
        const result = await Effect.runPromise(S.decodeUnknown(ControlsConfigSchema)(config))
        expect(result.mouseSensitivity).toBe(sensitivity)
      }
      
      for (const sensitivity of invalidSensitivities) {
        const config = { ...defaultControlsConfig, mouseSensitivity: sensitivity }
        await expect(
          Effect.runPromise(S.decodeUnknown(ControlsConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('GameConfigSchema (Complete)', () => {
    it('should validate complete game configuration', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(GameConfigSchema)(defaultGameConfig))
      expect(result).toEqual(defaultGameConfig)
    })

    it('should reject incomplete configuration', async () => {
      const incompleteConfigs = [
        { world: defaultWorldConfig }, // missing other sections
        { world: defaultWorldConfig, player: defaultPlayerConfig }, // missing other sections
        {}, // empty object
      ]

      for (const config of incompleteConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(GameConfigSchema)(config))
        ).rejects.toThrow()
      }
    })
  })

  describe('Default Configurations', () => {
    it('should have valid default world config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(WorldConfigSchema)(defaultWorldConfig))
      expect(result).toEqual(defaultWorldConfig)
      expect(result.chunkSize & (result.chunkSize - 1)).toBe(0) // power of 2 check
    })

    it('should have valid default player config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(PlayerConfigSchema)(defaultPlayerConfig))
      expect(result).toEqual(defaultPlayerConfig)
    })

    it('should have valid default physics config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(PhysicsConfigSchema)(defaultPhysicsConfig))
      expect(result).toEqual(defaultPhysicsConfig)
    })

    it('should have valid default gameplay config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(GameplayConfigSchema)(defaultGameplayConfig))
      expect(result).toEqual(defaultGameplayConfig)
    })

    it('should have valid default performance config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(PerformanceConfigSchema)(defaultPerformanceConfig))
      expect(result).toEqual(defaultPerformanceConfig)
    })

    it('should have valid default graphics config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(GraphicsConfigSchema)(defaultGraphicsConfig))
      expect(result).toEqual(defaultGraphicsConfig)
    })

    it('should have valid default audio config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(AudioConfigSchema)(defaultAudioConfig))
      expect(result).toEqual(defaultAudioConfig)
    })

    it('should have valid default controls config', async () => {
      const result = await Effect.runPromise(S.decodeUnknown(ControlsConfigSchema)(defaultControlsConfig))
      expect(result).toEqual(defaultControlsConfig)
    })
  })

  describe('Backward Compatibility Layer', () => {
    describe('GAME_CONFIG export', () => {
      it('should export default game config', () => {
        expect(GAME_CONFIG).toEqual(defaultGameConfig)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle deeply nested invalid values', async () => {
      const invalidConfig = {
        ...defaultGameConfig,
        world: {
          ...defaultWorldConfig,
          chunkSize: 'invalid',
        },
        player: {
          ...defaultPlayerConfig,
          spawnPosition: {
            x: 'not-a-number',
            y: 0,
            z: 0,
          },
        },
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(GameConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should handle null/undefined nested objects', async () => {
      const invalidConfigs = [
        { ...defaultGameConfig, world: null },
        { ...defaultGameConfig, player: undefined },
        { ...defaultGameConfig, physics: 'not-an-object' },
      ]

      for (const config of invalidConfigs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(GameConfigSchema)(config))
        ).rejects.toThrow()
      }
    })

    it('should handle array type mismatches', async () => {
      const invalidConfig = {
        ...defaultGameConfig,
        controls: {
          ...defaultControlsConfig,
          keyBindings: [], // should be object
        },
      }

      await expect(
        Effect.runPromise(S.decodeUnknown(GameConfigSchema)(invalidConfig))
      ).rejects.toThrow()
    })

    it('should validate cross-field constraints', async () => {
      // Example: sea level should be reasonable relative to world height
      const config = {
        ...defaultGameConfig,
        world: {
          ...defaultWorldConfig,
          worldHeight: 128,
          seaLevel: 128, // sea level at max height
        },
      }

      // This should pass schema validation (individual constraints are met)
      // but might fail business logic validation in the service layer
      const result = await Effect.runPromise(S.decodeUnknown(GameConfigSchema)(config))
      expect(result.world.seaLevel).toBe(128)
      expect(result.world.worldHeight).toBe(128)
    })
  })
})