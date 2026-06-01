import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import {
  CustomShapeSchema,
  CustomBodySchema,
  WorldConfigSchema,
  RigidBodyConfigSchema,
} from '@ts-minecraft/game'

describe('physics/domain schemas', () => {
  describe('CustomShapeSchema', () => {
    it('decodes a box shape with halfExtents', () => {
      const result = Schema.decodeUnknownSync(CustomShapeSchema)({
        kind: 'box',
        halfExtents: { x: 0.5, y: 1, z: 0.5 },
      })
      expect(result.kind).toBe('box')
      if (result.kind === 'box') {
        expect(result.halfExtents).toEqual({ x: 0.5, y: 1, z: 0.5 })
      }
    })

    it('decodes a sphere shape with radius', () => {
      const result = Schema.decodeUnknownSync(CustomShapeSchema)({
        kind: 'sphere',
        radius: 1.5,
      })
      expect(result.kind).toBe('sphere')
      if (result.kind === 'sphere') {
        expect(result.radius).toBe(1.5)
      }
    })

    it('decodes a plane shape', () => {
      const result = Schema.decodeUnknownSync(CustomShapeSchema)({ kind: 'plane' })
      expect(result.kind).toBe('plane')
    })

    it('rejects unknown shape kind', () => {
      expect(() =>
        Schema.decodeUnknownSync(CustomShapeSchema)({ kind: 'cylinder' })
      ).toThrow()
    })

    it('rejects sphere with non-positive radius', () => {
      expect(() =>
        Schema.decodeUnknownSync(CustomShapeSchema)({ kind: 'sphere', radius: 0 })
      ).toThrow()
    })

    it('rejects sphere with negative radius', () => {
      expect(() =>
        Schema.decodeUnknownSync(CustomShapeSchema)({ kind: 'sphere', radius: -1 })
      ).toThrow()
    })
  })

  describe('CustomBodySchema', () => {
    const validBody = {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      mass: 70,
      type: 'dynamic',
      shape: { kind: 'plane' },
    }

    it('decodes a valid dynamic body', () => {
      const result = Schema.decodeUnknownSync(CustomBodySchema)(validBody)
      expect(result.mass).toBe(70)
      expect(result.type).toBe('dynamic')
    })

    it('decodes a static body', () => {
      const result = Schema.decodeUnknownSync(CustomBodySchema)({ ...validBody, type: 'static', mass: 0 })
      expect(result.type).toBe('static')
    })

    it('decodes a kinematic body', () => {
      const result = Schema.decodeUnknownSync(CustomBodySchema)({ ...validBody, type: 'kinematic' })
      expect(result.type).toBe('kinematic')
    })

    it('rejects negative mass', () => {
      expect(() =>
        Schema.decodeUnknownSync(CustomBodySchema)({ ...validBody, mass: -1 })
      ).toThrow()
    })

    it('rejects invalid body type', () => {
      expect(() =>
        Schema.decodeUnknownSync(CustomBodySchema)({ ...validBody, type: 'flying' })
      ).toThrow()
    })
  })

  describe('WorldConfigSchema', () => {
    it('decodes a valid world config with gravity vector', () => {
      const result = Schema.decodeUnknownSync(WorldConfigSchema)({
        gravity: { x: 0, y: -9.82, z: 0 },
      })
      expect(result.gravity.y).toBe(-9.82)
      expect(result.gravity.x).toBe(0)
      expect(result.gravity.z).toBe(0)
    })

    it('accepts zero gravity (space simulation)', () => {
      const result = Schema.decodeUnknownSync(WorldConfigSchema)({
        gravity: { x: 0, y: 0, z: 0 },
      })
      expect(result.gravity.y).toBe(0)
    })

    it('rejects config missing gravity', () => {
      expect(() =>
        Schema.decodeUnknownSync(WorldConfigSchema)({})
      ).toThrow()
    })
  })

  describe('RigidBodyConfigSchema', () => {
    it('decodes valid config with mass and position', () => {
      const result = Schema.decodeUnknownSync(RigidBodyConfigSchema)({
        mass: 70,
        position: { x: 0, y: 0, z: 0 },
      })
      expect(result.mass).toBe(70)
      expect(result.position).toEqual({ x: 0, y: 0, z: 0 })
    })

    it('accepts zero mass (static bodies)', () => {
      const result = Schema.decodeUnknownSync(RigidBodyConfigSchema)({
        mass: 0,
        position: { x: 0, y: 0, z: 0 },
        type: 'static',
      })
      expect(result.mass).toBe(0)
      expect(result.type).toBe('static')
    })

    it('rejects negative mass', () => {
      expect(() =>
        Schema.decodeUnknownSync(RigidBodyConfigSchema)({
          mass: -1,
          position: { x: 0, y: 0, z: 0 },
        })
      ).toThrow()
    })

    it('rejects invalid type literal', () => {
      expect(() =>
        Schema.decodeUnknownSync(RigidBodyConfigSchema)({
          mass: 70,
          position: { x: 0, y: 0, z: 0 },
          type: 'invalid',
        })
      ).toThrow()
    })
  })
})
