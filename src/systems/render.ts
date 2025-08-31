import { Effect, Ref } from 'effect';
import * as THREE from 'three';
import {
  CameraStateSchema,
  PlayerSchema,
  PositionSchema,
  RenderableSchema,
  type CameraState,
  type Position,
  type Renderable,
} from '../domain/components';
import type { EntityId } from '../domain/entity';
import { MaterialManager } from '../infrastructure/material-manager';
import { ThreeJsContext } from '../infrastructure/renderer-three';
import type { BlockType } from '../runtime/game-state';
import { RenderContext } from '../runtime/services';
import { type QueryResult, query, type World } from '../runtime/world';

const MAX_INSTANCES = 50000;
const blockGeometry: THREE.BoxGeometry = new THREE.BoxGeometry();

type InstancedMeshRegistry = Map<BlockType, THREE.InstancedMesh>;
const InstancedMeshRegistry = Ref.Tag<InstancedMeshRegistry>();

const makeRenderSystem = Effect.gen(function* (_: Effect.Adapter) {
  const { scene }: { scene: THREE.Scene } = yield* _(ThreeJsContext);
  const renderContext: RenderContext = yield* _(RenderContext);
  const materialManager: MaterialManager = yield* _(MaterialManager);
  const meshRegistry: InstancedMeshRegistry = new Map();

  const getOrCreateMesh = (blockType: BlockType): THREE.InstancedMesh => {
    if (!meshRegistry.has(blockType)) {
      const material: THREE.Material | THREE.Material[] =
        materialManager.getMaterial(blockType);
      const mesh: THREE.InstancedMesh = new THREE.InstancedMesh(
        blockGeometry,
        material,
        MAX_INSTANCES,
      );
      mesh.name = blockType; // Store blockType in mesh name for identification
      meshRegistry.set(blockType, mesh);
      scene.add(mesh);
    }
    return meshRegistry.get(blockType)!;
  };

  return Effect.gen(function* (_) {
    renderContext.instanceIdToEntityId.clear();

    // --- Camera Follow & Rotation Logic ---
    const playerQuery: ReadonlyArray<
      QueryResult<
        [typeof PlayerSchema, typeof PositionSchema, typeof CameraStateSchema]
      >
    > = yield* _(query(PlayerSchema, PositionSchema, CameraStateSchema));
    const player = playerQuery[0];
    if (player) {
      const { controls } = yield* _(ThreeJsContext);
      const pos: Position = player.get(PositionSchema);
      const camState: CameraState = player.get(CameraStateSchema);

      controls.getObject().position.set(pos.x, pos.y + 1.6, pos.z); // Eye level

      const camera = controls.getObject();
      camera.rotation.order = 'YXZ';
      camera.rotation.y = camState.yaw;
      camera.rotation.x = camState.pitch;
    }

    // --- Mesh Rendering Logic ---
    const renderableEntities: ReadonlyArray<
      QueryResult<[typeof PositionSchema, typeof RenderableSchema]>
    > = yield* _(query(PositionSchema, RenderableSchema));
    const counts: Map<BlockType, number> = new Map<BlockType, number>();
    const matrix: THREE.Matrix4 = new THREE.Matrix4();

    // Reset all mesh counts
    for (const mesh of meshRegistry.values()) {
      mesh.count = 0;
    }

    for (const entity of renderableEntities) {
      const pos: Position = entity.get(PositionSchema);
      const renderable: Renderable = entity.get(RenderableSchema);
      const blockType = renderable.blockType as BlockType;

      const mesh: THREE.InstancedMesh = getOrCreateMesh(blockType);
      const count: number = counts.get(blockType) ?? 0;

      if (count < MAX_INSTANCES) {
        matrix.setPosition(pos.x, pos.y, pos.z);
        mesh.setMatrixAt(count, matrix);

        if (!renderContext.instanceIdToEntityId.has(blockType)) {
          renderContext.instanceIdToEntityId.set(
            blockType,
            new Map<number, EntityId>(),
          );
        }
        renderContext.instanceIdToEntityId
          .get(blockType)!
          .set(count, entity.id);

        counts.set(blockType, count + 1);
      }
    }

    // Update instance matrices
    for (const [blockType, mesh] of meshRegistry.entries()) {
      mesh.count = counts.get(blockType) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }).pipe(Effect.withSpan('renderSystem'));
});

export const renderSystem: Effect.Effect<
  void,
  never,
  World | ThreeJsContext | RenderContext | MaterialManager
> = Effect.flatMap(makeRenderSystem, (system) => system);
