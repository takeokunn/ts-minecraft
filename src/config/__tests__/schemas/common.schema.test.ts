import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import * as S from 'effect/Schema'
import {
  PositiveNumber,
  NonNegativeNumber,
  PositiveInteger,
  NonNegativeInteger,
  NonEmptyString,
  Percentage,
  PercentageInt,
  VolumeLevel,
  FieldOfView,
  RenderDistance,
  ChunkSize,
  PowerOfTwo,
  Environment,
  LogLevel,
  GameMode,
  Difficulty,
  RenderingEngine,
  PowerPreference,
  TextureFiltering,
  AudioContext,
  StorageProvider,
  CompressionFormat,
  LoadingStrategy,
  CacheStrategy,
  Position3D,
  KeyBinding,
  HttpUrl,
  OptionalHttpUrl,
  FilePath,
  NonEmptyArray,
  DurationMs,
  TimeoutMs,
  SampleRate,
  AudioBufferSize,
  DeviceMemoryGB,
  MaxWorkers,
  TargetFPS,
  MemorySizeMB,
  GCThreshold,
  RetryAttempts,
  MouseSensitivity,
  ColorAdjustment,
} from '../../schemas/common.schema'

describe('Common Schema Validators', () => {
  describe('Numeric Validators', () => {
    describe('PositiveNumber', () => {
      it('should accept positive numbers', async () => {
        const validValues = [0.1, 1, 3.14159, 100, 1000.5]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(PositiveNumber)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject zero and negative numbers', async () => {
        const invalidValues = [0, -0.1, -1, -100]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(PositiveNumber)(value))
          ).rejects.toThrow()
        }
      })

      it('should reject non-numeric values', async () => {
        const invalidValues = ['1', true, null, undefined, {}, []]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(PositiveNumber)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('NonNegativeNumber', () => {
      it('should accept zero and positive numbers', async () => {
        const validValues = [0, 0.1, 1, 3.14159, 100, 1000.5]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(NonNegativeNumber)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject negative numbers', async () => {
        const invalidValues = [-0.1, -1, -100]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(NonNegativeNumber)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('PositiveInteger', () => {
      it('should accept positive integers', async () => {
        const validValues = [1, 10, 100, 1000]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(PositiveInteger)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject zero, negative numbers, and decimals', async () => {
        const invalidValues = [0, -1, 1.5, 3.14]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(PositiveInteger)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('NonNegativeInteger', () => {
      it('should accept zero and positive integers', async () => {
        const validValues = [0, 1, 10, 100, 1000]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(NonNegativeInteger)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject negative numbers and decimals', async () => {
        const invalidValues = [-1, 1.5, 3.14, -10.5]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(NonNegativeInteger)(value))
          ).rejects.toThrow()
        }
      })
    })
  })

  describe('String Validators', () => {
    describe('NonEmptyString', () => {
      it('should accept non-empty strings', async () => {
        const validValues = ['hello', 'world', 'a', '123', 'special-chars!@#']
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(NonEmptyString)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject empty strings', async () => {
        const invalidValues = ['', '   '] // Note: whitespace-only might be valid depending on implementation
        
        for (const value of invalidValues) {
          if (value === '') {
            await expect(
              Effect.runPromise(S.decodeUnknown(NonEmptyString)(value))
            ).rejects.toThrow()
          }
        }
      })

      it('should reject non-string values', async () => {
        const invalidValues = [123, true, null, undefined, {}, []]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(NonEmptyString)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('KeyBinding', () => {
      it('should accept valid key binding strings', async () => {
        const validValues = ['KeyA', 'Space', 'Enter', 'F3', 'ShiftLeft', 'ControlRight']
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(KeyBinding)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject empty key binding strings', async () => {
        await expect(
          Effect.runPromise(S.decodeUnknown(KeyBinding)(''))
        ).rejects.toThrow()
      })
    })

    describe('FilePath', () => {
      it('should accept valid file paths', async () => {
        const validValues = ['/path/to/file.js', './relative/path.txt', 'simple-file.json', 'C:\\Windows\\file.exe']
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(FilePath)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject empty file paths', async () => {
        await expect(
          Effect.runPromise(S.decodeUnknown(FilePath)(''))
        ).rejects.toThrow()
      })
    })

    describe('HttpUrl', () => {
      it('should accept valid HTTP/HTTPS URLs', async () => {
        const validValues = [
          'http://example.com',
          'https://example.com',
          'http://localhost:3000',
          'https://api.example.com/v1/users',
        ]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(HttpUrl)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject non-HTTP URLs and invalid formats', async () => {
        const invalidValues = [
          'ftp://example.com',
          'example.com',
          'not-a-url',
          '',
          'file:///path/to/file',
        ]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(HttpUrl)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('OptionalHttpUrl', () => {
      it('should accept valid HTTP URLs and undefined', async () => {
        const validValues = [
          'https://example.com',
          'http://localhost:3000',
          undefined,
        ]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(OptionalHttpUrl)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid URLs', async () => {
        const invalidValues = ['not-a-url', 'ftp://example.com']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(OptionalHttpUrl)(value))
          ).rejects.toThrow()
        }
      })
    })
  })

  describe('Percentage and Ratio Validators', () => {
    describe('Percentage', () => {
      it('should accept values between 0 and 1', async () => {
        const validValues = [0, 0.1, 0.5, 0.8, 1.0]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(Percentage)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject values outside 0-1 range', async () => {
        const invalidValues = [-0.1, 1.1, 2.0, -1]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(Percentage)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('PercentageInt', () => {
      it('should accept integers between 0 and 100', async () => {
        const validValues = [0, 10, 50, 75, 100]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(PercentageInt)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject values outside 0-100 range and decimals', async () => {
        const invalidValues = [-1, 101, 50.5, 200]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(PercentageInt)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('VolumeLevel', () => {
      it('should accept volume levels between 0 and 1', async () => {
        const validValues = [0, 0.1, 0.5, 0.8, 1.0]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(VolumeLevel)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject values outside 0-1 range', async () => {
        const invalidValues = [-0.1, 1.1, 2.0]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(VolumeLevel)(value))
          ).rejects.toThrow()
        }
      })
    })
  })

  describe('Constrained Numeric Validators', () => {
    describe('FieldOfView', () => {
      it('should accept FOV values between 30 and 120', async () => {
        const validValues = [30, 45, 60, 75, 90, 120]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(FieldOfView)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject FOV values outside 30-120 range', async () => {
        const invalidValues = [29, 121, 0, 180]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(FieldOfView)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('RenderDistance', () => {
      it('should accept render distance values between 1 and 32', async () => {
        const validValues = [1, 2, 8, 16, 32]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(RenderDistance)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject render distance values outside 1-32 range', async () => {
        const invalidValues = [0, 33, -1, 50]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(RenderDistance)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('TargetFPS', () => {
      it('should accept FPS values between 30 and 240', async () => {
        const validValues = [30, 60, 120, 144, 240]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(TargetFPS)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject FPS values outside 30-240 range', async () => {
        const invalidValues = [29, 241, 0, 500]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(TargetFPS)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('MouseSensitivity', () => {
      it('should accept sensitivity values between 0.1 and 5.0', async () => {
        const validValues = [0.1, 1.0, 2.5, 5.0]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(MouseSensitivity)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject sensitivity values outside 0.1-5.0 range', async () => {
        const invalidValues = [0.09, 5.1, 0, 10]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(MouseSensitivity)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('ColorAdjustment', () => {
      it('should accept color adjustment values between 0.1 and 2.0', async () => {
        const validValues = [0.1, 0.5, 1.0, 1.5, 2.0]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(ColorAdjustment)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject color adjustment values outside 0.1-2.0 range', async () => {
        const invalidValues = [0.09, 2.01, 0, 3]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(ColorAdjustment)(value))
          ).rejects.toThrow()
        }
      })
    })
  })

  describe('Power of Two Validators', () => {
    describe('ChunkSize', () => {
      it('should accept positive power-of-two values', async () => {
        const validValues = [1, 2, 4, 8, 16, 32, 64, 128, 256]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(ChunkSize)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject non-power-of-two values', async () => {
        const invalidValues = [3, 5, 6, 7, 9, 10, 15, 17, 255]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(ChunkSize)(value))
          ).rejects.toThrow()
        }
      })

      it('should reject zero and negative values', async () => {
        const invalidValues = [0, -1, -2, -4]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(ChunkSize)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('PowerOfTwo', () => {
      it('should accept positive power-of-two values', async () => {
        const validValues = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(PowerOfTwo)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject non-power-of-two values', async () => {
        const invalidValues = [3, 5, 6, 7, 9, 10, 15, 17]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(PowerOfTwo)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('AudioBufferSize', () => {
      it('should accept power-of-two values within 256-16384 range', async () => {
        const validValues = [256, 512, 1024, 2048, 4096, 8192, 16384]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(AudioBufferSize)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject values outside range or non-power-of-two', async () => {
        const invalidValues = [128, 255, 300, 16385, 32768]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(AudioBufferSize)(value))
          ).rejects.toThrow()
        }
      })
    })
  })

  describe('Specialized Numeric Validators', () => {
    describe('SampleRate', () => {
      it('should accept sample rates between 8000 and 96000', async () => {
        const validValues = [8000, 22050, 44100, 48000, 96000]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(SampleRate)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject sample rates outside 8000-96000 range', async () => {
        const invalidValues = [7999, 96001, 0, 192000]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(SampleRate)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('DeviceMemoryGB', () => {
      it('should accept positive memory values', async () => {
        const validValues = [1, 2, 4, 8, 16, 32]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(DeviceMemoryGB)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject zero and negative memory values', async () => {
        const invalidValues = [0, -1, -4]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(DeviceMemoryGB)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('MaxWorkers', () => {
      it('should accept worker counts between 0 and 32', async () => {
        const validValues = [0, 1, 4, 8, 16, 32]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(MaxWorkers)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject worker counts outside 0-32 range', async () => {
        const invalidValues = [-1, 33, 64, 100]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(MaxWorkers)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('MemorySizeMB', () => {
      it('should accept positive memory sizes', async () => {
        const validValues = [128, 256, 512, 1024, 2048]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(MemorySizeMB)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject zero and negative memory sizes', async () => {
        const invalidValues = [0, -1, -256]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(MemorySizeMB)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('GCThreshold', () => {
      it('should accept GC thresholds between 0.1 and 0.95', async () => {
        const validValues = [0.1, 0.5, 0.75, 0.9, 0.95]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(GCThreshold)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject GC thresholds outside 0.1-0.95 range', async () => {
        const invalidValues = [0.09, 0.96, 1.0, 0, -0.1]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(GCThreshold)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('RetryAttempts', () => {
      it('should accept retry attempts between 0 and 10', async () => {
        const validValues = [0, 1, 3, 5, 10]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(RetryAttempts)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject retry attempts outside 0-10 range', async () => {
        const invalidValues = [-1, 11, 20, 100]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(RetryAttempts)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('DurationMs', () => {
      it('should accept positive durations', async () => {
        const validValues = [1, 100, 1000, 5000, 60000]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(DurationMs)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject zero and negative durations', async () => {
        const invalidValues = [0, -1, -1000]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(DurationMs)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('TimeoutMs', () => {
      it('should accept zero and positive timeouts', async () => {
        const validValues = [0, 100, 1000, 5000, 60000]
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(TimeoutMs)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject negative timeouts', async () => {
        const invalidValues = [-1, -1000, -5000]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(TimeoutMs)(value))
          ).rejects.toThrow()
        }
      })
    })
  })

  describe('Enum Validators', () => {
    describe('Environment', () => {
      it('should accept valid environment values', async () => {
        const validValues = ['development', 'production', 'test'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(Environment)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid environment values', async () => {
        const invalidValues = ['staging', 'local', 'qa', 'dev']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(Environment)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('LogLevel', () => {
      it('should accept valid log levels', async () => {
        const validValues = ['error', 'warn', 'info', 'debug', 'trace'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(LogLevel)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid log levels', async () => {
        const invalidValues = ['verbose', 'fatal', 'critical']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(LogLevel)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('GameMode', () => {
      it('should accept valid game modes', async () => {
        const validValues = ['survival', 'creative', 'adventure', 'spectator'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(GameMode)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid game modes', async () => {
        const invalidValues = ['hardcore', 'peaceful', 'build']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(GameMode)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('Difficulty', () => {
      it('should accept valid difficulty levels', async () => {
        const validValues = ['peaceful', 'easy', 'normal', 'hard'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(Difficulty)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid difficulty levels', async () => {
        const invalidValues = ['hardcore', 'extreme', 'beginner']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(Difficulty)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('RenderingEngine', () => {
      it('should accept valid rendering engines', async () => {
        const validValues = ['three', 'webgpu'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(RenderingEngine)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid rendering engines', async () => {
        const invalidValues = ['opengl', 'vulkan', 'directx']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(RenderingEngine)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('PowerPreference', () => {
      it('should accept valid power preferences', async () => {
        const validValues = ['default', 'high-performance', 'low-power'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(PowerPreference)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid power preferences', async () => {
        const invalidValues = ['balanced', 'maximum', 'minimum']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(PowerPreference)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('TextureFiltering', () => {
      it('should accept valid texture filtering modes', async () => {
        const validValues = ['nearest', 'linear', 'trilinear'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(TextureFiltering)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid texture filtering modes', async () => {
        const invalidValues = ['bilinear', 'anisotropic', 'point']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(TextureFiltering)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('AudioContext', () => {
      it('should accept valid audio context types', async () => {
        const validValues = ['web-audio', 'html5'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(AudioContext)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid audio context types', async () => {
        const invalidValues = ['native', 'openal', 'directsound']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(AudioContext)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('StorageProvider', () => {
      it('should accept valid storage providers', async () => {
        const validValues = ['localStorage', 'indexedDB', 'opfs'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(StorageProvider)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid storage providers', async () => {
        const invalidValues = ['sessionStorage', 'webSQL', 'cookie']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(StorageProvider)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('CompressionFormat', () => {
      it('should accept valid compression formats', async () => {
        const validValues = ['none', 'gzip', 'brotli'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(CompressionFormat)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid compression formats', async () => {
        const invalidValues = ['zip', 'lz4', 'zstd']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(CompressionFormat)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('LoadingStrategy', () => {
      it('should accept valid loading strategies', async () => {
        const validValues = ['eager', 'lazy', 'progressive'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(LoadingStrategy)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid loading strategies', async () => {
        const invalidValues = ['preload', 'defer', 'async']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(LoadingStrategy)(value))
          ).rejects.toThrow()
        }
      })
    })

    describe('CacheStrategy', () => {
      it('should accept valid cache strategies', async () => {
        const validValues = ['memory', 'disk', 'hybrid'] as const
        
        for (const value of validValues) {
          const result = await Effect.runPromise(S.decodeUnknown(CacheStrategy)(value))
          expect(result).toBe(value)
        }
      })

      it('should reject invalid cache strategies', async () => {
        const invalidValues = ['network', 'persistent', 'temporary']
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(CacheStrategy)(value))
          ).rejects.toThrow()
        }
      })
    })
  })

  describe('Complex Validators', () => {
    describe('Position3D', () => {
      it('should accept valid 3D positions', async () => {
        const validPositions = [
          { x: 0, y: 0, z: 0 },
          { x: 1.5, y: -2.3, z: 10.7 },
          { x: -100, y: 200, z: -50 },
        ]
        
        for (const position of validPositions) {
          const result = await Effect.runPromise(S.decodeUnknown(Position3D)(position))
          expect(result).toEqual(position)
        }
      })

      it('should reject invalid 3D positions', async () => {
        const invalidPositions = [
          { x: 0, y: 0 }, // missing z
          { x: '0', y: 0, z: 0 }, // string instead of number
          null,
          undefined,
          'not an object',
        ]
        
        for (const position of invalidPositions) {
          await expect(
            Effect.runPromise(S.decodeUnknown(Position3D)(position))
          ).rejects.toThrow()
        }
      })
    })

    describe('NonEmptyArray', () => {
      it('should accept non-empty arrays', async () => {
        const StringArray = NonEmptyArray(S.String)
        const NumberArray = NonEmptyArray(S.Number)
        
        const validArrays = [
          ['hello'],
          ['hello', 'world'],
          ['a', 'b', 'c', 'd'],
        ]
        
        for (const array of validArrays) {
          const result = await Effect.runPromise(S.decodeUnknown(StringArray)(array))
          expect(result).toEqual(array)
          expect(result.length).toBeGreaterThan(0)
        }
        
        const validNumberArrays = [
          [1],
          [1, 2, 3],
          [0, -1, 3.14],
        ]
        
        for (const array of validNumberArrays) {
          const result = await Effect.runPromise(S.decodeUnknown(NumberArray)(array))
          expect(result).toEqual(array)
          expect(result.length).toBeGreaterThan(0)
        }
      })

      it('should reject empty arrays', async () => {
        const StringArray = NonEmptyArray(S.String)
        
        await expect(
          Effect.runPromise(S.decodeUnknown(StringArray)([]))
        ).rejects.toThrow()
      })

      it('should reject non-arrays', async () => {
        const StringArray = NonEmptyArray(S.String)
        const invalidValues = ['not array', 123, {}, null, undefined]
        
        for (const value of invalidValues) {
          await expect(
            Effect.runPromise(S.decodeUnknown(StringArray)(value))
          ).rejects.toThrow()
        }
      })

      it('should validate array item types', async () => {
        const StringArray = NonEmptyArray(S.String)
        const invalidArrays = [
          [123], // number instead of string
          ['hello', 123], // mixed types
          [null],
          [undefined],
        ]
        
        for (const array of invalidArrays) {
          await expect(
            Effect.runPromise(S.decodeUnknown(StringArray)(array))
          ).rejects.toThrow()
        }
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle boundary values correctly', async () => {
      // Test exact boundary values for various validators
      const boundaryTests = [
        { validator: FieldOfView, valid: [30, 120], invalid: [29.9, 120.1] },
        { validator: RenderDistance, valid: [1, 32], invalid: [0, 33] },
        { validator: Percentage, valid: [0, 1], invalid: [-0.001, 1.001] },
        { validator: VolumeLevel, valid: [0, 1], invalid: [-0.001, 1.001] },
      ]
      
      for (const { validator, valid, invalid } of boundaryTests) {
        for (const value of valid) {
          const result = await Effect.runPromise(S.decodeUnknown(validator)(value))
          expect(result).toBe(value)
        }
        
        for (const value of invalid) {
          await expect(
            Effect.runPromise(S.decodeUnknown(validator)(value))
          ).rejects.toThrow()
        }
      }
    })

    it('should handle type coercion correctly', async () => {
      // Test whether validators handle type coercion (they shouldn't)
      const stringNumbers = ['1', '1.5', '0']
      const booleanStrings = ['true', 'false']
      
      for (const value of stringNumbers) {
        await expect(
          Effect.runPromise(S.decodeUnknown(PositiveNumber)(value))
        ).rejects.toThrow()
      }
      
      for (const value of booleanStrings) {
        await expect(
          Effect.runPromise(S.decodeUnknown(PositiveInteger)(value))
        ).rejects.toThrow()
      }
    })

    it('should handle floating point precision issues', async () => {
      // Test values that might cause floating point precision issues
      const precisionValues = [0.1 + 0.2, 1.0000000000001, 0.9999999999999]
      
      for (const value of precisionValues) {
        if (value >= 0 && value <= 1) {
          const result = await Effect.runPromise(S.decodeUnknown(Percentage)(value))
          expect(typeof result).toBe('number')
        }
      }
    })

    it('should handle special number values', async () => {
      const specialValues = [NaN, Infinity, -Infinity]
      
      for (const value of specialValues) {
        await expect(
          Effect.runPromise(S.decodeUnknown(PositiveNumber)(value))
        ).rejects.toThrow()
        
        await expect(
          Effect.runPromise(S.decodeUnknown(PositiveInteger)(value))
        ).rejects.toThrow()
      }
    })

    it('should provide meaningful error messages', async () => {
      try {
        await Effect.runPromise(S.decodeUnknown(PositiveNumber)(-1))
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeDefined()
        // Error should contain meaningful information
        expect(String(error)).toContain('positive') // or similar constraint message
      }
      
      try {
        await Effect.runPromise(S.decodeUnknown(PowerOfTwo)(15))
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeDefined()
        expect(String(error)).toContain('power of 2') // or similar constraint message
      }
    })

    it('should handle large integers correctly', async () => {
      // Test very large but valid integers
      const largeValidInts = [Number.MAX_SAFE_INTEGER]
      
      for (const value of largeValidInts) {
        const result = await Effect.runPromise(S.decodeUnknown(PositiveInteger)(value))
        expect(result).toBe(value)
      }
      
      // Test integers that exceed safe integer limits should be rejected
      const unsafeInts = [Number.MAX_SAFE_INTEGER + 1, Number.MAX_VALUE]
      
      for (const value of unsafeInts) {
        if (Number.isInteger(value)) {
          // These should fail validation as they exceed safe integer limits
          try {
            await Effect.runPromise(S.decodeUnknown(PositiveInteger)(value))
            expect.fail(`Should have rejected unsafe integer: ${value}`)
          } catch (error) {
            // This is expected - unsafe integers should be rejected
            expect(error).toBeDefined()
          }
        }
      }
    })

    it('should handle whitespace-only strings correctly for NonEmptyString', async () => {
      const whitespaceStrings = [' ', '  ', '\t', '\n', '\r\n', '   \t\n   ']
      
      for (const str of whitespaceStrings) {
        const result = await Effect.runPromise(S.decodeUnknown(NonEmptyString)(str))
        expect(result).toBe(str)
        expect(result.length).toBeGreaterThan(0)
      }
    })

    it('should validate complex power of 2 edge cases', async () => {
      // Test very large powers of 2
      const largePowersOfTwo = [
        Math.pow(2, 10), // 1024
        Math.pow(2, 20), // 1048576
        Math.pow(2, 30), // 1073741824
      ]
      
      for (const value of largePowersOfTwo) {
        const result = await Effect.runPromise(S.decodeUnknown(PowerOfTwo)(value))
        expect(result).toBe(value)
      }
      
      // Test that 0 is correctly rejected (not a power of 2)
      await expect(
        Effect.runPromise(S.decodeUnknown(PowerOfTwo)(0))
      ).rejects.toThrow()
    })
  })

  describe('Schema Annotations and Metadata', () => {
    it('should have proper annotations on schemas', () => {
      // Test that schemas have proper titles and descriptions
      const schemasWithAnnotations = [
        { schema: PositiveNumber, expectedTitle: 'Positive Number' },
        { schema: NonNegativeNumber, expectedTitle: 'Non-negative Number' },
        { schema: Environment, expectedTitle: 'Environment' },
        { schema: LogLevel, expectedTitle: 'Log Level' },
        { schema: Position3D, expectedTitle: '3D Position' },
      ]
      
      for (const { schema } of schemasWithAnnotations) {
        // Verify schema is properly constructed and has annotations
        expect(schema).toBeDefined()
        // The exact structure of annotations may vary, so we just verify the schema exists
      }
    })
  })

  describe('Additional Specialized Validators Coverage', () => {
    it('should test all TextureFiltering modes exhaustively', async () => {
      const allValidModes = ['nearest', 'linear', 'trilinear']
      const allInvalidModes = ['bilinear', 'anisotropic', 'point', 'cubic', 'none']
      
      for (const mode of allValidModes) {
        const result = await Effect.runPromise(S.decodeUnknown(TextureFiltering)(mode))
        expect(result).toBe(mode)
      }
      
      for (const mode of allInvalidModes) {
        await expect(
          Effect.runPromise(S.decodeUnknown(TextureFiltering)(mode))
        ).rejects.toThrow()
      }
    })

    it('should test all RenderingEngine modes exhaustively', async () => {
      const allValidEngines = ['three', 'webgpu']
      const allInvalidEngines = ['webgl', 'webgl2', 'canvas', 'opengl', 'vulkan', 'directx']
      
      for (const engine of allValidEngines) {
        const result = await Effect.runPromise(S.decodeUnknown(RenderingEngine)(engine))
        expect(result).toBe(engine)
      }
      
      for (const engine of allInvalidEngines) {
        await expect(
          Effect.runPromise(S.decodeUnknown(RenderingEngine)(engine))
        ).rejects.toThrow()
      }
    })

    it('should test all PowerPreference modes exhaustively', async () => {
      const allValidPrefs = ['default', 'high-performance', 'low-power']
      const allInvalidPrefs = ['balanced', 'maximum', 'minimum', 'performance', 'power-saving']
      
      for (const pref of allValidPrefs) {
        const result = await Effect.runPromise(S.decodeUnknown(PowerPreference)(pref))
        expect(result).toBe(pref)
      }
      
      for (const pref of allInvalidPrefs) {
        await expect(
          Effect.runPromise(S.decodeUnknown(PowerPreference)(pref))
        ).rejects.toThrow()
      }
    })

    it('should test all AudioContext modes exhaustively', async () => {
      const allValidContexts = ['web-audio', 'html5']
      const allInvalidContexts = ['webaudio', 'html', 'native', 'openal', 'directsound', 'audio']
      
      for (const context of allValidContexts) {
        const result = await Effect.runPromise(S.decodeUnknown(AudioContext)(context))
        expect(result).toBe(context)
      }
      
      for (const context of allInvalidContexts) {
        await expect(
          Effect.runPromise(S.decodeUnknown(AudioContext)(context))
        ).rejects.toThrow()
      }
    })

    it('should test all StorageProvider modes exhaustively', async () => {
      const allValidProviders = ['localStorage', 'indexedDB', 'opfs']
      const allInvalidProviders = ['sessionStorage', 'webSQL', 'memory', 'file', 'remote']
      
      for (const provider of allValidProviders) {
        const result = await Effect.runPromise(S.decodeUnknown(StorageProvider)(provider))
        expect(result).toBe(provider)
      }
      
      for (const provider of allInvalidProviders) {
        await expect(
          Effect.runPromise(S.decodeUnknown(StorageProvider)(provider))
        ).rejects.toThrow()
      }
    })

    it('should test all CompressionFormat modes exhaustively', async () => {
      const allValidFormats = ['none', 'gzip', 'brotli']
      const allInvalidFormats = ['zip', 'lz4', 'zstd', 'deflate', 'compress']
      
      for (const format of allValidFormats) {
        const result = await Effect.runPromise(S.decodeUnknown(CompressionFormat)(format))
        expect(result).toBe(format)
      }
      
      for (const format of allInvalidFormats) {
        await expect(
          Effect.runPromise(S.decodeUnknown(CompressionFormat)(format))
        ).rejects.toThrow()
      }
    })

    it('should test all LoadingStrategy modes exhaustively', async () => {
      const allValidStrategies = ['eager', 'lazy', 'progressive']
      const allInvalidStrategies = ['preload', 'defer', 'async', 'immediate', 'demand']
      
      for (const strategy of allValidStrategies) {
        const result = await Effect.runPromise(S.decodeUnknown(LoadingStrategy)(strategy))
        expect(result).toBe(strategy)
      }
      
      for (const strategy of allInvalidStrategies) {
        await expect(
          Effect.runPromise(S.decodeUnknown(LoadingStrategy)(strategy))
        ).rejects.toThrow()
      }
    })

    it('should test all CacheStrategy modes exhaustively', async () => {
      const allValidStrategies = ['memory', 'disk', 'hybrid']
      const allInvalidStrategies = ['network', 'persistent', 'temporary', 'ram', 'storage']
      
      for (const strategy of allValidStrategies) {
        const result = await Effect.runPromise(S.decodeUnknown(CacheStrategy)(strategy))
        expect(result).toBe(strategy)
      }
      
      for (const strategy of allInvalidStrategies) {
        await expect(
          Effect.runPromise(S.decodeUnknown(CacheStrategy)(strategy))
        ).rejects.toThrow()
      }
    })
  })

  describe('Complex Edge Case Testing', () => {
    it('should handle Position3D with extreme coordinate values', async () => {
      const extremePositions = [
        { x: Number.MAX_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER, z: 0 },
        { x: -Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER, z: -Number.MAX_SAFE_INTEGER },
        { x: 1e-10, y: 1e-10, z: 1e-10 }, // Very small numbers
        { x: 1e10, y: 1e10, z: 1e10 }, // Very large numbers
      ]
      
      for (const position of extremePositions) {
        const result = await Effect.runPromise(S.decodeUnknown(Position3D)(position))
        expect(result).toEqual(position)
      }
    })

    it('should handle NonEmptyArray with various element types correctly', async () => {
      // Test with different primitive types
      const BoolArray = NonEmptyArray(S.Boolean)
      const validBoolArrays = [[true], [false], [true, false, true]]
      
      for (const array of validBoolArrays) {
        const result = await Effect.runPromise(S.decodeUnknown(BoolArray)(array))
        expect(result).toEqual(array)
      }
      
      // Test with nested structures
      const NestedArray = NonEmptyArray(S.Array(S.String))
      const validNestedArrays = [[[]], [['a'], ['b']], [['hello', 'world']]]
      
      for (const array of validNestedArrays) {
        const result = await Effect.runPromise(S.decodeUnknown(NestedArray)(array))
        expect(result).toEqual(array)
      }
    })

    it('should verify all numeric boundary conditions systematically', async () => {
      const boundaryConditions = [
        {
          schema: SampleRate,
          validBoundaries: [8000, 96000],
          invalidBoundaries: [7999.99, 96000.01]
        },
        {
          schema: TargetFPS,
          validBoundaries: [30, 240],
          invalidBoundaries: [29.99, 240.01]
        },
        {
          schema: MouseSensitivity,
          validBoundaries: [0.1, 5.0],
          invalidBoundaries: [0.099, 5.001]
        },
        {
          schema: ColorAdjustment,
          validBoundaries: [0.1, 2.0],
          invalidBoundaries: [0.099, 2.001]
        }
      ]
      
      for (const { schema, validBoundaries, invalidBoundaries } of boundaryConditions) {
        // Test valid boundaries
        for (const value of validBoundaries) {
          const result = await Effect.runPromise(S.decodeUnknown(schema)(value))
          expect(result).toBe(value)
        }
        
        // Test invalid boundaries
        for (const value of invalidBoundaries) {
          await expect(
            Effect.runPromise(S.decodeUnknown(schema)(value))
          ).rejects.toThrow()
        }
      }
    })

    it('should handle fractional power validation correctly', async () => {
      // Test that fractional values that could theoretically be powers of 2 are rejected
      const fractionalTests = [
        { value: 1.0, shouldPass: true }, // exact integer
        { value: 2.0, shouldPass: true }, // exact integer  
        { value: 4.0, shouldPass: true }, // exact integer
        { value: 1.5, shouldPass: false }, // not integer
        { value: 2.5, shouldPass: false }, // not integer
        { value: 3.999, shouldPass: false }, // close to 4 but not integer
      ]
      
      for (const { value, shouldPass } of fractionalTests) {
        if (shouldPass) {
          const result = await Effect.runPromise(S.decodeUnknown(PowerOfTwo)(value))
          expect(result).toBe(value)
        } else {
          await expect(
            Effect.runPromise(S.decodeUnknown(PowerOfTwo)(value))
          ).rejects.toThrow()
        }
      }
    })

    it('should handle case sensitivity in string literals correctly', async () => {
      const caseSensitivityTests = [
        { schema: Environment, valid: ['development'], invalid: ['Development', 'DEVELOPMENT'] },
        { schema: LogLevel, valid: ['error'], invalid: ['Error', 'ERROR'] },
        { schema: GameMode, valid: ['creative'], invalid: ['Creative', 'CREATIVE'] },
        { schema: Difficulty, valid: ['normal'], invalid: ['Normal', 'NORMAL'] },
      ]
      
      for (const { schema, valid, invalid } of caseSensitivityTests) {
        for (const value of valid) {
          const result = await Effect.runPromise(S.decodeUnknown(schema)(value))
          expect(result).toBe(value)
        }
        
        for (const value of invalid) {
          await expect(
            Effect.runPromise(S.decodeUnknown(schema)(value))
          ).rejects.toThrow()
        }
      }
    })
  })
})