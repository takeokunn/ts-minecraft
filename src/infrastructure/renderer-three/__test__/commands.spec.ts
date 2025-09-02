import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { processRenderQueue } from '../commands'
import type { ThreeContext } from '../../types'
import type { RenderQueue } from '@/domain/types'

const createMockContext = (): ThreeContext => {
  const scene = { add: vi.fn(), remove: vi.fn() }
  const chunkMeshes = new Map<string, THREE.Mesh>()
  return {
    scene,
    chunkMeshes,
  } as any
}

describe('processRenderQueue', () => {
  it('should handle UpsertChunk command for a new chunk', () => {
    const context = createMockContext()
    const material = new THREE.Material()
    const queue: RenderQueue = [
      {
        type: 'UpsertChunk',
        chunkX: 0,
        chunkZ: 0,
        mesh: {
          positions: new Float32Array([1, 2, 3]),
          normals: new Float32Array([0, 1, 0]),
          uvs: new Float32Array([0, 0]),
          indices: new Uint32Array([0]),
        },
      },
    ]

    processRenderQueue(context, queue, material)

    expect(context.scene.add).toHaveBeenCalled()
    const mesh = context.chunkMeshes.get('0,0')
    expect(mesh).toBeDefined()
    expect(mesh?.name).toBe('chunk-0,0')
    expect(mesh?.userData.type).toBe('chunk')
    expect(mesh?.geometry.getAttribute('position').array).toEqual(new Float32Array([1, 2, 3]))
  })

  it('should handle UpsertChunk command for an existing chunk', () => {
    const context = createMockContext()
    const material = new THREE.Material()
    const existingMesh = new THREE.Mesh(new THREE.BufferGeometry(), material)
    vi.spyOn(existingMesh.geometry, 'setAttribute')
    context.chunkMeshes.set('0,0', existingMesh)

    const queue: RenderQueue = [
      {
        type: 'UpsertChunk',
        chunkX: 0,
        chunkZ: 0,
        mesh: {
          positions: new Float32Array([4, 5, 6]),
          normals: new Float32Array([0, 0, 1]),
          uvs: new Float32Array([1, 1]),
          indices: new Uint32Array([0]),
        },
      },
    ]

    processRenderQueue(context, queue, material)

    expect(context.scene.add).not.toHaveBeenCalled()
    expect(existingMesh.geometry.setAttribute).toHaveBeenCalledWith('position', expect.any(THREE.BufferAttribute))
  })

  it('should handle RemoveChunk command', () => {
    const context = createMockContext()
    const material = new THREE.Material()
    const mesh = new THREE.Mesh()
    mesh.geometry.dispose = vi.fn()
    context.chunkMeshes.set('1,1', mesh)

    const queue: RenderQueue = [{ type: 'RemoveChunk', chunkX: 1, chunkZ: 1 }]

    processRenderQueue(context, queue, material)

    expect(context.scene.remove).toHaveBeenCalledWith(mesh)
    expect(mesh.geometry.dispose).toHaveBeenCalled()
    expect(context.chunkMeshes.has('1,1')).toBe(false)
  })
})
