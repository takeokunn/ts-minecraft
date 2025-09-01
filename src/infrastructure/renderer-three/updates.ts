import * as THREE from 'three';
import { ThreeContext, World } from '@/domain/types';
import { syncCameraToComponent } from '../camera-three';
import { match, P } from 'ts-pattern';
import { Position } from '@/domain/components';
import { RaycastResult } from '../raycast-three';

const dummy = new THREE.Object3D();

export function updateInstancedMeshes(context: ThreeContext, world: World): void {
  const { instancedMeshes } = context;
  const { entities, components } = world;
  const { position, instancedMeshRenderable } = components;

  const playerMesh = instancedMeshes.get('player');
  if (!playerMesh) return;

  let count = 0;
  for (const eid of entities) {
    const pos = position.get(eid);
    const meshType = instancedMeshRenderable.get(eid);

    if (pos && meshType?.meshType === 'player') {
      dummy.position.set(pos.x, pos.y + 1.8 / 2, pos.z);
      dummy.updateMatrix();
      playerMesh.setMatrixAt(count, dummy.matrix);
      count++;
    }
  }

  playerMesh.count = count;
  playerMesh.instanceMatrix.needsUpdate = true;
}

export function syncCameraToWorld(context: ThreeContext, world: World): void {
  const { entities, components } = world;

  const playerEntity = Array.from(entities).find(eid => components.player.has(eid));

  if (playerEntity) {
    const pos = components.position.get(playerEntity);
    const camState = components.cameraState.get(playerEntity);
    if (pos && camState) {
      syncCameraToComponent(context.camera, pos, camState);
    }
  }
}

function getBlockPosition(world: World, raycastResult: RaycastResult): Position | undefined {
  return world.components.position.get(raycastResult.entityId);
}

export function updateHighlight(context: ThreeContext, world: World, raycastResult: RaycastResult | null): void {
  const { highlightMesh } = context;

  const position = match(raycastResult)
    .with(P.not(P.nullish), result => getBlockPosition(world, result))
    .otherwise(() => null);

  if (position) {
    highlightMesh.position.set(position.x + 0.5, position.y + 0.5, position.z + 0.5);
    highlightMesh.visible = true;
  } else {
    highlightMesh.visible = false;
  }
}