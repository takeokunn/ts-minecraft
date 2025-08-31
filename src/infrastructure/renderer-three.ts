import { Context, Effect, Layer } from 'effect';
import Stats from 'stats.js';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Camera, Renderer } from '../runtime/services';
import type {
  Camera as CameraType,
  Renderer as RendererType,
} from '../runtime/services';
import type { WorldState } from '../runtime/world';

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
    // Create scene and camera
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

    // Create renderer and attach to DOM
    const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create PointerLockControls
    const controls: PointerLockControls = new PointerLockControls(
      camera,
      renderer.domElement,
    );

    // Create highlight mesh
    const highlightGeometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(
      1.01,
      1.01,
    ); // Slightly larger to avoid z-fighting
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

    // Create stats and attach to DOM
    const stats: Stats = new Stats();
    stats.showPanel(0); // 0:fps, 1:ms, 2:mb
    document.body.appendChild(stats.dom);

    // Handle window resize
    const handleResize = (): void => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      // renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Ensure resources are cleaned up when the scope is closed
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

/**
 * A layer that provides the Renderer service, which depends on the ThreeJsContext.
 */
export const RendererLive: Layer.Layer<RendererType, never, ThreeJsContext> =
  Layer.effect(
    Renderer,
    Effect.gen(function* (_) {
      const { scene, camera, renderer, highlightMesh, stats } =
        yield* _(ThreeJsContext);
      return Renderer.of({
        render: (_world: WorldState) =>
          Effect.sync(() => {
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

            // Use the more precise logic from 3dminecraft.html
            const hitPos: THREE.Vector3 = new THREE.Vector3()
              .copy(target.point)
              .sub(target.face.normal.multiplyScalar(0.5))
              .round();

            highlightMesh.position.copy(hitPos);
            highlightMesh.lookAt(
              new THREE.Vector3().copy(hitPos).add(target.face.normal),
            );

            highlightMesh.visible = true;
          }),
      });
    }),
  );

export const CameraLive: Layer.Layer<CameraType, never, ThreeJsContext> =
  Layer.effect(
    Camera,
    Effect.gen(function* (_) {
      const { controls } = yield* _(ThreeJsContext);
      const camera = controls.getObject().children[0];

      return Camera.of({
        moveRight: (delta) =>
          Effect.sync(() => {
            controls.moveRight(delta);
          }),
        rotatePitch: (delta) =>
          Effect.sync(() => {
            if (!camera) return;
            const newPitch = camera.rotation.x + delta;
            camera.rotation.x = Math.max(
              -Math.PI / 2,
              Math.min(Math.PI / 2, newPitch),
            );
          }),
        getYaw: () => Effect.succeed(controls.getObject().rotation.y),
        getPitch: () => Effect.succeed(camera?.rotation.x ?? 0),
      });
    }),
  );
