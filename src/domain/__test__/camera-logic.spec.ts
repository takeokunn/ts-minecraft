import { describe, it, expect } from '@effect/vitest'
import { Option } from 'effect'
import * as CL from '../camera-logic'
import { toFloat } from '../common'
import { Camera, Position, TargetBlock, TargetNone } from '../components'
import { EntityIdSchema } from '../entity'
import { toInt } from '../common'

describe('Camera Logic', () => {
  describe('clampPitch', () => {
    it('should return 0 for NaN', () => {
      const result = CL.clampPitch(toFloat(NaN))
      expect(result).toBe(0)
    })

    it('should clamp pitch to PI/2 when too high', () => {
      const result = CL.clampPitch(toFloat(Math.PI))
      expect(result).toBeCloseTo(Math.PI / 2)
    })

    it('should clamp pitch to -PI/2 when too low', () => {
      const result = CL.clampPitch(toFloat(-Math.PI))
      expect(result).toBeCloseTo(-Math.PI / 2)
    })

    it('should return the same value for valid pitch', () => {
      const validPitch = toFloat(0.5)
      const result = CL.clampPitch(validPitch)
      expect(result).toBe(validPitch)
    })
  })

  describe('updateCamera', () => {
    const camera: Camera = {
      position: { x: toFloat(0), y: toFloat(0), z: toFloat(0) },
      target: undefined,
      damping: toFloat(0.1)
    }

    it('should update camera target when target is a block', () => {
      const blockTarget: TargetBlock = {
        _tag: 'block',
        entityId: EntityIdSchema.make(1),
        face: [toInt(1), toInt(0), toInt(0)],
        position: { x: toFloat(1), y: toFloat(2), z: toFloat(3) }
      }
      
      const result = CL.updateCamera(camera, Option.some(blockTarget))
      expect(result.target).toEqual(blockTarget.position)
    })

    it('should clear camera target when target is none', () => {
      const noneTarget: TargetNone = { _tag: 'none' }
      
      const result = CL.updateCamera(camera, Option.some(noneTarget))
      expect(result.target).toBeUndefined()
    })

    it('should clear camera target when no target provided', () => {
      const result = CL.updateCamera(camera, Option.none())
      expect(result.target).toBeUndefined()
    })
  })

  describe('updateCameraPosition', () => {
    const camera: Camera = {
      position: { x: toFloat(0), y: toFloat(0), z: toFloat(0) },
      target: undefined,
      damping: toFloat(0.5)
    }

    it('should return same camera when no target position', () => {
      const result = CL.updateCameraPosition(camera, Option.none(), 0.1)
      expect(result).toEqual(camera)
    })

    it('should interpolate camera position towards target', () => {
      const targetPos: Position = { x: toFloat(10), y: toFloat(10), z: toFloat(10) }
      const result = CL.updateCameraPosition(camera, Option.some(targetPos), 0.1)
      
      // Should move towards target but not reach it completely
      expect(result.position.x).toBeGreaterThan(0)
      expect(result.position.x).toBeLessThan(10)
      expect(result.position.y).toBeGreaterThan(0)
      expect(result.position.y).toBeLessThan(10)
      expect(result.position.z).toBeGreaterThan(0)
      expect(result.position.z).toBeLessThan(10)
    })
  })

  describe('getCameraLookAt', () => {
    it('should calculate look-at vector', () => {
      const camera: Camera = {
        position: { x: toFloat(5), y: toFloat(5), z: toFloat(5) },
        target: undefined,
        damping: toFloat(0.1)
      }

      const result = CL.getCameraLookAt(camera)
      
      // Look-at should be camera position + [0, 0, -1]
      expect(result[0]).toBeCloseTo(5)
      expect(result[1]).toBeCloseTo(5)
      expect(result[2]).toBeCloseTo(4)
    })
  })
})