import { Effect, Layer, Option } from "effect";
import * as THREE from "three";
import { Position } from "../domain/components";
import { RenderContext, RaycastService, RaycastResult } from "../runtime/services";
import { ThreeJsContext } from "./renderer-three";

const REACH = 8;

const make = Effect.gen(function* (_) {
  const { camera, scene } = yield* _(ThreeJsContext);
  const renderContext = yield* _(RenderContext);
  const raycaster = new THREE.Raycaster();

  const cast = () =>
    Effect.sync(() => {
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
          const entityIdMap = renderContext.instanceIdToEntityId.get(blockType as any);

          if (entityIdMap && entityIdMap.has(instanceId)) {
            const entityId = entityIdMap.get(instanceId)!;
            const hitPos = new THREE.Vector3()
              .copy(intersection.point)
              .sub(intersection.face!.normal.multiplyScalar(0.5))
              .round();

            const result: RaycastResult = {
              entityId,
              position: new Position(hitPos),
              face: intersection.face!.normal,
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
