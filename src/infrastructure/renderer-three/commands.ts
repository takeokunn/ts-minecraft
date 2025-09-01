import * as THREE from 'three';
import { RenderQueue, ThreeContext, RenderCommand } from '@/domain/types';
import { match } from 'ts-pattern';

const chunkMaterial = new THREE.MeshStandardMaterial({
  vertexColors: false,
  map: new THREE.TextureLoader().load('/assets/grass/side.jpeg'),
});

function handleUpsertChunk(context: ThreeContext, command: Extract<RenderCommand, { _tag: 'UpsertChunk' }>): void {
  const { scene, chunkMeshes } = context;
  const { chunkX, chunkZ, mesh: meshData } = command;
  const chunkId = `${chunkX},${chunkZ}`;

  const mesh =
    chunkMeshes.get(chunkId) ??
    (() => {
      const newGeometry = new THREE.BufferGeometry();
      const newMesh = new THREE.Mesh(newGeometry, chunkMaterial);
      newMesh.name = `chunk-${chunkId}`;
      scene.add(newMesh);
      chunkMeshes.set(chunkId, newMesh);
      return newMesh;
    })();

  const geometry = mesh.geometry;
  geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(meshData.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));
  geometry.computeBoundingSphere();
}

function handleRemoveChunk(context: ThreeContext, command: Extract<RenderCommand, { _tag: 'RemoveChunk' }>): void {
  const { scene, chunkMeshes } = context;
  const { chunkX, chunkZ } = command;
  const chunkId = `${chunkX},${chunkZ}`;
  const mesh = chunkMeshes.get(chunkId);

  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    chunkMeshes.delete(chunkId);
  }
}

export function processRenderQueue(context: ThreeContext, queue: RenderQueue): void {
  const commands = queue.splice(0, queue.length);

  for (const command of commands) {
    match(command)
      .with({ _tag: 'UpsertChunk' }, cmd => handleUpsertChunk(context, cmd))
      .with({ _tag: 'RemoveChunk' }, cmd => handleRemoveChunk(context, cmd))
      .exhaustive();
  }
}