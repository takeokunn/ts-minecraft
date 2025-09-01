import * as THREE from 'three';
import { match, P } from 'ts-pattern';
import { Position } from '@/domain/components';
import { createQuery } from '@/domain/query';
import { playerQuery } from '@/domain/queries';
import { query, World } from '@/runtime/world';
import { syncCameraToComponent } from '../camera-three';
import { RaycastResult } from '../raycast-three';
import { ThreeContext } from './context';

const dummy = new THREE.Object3D();

// A map from meshType to the query that finds entities for that mesh.
const meshQueries = {
  player: createQuery('instancedPlayer', [
    'position',
    'instancedMeshRenderable',
    'collider',
  ]),
  // Add other types here in the future, e.g., 'cow', 'zombie'
};

export function updateInstancedMeshes(context: ThreeContext, world: World): void {
  const { instancedMeshes } = context;

  for (const [meshType, instancedMesh] of instancedMeshes.entries()) {
    const meshQuery = meshQueries[meshType as keyof typeof meshQueries];
    if (!meshQuery) {
      continue;
    }

    const entities = query(world, meshQuery);

    instancedMesh.count = 0;
    for (const entity of entities) {
      if (entity.instancedMeshRenderable.meshType === meshType) {
        dummy.position.set(
          entity.position.x,
          entity.position.y + entity.collider.height / 2,
          entity.position.z,
        );
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(instancedMesh.count, dummy.matrix);
        instancedMesh.count++;
      }
    }
    instancedMesh.instanceMatrix.needsUpdate = true;
  }
}

export function syncCameraToWorld(context: ThreeContext, world: World): void {
  const results = query(world, playerQuery);
  const player = results[0];
  if (player) {
    syncCameraToComponent(context.camera, player.position, player.cameraState);
  }
}

function getBlockPosition(
  world: World,
  raycastResult: RaycastResult,
): Position | undefined {
  return world.components.position.get(raycastResult.entityId);
}

export function updateHighlight(context: ThreeContext, world: World): void {
  const { highlightMesh } = context;
  const { raycastResult } = world.globalState;

  const position = match(raycastResult)
    .with(P.not(P.nullish), result => getBlockPosition(world, result))
    .otherwise(() => null);

  if (position) {
    highlightMesh.position.set(
      position.x + 0.5,
      position.y + 0.5,
      position.z + 0.5,
    );
    highlightMesh.visible = true;
  } else {
    highlightMesh.visible = false;
  }
}
