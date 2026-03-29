import { describe, it, expect } from 'vitest'
import { Array as Arr, HashSet } from 'effect'
import * as THREE from 'three'
import { identity, fromThreeMatrix4, toThreeMatrix4 } from './matrix4'

describe('identity', () => {
  it('should be a 4x4 identity matrix with 16 elements', () => {
    expect(identity.elements).toHaveLength(16)
  })

  it('should have 1s on the diagonal (column-major: indices 0, 5, 10, 15)', () => {
    const e = identity.elements
    expect(e[0]).toBe(1)
    expect(e[5]).toBe(1)
    expect(e[10]).toBe(1)
    expect(e[15]).toBe(1)
  })

  it('should have 0s on all off-diagonal elements', () => {
    const e = identity.elements
    const diagonalIndices = HashSet.make(0, 5, 10, 15)
    Arr.forEach(Arr.makeBy(16, i => i), (i) => {
      if (!HashSet.has(diagonalIndices, i)) {
        expect(e[i]).toBe(0)
      }
    })
  })
})

describe('fromThreeMatrix4', () => {
  it('should extract elements from THREE.Matrix4 identity', () => {
    const threeMatrix = new THREE.Matrix4()
    const result = fromThreeMatrix4(threeMatrix)
    expect(result.elements).toHaveLength(16)
    expect(result.elements[0]).toBe(1)
    expect(result.elements[5]).toBe(1)
    expect(result.elements[10]).toBe(1)
    expect(result.elements[15]).toBe(1)
  })

  it('should copy elements as a snapshot (not reference)', () => {
    const threeMatrix = new THREE.Matrix4()
    const result = fromThreeMatrix4(threeMatrix)
    threeMatrix.makeScale(2, 2, 2)
    expect(result.elements[0]).toBe(1)
  })

  it('should extract non-identity matrix elements correctly', () => {
    const threeMatrix = new THREE.Matrix4().makeTranslation(1, 2, 3)
    const result = fromThreeMatrix4(threeMatrix)
    expect(result.elements).toHaveLength(16)
    expect(result.elements[12]).toBe(1)
    expect(result.elements[13]).toBe(2)
    expect(result.elements[14]).toBe(3)
  })
})

describe('toThreeMatrix4', () => {
  it('should create a THREE.Matrix4 instance', () => {
    const result = toThreeMatrix4(identity)
    expect(result).toBeInstanceOf(THREE.Matrix4)
  })

  it('should create a THREE.Matrix4 with the same elements as identity', () => {
    const result = toThreeMatrix4(identity)
    expect(result.elements[0]).toBe(1)
    expect(result.elements[5]).toBe(1)
    expect(result.elements[10]).toBe(1)
    expect(result.elements[15]).toBe(1)
  })
})

describe('fromThreeMatrix4 / toThreeMatrix4 roundtrip', () => {
  it('fromThreeMatrix4(toThreeMatrix4(identity)) should equal identity', () => {
    const result = fromThreeMatrix4(toThreeMatrix4(identity))
    expect(result.elements).toEqual(identity.elements)
  })

  it('toThreeMatrix4(fromThreeMatrix4(m)) should produce equivalent matrix', () => {
    const threeMatrix = new THREE.Matrix4().makeScale(2, 3, 4)
    const intermediate = fromThreeMatrix4(threeMatrix)
    const result = toThreeMatrix4(intermediate)
    expect(result).toBeInstanceOf(THREE.Matrix4)
    Arr.forEach(Arr.makeBy(16, i => i), (i) => {
      expect(result.elements[i]).toBeCloseTo(threeMatrix.elements[i])
    })
  })
})
