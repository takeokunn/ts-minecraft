import * as THREE from 'three';
import { ThreeContext, World, EntityId } from '@/domain/types';
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
  terrainBlockMap: Map<string, EntityId>,
): RaycastResult | undefined {
  if (!intersection.face) {
    return undefined;
  }

  hitPosVec.copy(intersection.point).add(intersection.face.normal.multiplyScalar(-0.5)).floor();

  const key = `${hitPosVec.x},${hitPosVec.y},${hitPosVec.z}`;
  const entityId = terrainBlockMap.get(key);

  if (entityId === undefined) {
    return undefined;
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

export function castRay(context: ThreeContext, world: World): RaycastResult | undefined {
  const { scene, camera } = context;
  const { components, tags } = world;

  const terrainBlockMap = new Map<string, EntityId>();
  for (const eid of tags.terrainBlock) {
    const pos = components.position.get(eid);
    if (pos) {
      terrainBlockMap.set(`${pos.x},${pos.y},${pos.z}`, eid);
    }
  }

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
      .otherwise(() => undefined);

    if (result) {
      return result;
    }
  }

  return undefined;
}