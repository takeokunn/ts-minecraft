import { Effect } from 'effect';
import * as THREE from 'three';
const TONE_MAPPING_EXPOSURE = 0.7;
export class RendererService extends Effect.Service()('@minecraft/infrastructure/three/RendererService', {
    succeed: {
        create: (canvas) => Effect.sync(() => {
            const renderer = new THREE.WebGLRenderer({
                canvas,
                antialias: false,
                stencil: false,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false,
            });
            renderer.setSize(canvas.clientWidth, canvas.clientHeight);
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            return renderer;
        }),
        render: (renderer, scene, camera) => Effect.sync(() => {
            renderer.render(scene, camera);
        }),
        resize: (renderer, width, height) => Effect.sync(() => {
            renderer.setSize(width, height);
        }),
        renderOverlay: (renderer, hudScene, hudCamera) => Effect.sync(() => {
            // Reset depth buffer so HUD geometry always renders in front of world geometry,
            // regardless of the depth values written by the main scene pass.
            renderer.clearDepth();
            renderer.render(hudScene, hudCamera);
        }),
    },
}) {
}
export const RendererServiceLive = RendererService.Default;
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/renderer/renderer-service.js.map