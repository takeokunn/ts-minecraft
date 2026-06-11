import { describe, it, expect } from 'vitest'
import {
  INITIAL_QUAD_CAPACITY,
  INITIAL_VERTEX_CAPACITY,
  INITIAL_INDEX_CAPACITY,
  createAccumulator,
  ensureCapacity,
  addQuad,
} from '../infrastructure/meshing/greedy-meshing-accumulator'

describe('accumulator constants', () => {
  it('INITIAL_VERTEX_CAPACITY is 4× INITIAL_QUAD_CAPACITY', () => {
    expect(INITIAL_VERTEX_CAPACITY).toBe(INITIAL_QUAD_CAPACITY * 4)
  })

  it('INITIAL_INDEX_CAPACITY is 6× INITIAL_QUAD_CAPACITY', () => {
    expect(INITIAL_INDEX_CAPACITY).toBe(INITIAL_QUAD_CAPACITY * 6)
  })
})

describe('createAccumulator', () => {
  it('starts with vertexCount=0 and indexCount=0', () => {
    const acc = createAccumulator()
    expect(acc.vertexCount).toBe(0)
    expect(acc.indexCount).toBe(0)
  })

  it('positions buffer has length INITIAL_VERTEX_CAPACITY×3', () => {
    const acc = createAccumulator()
    expect(acc.positions.length).toBe(INITIAL_VERTEX_CAPACITY * 3)
  })

  it('normals buffer matches positions length', () => {
    const acc = createAccumulator()
    expect(acc.normals.length).toBe(acc.positions.length)
  })

  it('uvs buffer has length INITIAL_VERTEX_CAPACITY×2', () => {
    const acc = createAccumulator()
    expect(acc.uvs.length).toBe(INITIAL_VERTEX_CAPACITY * 2)
  })

  it('indices buffer has length INITIAL_INDEX_CAPACITY', () => {
    const acc = createAccumulator()
    expect(acc.indices.length).toBe(INITIAL_INDEX_CAPACITY)
  })

  it('all buffers are initialized to zero', () => {
    const acc = createAccumulator()
    expect(acc.positions.every((v) => v === 0)).toBe(true)
    expect(acc.normals.every((v) => v === 0)).toBe(true)
    expect(acc.indices.every((v) => v === 0)).toBe(true)
  })
})

describe('ensureCapacity', () => {
  it('does nothing when existing capacity is sufficient', () => {
    const acc = createAccumulator()
    const oldPos = acc.positions
    ensureCapacity(acc, 1)
    expect(acc.positions).toBe(oldPos)
  })

  it('reallocates and copies when adding more quads than capacity allows', () => {
    const acc = createAccumulator()
    acc.vertexCount = INITIAL_VERTEX_CAPACITY
    acc.positions[0] = 42
    const prevLen = acc.positions.length
    ensureCapacity(acc, 1)
    expect(acc.positions.length).toBeGreaterThan(prevLen)
    expect(acc.positions[0]).toBe(42)
  })

  it('after reallocation normals buffer matches positions length', () => {
    const acc = createAccumulator()
    acc.vertexCount = INITIAL_VERTEX_CAPACITY
    ensureCapacity(acc, 1)
    expect(acc.normals.length).toBe(acc.positions.length)
  })

  it('reallocates indices buffer when index space is exhausted', () => {
    const acc = createAccumulator()
    acc.indexCount = INITIAL_INDEX_CAPACITY
    const prevLen = acc.indices.length
    ensureCapacity(acc, 1)
    expect(acc.indices.length).toBeGreaterThan(prevLen)
  })
})

describe('addQuad', () => {
  it('increments vertexCount by 4', () => {
    const acc = createAccumulator()
    addQuad(
      acc,
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
      [0, 0, 1],
      1,
      [0, 0, 0, 0], [15, 15, 15, 15], [0, 0, 0, 0],
      'side', 1, 1,
    )
    expect(acc.vertexCount).toBe(4)
  })

  it('increments indexCount by 6', () => {
    const acc = createAccumulator()
    addQuad(
      acc,
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
      [0, 0, 1],
      1,
      [0, 0, 0, 0], [15, 15, 15, 15], [0, 0, 0, 0],
      'side', 1, 1,
    )
    expect(acc.indexCount).toBe(6)
  })

  it('writes the first vertex position at offset 0', () => {
    const acc = createAccumulator()
    addQuad(
      acc,
      [3, 7, 11], [4, 7, 11], [4, 8, 11], [3, 8, 11],
      [0, 0, 1],
      0,
      [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
      'top', 1, 1,
    )
    expect(acc.positions[0]).toBe(3)
    expect(acc.positions[1]).toBe(7)
    expect(acc.positions[2]).toBe(11)
  })

  it('writes two triangles in the indices buffer (0-1-2, 0-2-3)', () => {
    const acc = createAccumulator()
    addQuad(
      acc,
      [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
      [0, 0, 1],
      0,
      [0, 0, 0, 0], [15, 15, 15, 15], [0, 0, 0, 0],
      'side', 1, 1,
    )
    expect([...acc.indices.slice(0, 6)]).toEqual([0, 1, 2, 0, 2, 3])
  })

  it('second addQuad shifts vertex indices by 4', () => {
    const acc = createAccumulator()
    const q = () =>
      addQuad(
        acc,
        [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
        [0, 0, 1],
        0,
        [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
        'top', 1, 1,
      )
    q()
    q()
    expect([...acc.indices.slice(6, 12)]).toEqual([4, 5, 6, 4, 6, 7])
  })
})
