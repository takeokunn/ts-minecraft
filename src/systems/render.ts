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
import { type QueryResult, query } from '../runtime/world';

const MAX_INSTANCES = 50000;
const blockGeometry: THREE.BoxGeometry = new THREE.BoxGeometry();

type InstancedMeshRegistry = Map<BlockType, THREE.InstancedMesh>;

const makeRenderSystem: Effect.Effect<
  Effect.Effect<
    void,
    never,
    | ThreeJsContext
    | RenderContext
    | MaterialManager
    | Ref.Ref<InstancedMeshRegistry>
  >,
  never,
  ThreeJsContext | RenderContext | MaterialManager
> = Effect.gen(function* (_: Effect.Adapter) {
  const {
    scene,
  }: { scene: THREE.Scene; camera: THREE.PerspectiveCamera } =
    yield* _(ThreeJsContext);
  const renderContext: RenderContext = yield* _(RenderContext);
  const materialManager: MaterialManager = yield* _(MaterialManager);
  const meshRegistryRef: Ref.Ref<InstancedMeshRegistry> = yield* _(
    Ref.make<InstancedMeshRegistry>(new Map()),
  );

  const getOrCreateMesh = (
    blockType: BlockType,
    registry: InstancedMeshRegistry,
  ): THREE.InstancedMesh => {
    if (!registry.has(blockType)) {
      const material: THREE.Material | THREE.Material[] =
        materialManager.getMaterial(blockType);
      const mesh: THREE.InstancedMesh = new THREE.InstancedMesh(
        blockGeometry,
        material,
        MAX_INSTANCES,
      );
      mesh.name = blockType; // Store blockType in mesh name for identification
      registry.set(blockType, mesh);
      scene.add(mesh);
    }
    return registry.get(blockType)!;
  };

  return Effect.gen(function* (_) {
    const meshRegistry: InstancedMeshRegistry = yield* _(
      Ref.get(meshRegistryRef),
    );
    renderContext.instanceIdToEntityId.clear();

    // --- Camera Follow & Rotation Logic ---
    const playerQuery: ReadonlyArray<
      QueryResult<
        [typeof PlayerSchema, typeof PositionSchema, typeof CameraStateSchema]
      >
    > = yield* _(query(PlayerSchema, PositionSchema, CameraStateSchema));
    const player:
      | QueryResult<
          [typeof PlayerSchema, typeof PositionSchema, typeof CameraStateSchema]
        >
      | undefined = playerQuery[0];
    if (player) {
      const { controls } = yield* _(ThreeJsContext);
      const pos: Position = player.get(PositionSchema);
      const camState: CameraState = player.get(CameraStateSchema);

      controls.getObject().position.set(pos.x, pos.y + 1.6, pos.z); // Eye level

      // Manually set camera rotation from our state
      // This overrides PointerLockControls' internal rotation handling,
      // but allows our ECS state to be the source of truth.
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

      const mesh: THREE.InstancedMesh = getOrCreateMesh(
        renderable.blockType,
        meshRegistry,
      );
      const count: number = counts.get(renderable.blockType) ?? 0;

      if (count < MAX_INSTANCES) {
        matrix.setPosition(pos.x, pos.y, pos.z);
        mesh.setMatrixAt(count, matrix);

        // Populate the render context map
        if (!renderContext.instanceIdToEntityId.has(renderable.blockType)) {
          renderContext.instanceIdToEntityId.set(
            renderable.blockType,
            new Map<number, EntityId>(),
          );
        }
        renderContext.instanceIdToEntityId
          .get(renderable.blockType)!
          .set(count, entity.id);

        counts.set(renderable.blockType, count + 1);
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
  ThreeJsContext | RenderContext | MaterialManager
> = Effect.acquireRelease(
  makeRenderSystem,
  (
    _system: Effect.Effect<
      void,
      never,
      | ThreeJsContext
      | RenderContext
      | MaterialManager
      | Ref.Ref<InstancedMeshRegistry>
    >,
    _exit: unknown,
  ) =>
    Effect.gen(function* (_) {
      // Cleanup logic if needed
    }),
);
