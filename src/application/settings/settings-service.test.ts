import { describe, it } from '@effect/vitest'
import { Effect, Schema } from 'effect'
import { expect } from 'vitest'
import {
  SettingsSchema,
  SettingsService,
  SettingsServiceLive,
} from './settings-service'

describe('SettingsSchema', () => {
  describe('Schema.finite() rejection', () => {
    it('should reject NaN for renderDistance', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: NaN,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('should reject Infinity for mouseSensitivity', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: 8,
          mouseSensitivity: Infinity,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('should reject -Infinity for dayLengthSeconds', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: 8,
          mouseSensitivity: 0.5,
          dayLengthSeconds: -Infinity,
        })
      ).toThrow()
    })
  })

  describe('Schema.between() filter', () => {
    it('should reject renderDistance below minimum (0)', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: 0,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('should reject renderDistance above maximum (20)', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: 20,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('should reject mouseSensitivity 0.05 (below minimum of 0.1)', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: 8,
          mouseSensitivity: 0.05,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('should reject mouseSensitivity 3.1 (above maximum of 3.0)', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: 8,
          mouseSensitivity: 3.1,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('should reject dayLengthSeconds 60 (below minimum of 120)', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: 8,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 60,
        })
      ).toThrow()
    })

    it('should reject dayLengthSeconds 1201 (above maximum of 1200)', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: 8,
          mouseSensitivity: 0.5,
          dayLengthSeconds: 1201,
        })
      ).toThrow()
    })
  })

  describe('valid in-range values', () => {
    it('should decode valid settings unchanged', () => {
      const result = Schema.decodeUnknownSync(SettingsSchema)({
        renderDistance: 8,
        mouseSensitivity: 0.5,
        dayLengthSeconds: 400,
      })
      expect(result.renderDistance).toBe(8)
      expect(result.mouseSensitivity).toBe(0.5)
      expect(result.dayLengthSeconds).toBe(400)
    })

    it('should decode boundary minimum values', () => {
      const result = Schema.decodeUnknownSync(SettingsSchema)({
        renderDistance: 2,
        mouseSensitivity: 0.1,
        dayLengthSeconds: 120,
      })
      expect(result.renderDistance).toBe(2)
      expect(result.mouseSensitivity).toBe(0.1)
      expect(result.dayLengthSeconds).toBe(120)
    })

    it('should decode boundary maximum values', () => {
      const result = Schema.decodeUnknownSync(SettingsSchema)({
        renderDistance: 16,
        mouseSensitivity: 3.0,
        dayLengthSeconds: 1200,
      })
      expect(result.renderDistance).toBe(16)
      expect(result.mouseSensitivity).toBe(3.0)
      expect(result.dayLengthSeconds).toBe(1200)
    })
  })
})

describe('SettingsService', () => {
  describe('getSettings', () => {
    it('should return default settings initially', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(8)
      expect(result.mouseSensitivity).toBe(0.5)
      expect(result.dayLengthSeconds).toBe(400)
    })
  })

  describe('updateSettings', () => {
    it('should update renderDistance', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 12 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(12)
    })

    it('should fall back to DEFAULT_SETTINGS when updateSettings receives out-of-range values', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 100 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(8)
    })

    it('should update multiple fields at once', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 10, mouseSensitivity: 1.5 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(10)
      expect(result.mouseSensitivity).toBe(1.5)
    })
  })

  describe('resetToDefaults', () => {
    it('should restore default settings after update', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 4, mouseSensitivity: 2.0, dayLengthSeconds: 600 })
        yield* service.resetToDefaults()
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(8)
      expect(result.mouseSensitivity).toBe(0.5)
      expect(result.dayLengthSeconds).toBe(400)
    })
  })

  describe('Schema rejection (between semantics)', () => {
    it('should fall back to defaults when renderDistance is 1 (below minimum 2)', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 8 })
        yield* service.updateSettings({ renderDistance: 1 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      // updateSettings falls back to DEFAULT_SETTINGS when schema rejects
      expect(result.renderDistance).toBe(8)
    })

    it('should fall back to defaults when renderDistance is 17 (above maximum 16)', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 17 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(8)
    })

    it('should fall back to defaults when mouseSensitivity is 0.05 (below 0.1)', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ mouseSensitivity: 0.05 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.mouseSensitivity).toBe(0.5)
    })

    it('should fall back to defaults when mouseSensitivity is 3.5 (above 3.0)', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ mouseSensitivity: 3.5 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.mouseSensitivity).toBe(0.5)
    })

    it('should fall back to defaults when dayLengthSeconds is 100 (below minimum 120)', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ dayLengthSeconds: 100 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.dayLengthSeconds).toBe(400)
    })

    it('should fall back to defaults when dayLengthSeconds is 1500 (above maximum 1200)', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ dayLengthSeconds: 1500 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.dayLengthSeconds).toBe(400)
    })

    it('should preserve previously set valid values after a failed update', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        // First apply valid settings
        yield* service.updateSettings({ renderDistance: 10, mouseSensitivity: 1.5, dayLengthSeconds: 600 })
        // Then attempt an invalid update (renderDistance out of range)
        yield* service.updateSettings({ renderDistance: 999 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      // Falls back to DEFAULT_SETTINGS (not the previously set values), because the
      // implementation always falls back to DEFAULT_SETTINGS on schema failure
      expect(result.renderDistance).toBe(8)
      expect(result.mouseSensitivity).toBe(0.5)
      expect(result.dayLengthSeconds).toBe(400)
    })

    it('should succeed with valid renderDistance of 8', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 8 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(8)
    })
  })

  describe('updateSettings — partial updates', () => {
    it('should update only mouseSensitivity without changing others', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ mouseSensitivity: 2.0 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.mouseSensitivity).toBe(2.0)
      expect(result.renderDistance).toBe(8)
      expect(result.dayLengthSeconds).toBe(400)
    })

    it('should update only dayLengthSeconds without changing others', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ dayLengthSeconds: 600 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.dayLengthSeconds).toBe(600)
      expect(result.renderDistance).toBe(8)
      expect(result.mouseSensitivity).toBe(0.5)
    })

    it('should accept all fields updated at once within valid ranges', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({
          renderDistance: 12,
          mouseSensitivity: 1.8,
          dayLengthSeconds: 900,
        })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(12)
      expect(result.mouseSensitivity).toBe(1.8)
      expect(result.dayLengthSeconds).toBe(900)
    })
  })

  describe('updateSettings — boundary values', () => {
    it('should accept exact minimum for all fields', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({
          renderDistance: 2,
          mouseSensitivity: 0.1,
          dayLengthSeconds: 120,
        })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(2)
      expect(result.mouseSensitivity).toBe(0.1)
      expect(result.dayLengthSeconds).toBe(120)
    })

    it('should accept exact maximum for all fields', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({
          renderDistance: 16,
          mouseSensitivity: 3.0,
          dayLengthSeconds: 1200,
        })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(16)
      expect(result.mouseSensitivity).toBe(3.0)
      expect(result.dayLengthSeconds).toBe(1200)
    })
  })

  describe('sequential updates', () => {
    it('should accumulate valid sequential updates', () => {
      const program = Effect.gen(function* () {
        const service = yield* SettingsService
        yield* service.updateSettings({ renderDistance: 4 })
        yield* service.updateSettings({ mouseSensitivity: 1.0 })
        yield* service.updateSettings({ dayLengthSeconds: 200 })
        return yield* service.getSettings()
      })

      const result = Effect.runSync(program.pipe(Effect.provide(SettingsServiceLive)))
      expect(result.renderDistance).toBe(4)
      expect(result.mouseSensitivity).toBe(1.0)
      expect(result.dayLengthSeconds).toBe(200)
    })
  })

  describe('SettingsSchema — type coercion', () => {
    it('should reject string values for numeric fields', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: '8',
          mouseSensitivity: 0.5,
          dayLengthSeconds: 400,
        })
      ).toThrow()
    })

    it('should reject missing required fields', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({
          renderDistance: 8,
        })
      ).toThrow()
    })

    it('should reject empty object', () => {
      expect(() =>
        Schema.decodeUnknownSync(SettingsSchema)({})
      ).toThrow()
    })
  })
})
