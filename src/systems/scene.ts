import { Context, Effect } from "effect";
import * as THREE from "three";
import { Position, Renderable } from "@/domain/components";
import type { EntityId } from "@/domain/entity";
import { MaterialManager } from "@/infrastructure/material-manager";
import { ThreeJsContext } from "@/infrastructure/renderer-three";
import type { BlockType } from "@/domain/block";
import { RenderContext } from "@/runtime/services";
import { World } from "@/runtime/world";

const MAX_INSTANCES = 50000;
const blockGeometry: THREE.BoxGeometry = new THREE.BoxGeometry();

type InstancedMeshRegistry = Map<BlockType, THREE.InstancedMesh>;

const makeSceneSystem = Effect.gen(function* (_) {
  const { scene } = yield* _(ThreeJsContext);
  const renderContext = yield* _(RenderContext);
  const materialManager = yield* _(MaterialManager);
  const world = yield* _(World);
  const meshRegistry: InstancedMeshRegistry = new Map();

  const getOrCreateMesh = (blockType: BlockType): THREE.InstancedMesh => {
    if (!meshRegistry.has(blockType)) {
      const material = materialManager.getMaterial(blockType);
      const mesh = new THREE.InstancedMesh(
        blockGeometry,
        material,
        MAX_INSTANCES,
      );
      mesh.name = blockType;
      meshRegistry.set(blockType, mesh);
      scene.add(mesh);
    }
    return meshRegistry.get(blockType)!;
  };

  return Effect.gen(function* (_) {
    renderContext.instanceIdToEntityId.clear();

    const renderableEntities = yield* _(world.query(Position, Renderable));
    const counts = new Map<BlockType, number>();
    const matrix = new THREE.Matrix4();

    for (const mesh of meshRegistry.values()) {
      mesh.count = 0;
    }

    for (const [id, [pos, renderable]] of renderableEntities) {
      const blockType = renderable.blockType;
      const mesh = getOrCreateMesh(blockType);
      const count = counts.get(blockType) ?? 0;

      if (count < MAX_INSTANCES) {
        matrix.setPosition(pos.x, pos.y, pos.z);
        mesh.setMatrixAt(count, matrix);

        if (!renderContext.instanceIdToEntityId.has(blockType)) {
          renderContext.instanceIdToEntityId.set(
            blockType,
            new Map<number, EntityId>(),
          );
        }
        renderContext.instanceIdToEntityId.get(blockType)!.set(count, id);

        counts.set(blockType, count + 1);
      }
    }

    for (const [blockType, mesh] of meshRegistry.entries()) {
      mesh.count = counts.get(blockType) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }).pipe(Effect.withSpan("sceneSystem"));
});

export const sceneSystem = Effect.flatMap(makeSceneSystem, (system) => system);
