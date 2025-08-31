import { Effect, Layer, Option } from "effect";
import * as THREE from "three";
import { Position } from "../domain/components";
import { Renderer, RaycastService, RaycastResult } from "../runtime/services";
import { ThreeJsContext } from "./renderer-three";

const REACH = 8;

const make = Effect.gen(function* (_) {
  const { camera } = yield* _(ThreeJsContext);
  const renderer = yield* _(Renderer);
  const raycaster = new THREE.Raycaster();

  const cast = () =>
    Effect.gen(function* (_) {
      const { scene, instanceIdToEntityId } = yield* _(renderer.getRaycastables());
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const intersection of intersects) {
        const obj = intersection.object;
        if (
          obj instanceof THREE.InstancedMesh &&
          intersection.instanceId !== undefined &&
          intersection.distance <= REACH
        ) {
          const blockType = obj.name;
          const instanceId = intersection.instanceId;
          const entityIdMap = instanceIdToEntityId.get(blockType as any);

          if (entityIdMap && entityIdMap.has(instanceId)) {
            const entityId = entityIdMap.get(instanceId)!;
            const hitPos = new THREE.Vector3()
              .copy(intersection.point)
              .sub(intersection.face!.normal.multiplyScalar(0.5))
              .round();

            const result: RaycastResult = {
              entityId,
              position: new Position(hitPos),
              face: {
                x: intersection.face!.normal.x,
                y: intersection.face!.normal.y,
                z: intersection.face!.normal.z,
              },
              intersection,
            };
            return Option.some(result);
          }
        }
      }
      return Option.none<RaycastResult>();
    });

  return { cast };
});

export const RaycastLive = Layer.effect(RaycastService, make);
