import { Context, Effect, Layer, Chunk, Option, ReadonlyArray } from 'effect';
import Stats from 'stats.js';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import {
  Camera,
  Renderer,
  RenderQueue,
  RenderCommand,
} from '../runtime/services';
import type {
  Camera as CameraType,
  Renderer as RendererType,
} from '../runtime/services';
import { EntityId } from '@/domain/entity';
import { BlockType } from '@/domain/block';
import { MaterialManager } from './material-manager';
import { World } from '@/runtime/world';
import {
  CameraState,
  InstancedMeshRenderable,
  Player,
  Position,
} from '@/domain/components';
import { instancedRenderableQuery } from '@/domain/queries';

// --- Service for core Three.js components ---

export interface ThreeJsContext {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: PointerLockControls;
  readonly highlightMesh: THREE.Mesh;
  readonly stats: Stats;
}
export const ThreeJsContext: Context.Tag<ThreeJsContext, ThreeJsContext> =
  Context.GenericTag<ThreeJsContext>('@services/ThreeJsContext');

/**
 * A layer that provides the core Three.js components (scene, camera, renderer).
 * It handles the creation and disposal of these resources.
 */
export const ThreeJsContextLive: Layer.Layer<ThreeJsContext> = Layer.scoped(
  ThreeJsContext,
  Effect.gen(function* (_) {
    // ... (Implementation remains the same)
    const scene: THREE.Scene = new THREE.Scene();
    scene.background = new THREE.Color(0x00ffff);
    scene.fog = new THREE.Fog(0x00ffff, 10, 150);

    const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.y = 50;

    const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const controls: PointerLockControls = new PointerLockControls(
      camera,
      renderer.domElement,
    );

    const highlightGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(
      1.01,
      1.01,
    );
    const highlightMaterial: THREE.MeshBasicMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.2,
      });
    const highlightMesh: THREE.Mesh = new THREE.Mesh(
      highlightGeometry,
      highlightMaterial,
    );
    highlightMesh.visible = false;
    scene.add(highlightMesh);

    const stats: Stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    const handleResize = (): void => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    yield* _(
      Effect.addFinalizer(() =>
        Effect.sync(() => {
          window.removeEventListener('resize', handleResize);
          document.body.removeChild(renderer.domElement);
          document.body.removeChild(stats.dom);
          renderer.dispose();
          controls.dispose();
        }),
      ),
    );

    return ThreeJsContext.of({
      scene,
      camera,
      renderer,
      controls,
      highlightMesh,
      stats,
    });
  }),
);

// --- Live implementation of the Renderer service ---

const MAX_INSTANCES = 50000;

/**
 * A layer that provides the Renderer service, which depends on the ThreeJsContext.
 */
export const RendererLive: Layer.Layer<
  RendererType,
  never,
  ThreeJsContext | RenderQueue | MaterialManager | World
> = Layer.effect(
  Renderer,
  Effect.gen(function* (_) {
    const { scene, camera, renderer, controls, highlightMesh, stats } =
      yield* _(ThreeJsContext);
    const renderQueue = yield* _(RenderQueue);
    const materialManager = yield* _(MaterialManager);
    const world = yield* _(World);

    // --- Chunk Mesh Management ---
    const chunkMeshes = new Map<string, THREE.Mesh>();
    const chunkMaterial = yield* _(materialManager.get(BlockType.Grass));

    // --- Instanced Mesh Management ---
    const instancedMeshes = new Map<string, THREE.InstancedMesh>();
    const dummy = new THREE.Object3D();

    // Setup player mesh
    const playerGeometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const playerMesh = new THREE.InstancedMesh(
      playerGeometry,
      playerMaterial,
      100, // Max 100 players
    );
    playerMesh.name = 'player';
    scene.add(playerMesh);
    instancedMeshes.set('player', playerMesh);

    const processCommands = (commands: Chunk.Chunk<RenderCommand>) =>
      Effect.forEach(
        commands,
        (command) =>
          Effect.sync(() => {
            switch (command._tag) {
              case 'UpsertChunk': {
                const { chunkX, chunkZ, mesh: meshData } = command;
                const chunkId = `${chunkX},${chunkZ}`;

                let mesh = chunkMeshes.get(chunkId);
                if (!mesh) {
                  const geometry = new THREE.BufferGeometry();
                  mesh = new THREE.Mesh(geometry, chunkMaterial);
                  mesh.name = `chunk-${chunkId}`;
                  scene.add(mesh);
                  chunkMeshes.set(chunkId, mesh);
                }

                const geometry = mesh.geometry;
                geometry.setAttribute(
                  'position',
                  new THREE.BufferAttribute(meshData.positions, 3),
                );
                geometry.setAttribute(
                  'normal',
                  new THREE.BufferAttribute(meshData.normals, 3),
                );
                geometry.setAttribute(
                  'uv',
                  new THREE.BufferAttribute(meshData.uvs, 2),
                );
                geometry.setIndex(
                  new THREE.BufferAttribute(meshData.indices, 1),
                );
                geometry.computeBoundingSphere();
                break;
              }
              case 'RemoveChunk': {
                const { chunkX, chunkZ } = command;
                const chunkId = `${chunkX},${chunkZ}`;
                const mesh = chunkMeshes.get(chunkId);
                if (mesh) {
                  scene.remove(mesh);
                  mesh.geometry.dispose();
                  chunkMeshes.delete(chunkId);
                }
                break;
              }
            }
          }),
        { discard: true },
      );

    const updateInstancedMeshes = Effect.gen(function* (_) {
      const results = yield* _(world.querySoA(instancedRenderableQuery));
      if (results.entities.length === 0) {
        // Hide all meshes if no entities are renderable
        for (const mesh of instancedMeshes.values()) {
          mesh.count = 0;
        }
        return;
      }

      // Group entities by meshType
      const groupedByMeshType = new Map<string, any[]>();
      for (let i = 0; i < results.entities.length; i++) {
        const meshType = results.instancedMeshRenderables.meshType[i];
        if (!groupedByMeshType.has(meshType)) {
          groupedByMeshType.set(meshType, []);
        }
        groupedByMeshType.get(meshType)!.push({
          x: results.positions.x[i],
          y: results.positions.y[i],
          z: results.positions.z[i],
        });
      }

      // Update each InstancedMesh
      for (const [meshType, entities] of groupedByMeshType.entries()) {
        const mesh = instancedMeshes.get(meshType);
        if (mesh) {
          mesh.count = entities.length;
          for (let i = 0; i < entities.length; i++) {
            const entity = entities[i];
            // Center the player model at the feet
            dummy.position.set(entity.x, entity.y + 1.8 / 2, entity.z);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
          }
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
    });

    return Renderer.of({
      render: () =>
        Effect.gen(function* (_) {
          // --- Process Render Queue Commands ---
          const commands = yield* _(renderQueue.takeAll());
          if (Chunk.isNonEmpty(commands)) {
            yield* _(processCommands(commands));
          }

          // --- Update Camera from ECS Data ---
          const playerOption = yield* _(
            world.querySingle(Player, Position, CameraState),
          );
          if (Option.isSome(playerOption)) {
            const [_id, [_player, pos, camState]] = playerOption.value;
            const threeCamera = controls.getObject();
            threeCamera.position.set(pos.x, pos.y + 1.6, pos.z);
            threeCamera.rotation.order = 'YXZ';
            threeCamera.rotation.y = camState.yaw;
            const pitchObject = threeCamera.children[0];
            if (pitchObject) {
              pitchObject.rotation.x = camState.pitch;
            }
          }

          // --- Update Instanced Meshes ---
          yield* _(updateInstancedMeshes);

          // --- Render Scene ---
          stats.begin();
          renderer.render(scene, camera);
          stats.end();
        }),
      updateHighlight: (target: THREE.Intersection | null) =>
        Effect.sync(() => {
          if (!target || !target.face) {
            highlightMesh.visible = false;
            return;
          }
          const hitPos: THREE.Vector3 = new THREE.Vector3()
            .copy(target.point)
            .add(target.face.normal.multiplyScalar(0.5))
            .floor();
          highlightMesh.position.copy(hitPos);
          highlightMesh.lookAt(
            new THREE.Vector3().copy(hitPos).add(target.face.normal),
          );
          highlightMesh.visible = true;
        }),
      getRaycastables: () =>
        Effect.succeed({ scene, instanceIdToEntityId: new Map() }),
    });
  }),
);

export const CameraLive: Layer.Layer<CameraType, never, ThreeJsContext> =
  Layer.effect(
    Camera,
    Effect.gen(function* (_) {
      const { controls } = yield* _(ThreeJsContext);
      const camera = controls.getObject();

      return Camera.of({
        moveRight: (delta) =>
          Effect.sync(() => {
            controls.moveRight(delta);
          }),
        rotatePitch: (delta) =>
          Effect.sync(() => {
            const newPitch = camera.rotation.x + delta;
            camera.rotation.x = Math.max(
              -Math.PI / 2,
              Math.min(Math.PI / 2, newPitch),
            );
          }),
        getYaw: () => Effect.succeed(controls.getObject().rotation.y),
        getPitch: () => Effect.succeed(camera.rotation.x),
      });
    }),
  );
