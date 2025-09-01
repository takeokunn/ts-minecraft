import * as THREE from 'three';
import { ThreeContext, EntityId } from '@/domain/types';
import { match, P } from 'ts-pattern';

const REACH = 8;
const raycaster = new THREE.Raycaster();
const hitPosVec = new THREE.Vector3();
const centerScreenVec = new THREE.Vector2(0, 0);

export type RaycastResult = {
  readonly entityId: EntityId;
  readonly face: { x: number; y: number; z: number };
  readonly intersection: THREE.Intersection;
};

function findHitEntity(
  intersection: THREE.Intersection,
  terrainBlockMap: ReadonlyMap<string, EntityId>,
): RaycastResult | null {
  if (!intersection.face) {
    return null;
  }

  // To reliably find the block position from the intersection point,
  // we move the point slightly *inside* the block along the face's normal
  // before flooring the coordinates. This avoids floating-point errors
  // at the edges of blocks.
  hitPosVec.copy(intersection.point).add(intersection.face.normal.multiplyScalar(-0.5)).floor();

  const key = `${hitPosVec.x},${hitPosVec.y},${hitPosVec.z}`;
  const entityId = terrainBlockMap.get(key);

  if (entityId === undefined) {
    return null;
  }

  return {
    entityId,
    face: {
      x: intersection.face.normal.x,
      y: intersection.face.normal.y,
      z: intersection.face.normal.z,
    },
    intersection,
  };
}

export function castRay(
  context: ThreeContext,
  terrainBlockMap: ReadonlyMap<string, EntityId>,
): RaycastResult | null {
  const { scene, camera } = context;

  raycaster.setFromCamera(centerScreenVec, camera.camera);
  const intersects = raycaster.intersectObjects(scene.children, false);

  for (const intersection of intersects) {
    const result = match(intersection)
      .with(
        {
          distance: P.number.lt(REACH),
          object: { userData: { type: 'chunk' } },
        },
        hit => findHitEntity(hit, terrainBlockMap),
      )
      .otherwise(() => null);

    if (result) {
      return result;
    }
  }

  return null;
}
