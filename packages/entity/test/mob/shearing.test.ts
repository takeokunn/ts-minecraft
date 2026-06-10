import { describe, it, expect } from 'vitest'
import { Effect, Option } from 'effect'
import {
  canBeSheared,
  shearWoolCount,
  tickWoolRegrowth,
  SHEAR_WOOL_MIN,
  SHEAR_WOOL_MAX,
  WOOL_REGROWTH_TICKS,
  EntityManager,
  EntityType,
} from '@ts-minecraft/entity'

describe('shearing domain (R11)', () => {
  describe('canBeSheared', () => {
    it('allows shearing a woolly sheep (timer at 0)', () => {
      expect(canBeSheared(0)).toBe(true)
    })
    it('refuses a sheared sheep still regrowing', () => {
      expect(canBeSheared(WOOL_REGROWTH_TICKS)).toBe(false)
      expect(canBeSheared(1)).toBe(false)
    })
  })

  describe('shearWoolCount', () => {
    it('always yields a count within [MIN, MAX] across many hashes', () => {
      for (let hash = 0; hash < 1000; hash++) {
        const count = shearWoolCount(hash)
        expect(count).toBeGreaterThanOrEqual(SHEAR_WOOL_MIN)
        expect(count).toBeLessThanOrEqual(SHEAR_WOOL_MAX)
      }
    })
    it('is deterministic for a given hash', () => {
      expect(shearWoolCount(42)).toBe(shearWoolCount(42))
    })
  })

  describe('tickWoolRegrowth', () => {
    it('counts down toward 0', () => {
      expect(tickWoolRegrowth(WOOL_REGROWTH_TICKS)).toBe(WOOL_REGROWTH_TICKS - 1)
    })
    it('clamps at 0 (idle early-return safe)', () => {
      expect(tickWoolRegrowth(0)).toBe(0)
      expect(tickWoolRegrowth(-5)).toBe(0)
    })
  })
})

describe('EntityManager.shearEntity (R11)', () => {
  it('shears a woolly sheep once, then refuses until regrown', () =>
    Effect.gen(function* () {
      const manager = yield* EntityManager
      const sheepId = yield* manager.addEntity(EntityType.Sheep, { x: 0, y: 64, z: 0 })

      const first = yield* manager.shearEntity(sheepId)
      expect(Option.isSome(first)).toBe(true)
      const count = Option.getOrThrow(first)
      expect(count).toBeGreaterThanOrEqual(SHEAR_WOOL_MIN)
      expect(count).toBeLessThanOrEqual(SHEAR_WOOL_MAX)

      // Already sheared → no second harvest.
      const second = yield* manager.shearEntity(sheepId)
      expect(Option.isNone(second)).toBe(true)
    }).pipe(Effect.provide(EntityManager.Default), Effect.runPromise))

  it('refuses to shear a non-sheep mob', () =>
    Effect.gen(function* () {
      const manager = yield* EntityManager
      const pigId = yield* manager.addEntity(EntityType.Pig, { x: 0, y: 64, z: 0 })
      const result = yield* manager.shearEntity(pigId)
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(EntityManager.Default), Effect.runPromise))

  it('returns None for an unknown entity id', () =>
    Effect.gen(function* () {
      const manager = yield* EntityManager
      const result = yield* manager.shearEntity('entity-does-not-exist' as never)
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(EntityManager.Default), Effect.runPromise))
})
