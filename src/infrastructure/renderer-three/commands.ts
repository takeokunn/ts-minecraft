import * as THREE from 'three'
import { match } from 'ts-pattern'
import { RenderQueue, RenderCommand } from '@/domain/types'
import { ThreeContext } from '../types'

function handleUpsertChunk(context: ThreeContext, command: Extract<RenderCommand, { type: 'UpsertChunk' }>, material: THREE.Material): void {
  const { scene, chunkMeshes } = context
  const { chunkX, chunkZ, mesh: meshData } = command
  const chunkId = `${chunkX},${chunkZ}`

  const mesh =
    chunkMeshes.get(chunkId) ??
    (() => {
      const newGeometry = new THREE.BufferGeometry()
      const newMesh = new THREE.Mesh(newGeometry, material)
      newMesh.name = `chunk-${chunkId}`
      newMesh.userData = { type: 'chunk' } // Add type for raycasting
      scene.add(newMesh)
      chunkMeshes.set(chunkId, newMesh)
      return newMesh
    })()

  const geometry = mesh.geometry
  geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(meshData.uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1))
  geometry.computeBoundingSphere()
}

function handleRemoveChunk(context: ThreeContext, command: Extract<RenderCommand, { type: 'RemoveChunk' }>): void {
  const { scene, chunkMeshes } = context
  const { chunkX, chunkZ } = command
  const chunkId = `${chunkX},${chunkZ}`
  const mesh = chunkMeshes.get(chunkId)

  if (mesh) {
    scene.remove(mesh)
    mesh.geometry.dispose()
    chunkMeshes.delete(chunkId)
  }
}

export function processRenderQueue(context: ThreeContext, queue: RenderQueue, material: THREE.Material): void {
  const commands = queue.splice(0, queue.length)

  for (const command of commands) {
    match(command)
      .with({ type: 'UpsertChunk' }, (cmd) => handleUpsertChunk(context, cmd, material))
      .with({ type: 'RemoveChunk' }, (cmd) => handleRemoveChunk(context, cmd))
      .exhaustive()
  }
}
