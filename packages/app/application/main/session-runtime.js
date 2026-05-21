import { Effect, Option } from 'effect';
import * as THREE from 'three';
import { createFrameHandlers } from '@ts-minecraft/app/frame-handler';
import { installQaApi } from '@ts-minecraft/app/main/qa-api';
import { wrapFrameHandlerWithBrowserEffects } from '@ts-minecraft/app/main/browser-runtime';
// Assembles FrameHandlerDeps from the flat SessionRuntimeParams record.
// Kept as a local helper — callers use buildSessionRuntime which calls it internally.
const assembleFrameHandlerDeps = (p) => {
    const dayNightRenderer = {
        setClearColor: (color) => p.renderer.setClearColor(new THREE.Color().setRGB(color.r, color.g, color.b)),
    };
    const { light, ambientLight, skyPort, skyNight, skyDay, skyCurrent, sky } = p.lighting;
    return {
        renderer: p.renderer,
        scene: p.scene,
        camera: p.camera,
        respawnPosition: p.defaultRespawnPosition,
        lights: { light, ambientLight, renderer: dayNightRenderer, skyNight, skyDay, skyCurrent, sky: Option.some(skyPort) },
        skyMesh: Option.some(sky),
        fpsElement: Option.fromNullable(p.fpsElement),
        healthValueElement: Option.fromNullable(p.healthValueElement),
        healthMaxElement: Option.fromNullable(p.healthMaxElement),
        gamePausedRef: p.gamePausedRef,
        sessionPausedRef: p.control.isPausedRef,
        composer: Option.some(p.composer),
        gtaoPass: p.gtaoPass,
        bloomPass: p.bloomPass,
        dofPass: p.bokehPass,
        godRaysPass: p.godRaysPass,
        smaaPass: p.smaaPass,
    };
};
// Builds frame handlers + mounts all per-session overlays (death screen, pause menu,
// debug overlay) then wraps the frame handler with browser-event side effects.
//
// Returns the wrapped frame handler (ready for GameLoopService.start) and the
// maintenance handler (ready for GameLoopService.startMaintenance).
export const buildSessionRuntime = (params, services) => Effect.gen(function* () {
    const { renderer, scene, camera, composerRT, composer, gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass, pendingResizeRef, pendingSaveDirtyChunksRef, persistSessionState, control, deathScreen, debugOverlay, biomeService, recipeService, defaultRespawnPosition, } = params;
    const { gameState, playerCameraState, blockHighlight, inputService, blockService, hotbarService, furnaceService, inventoryService, inventoryRenderer, chunkManagerService, timeService, settingsService, debugFeatureFlags, pauseMenu, worldRendererService, entityManager, fpsCounter, } = services;
    const frameHandlerDeps = assembleFrameHandlerDeps(params);
    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(frameHandlerDeps, services);
    yield* installQaApi({
        camera,
        scene,
        playerCameraState,
        blockHighlight,
        inputService,
        inventoryService,
        inventoryRenderer,
        gameState,
        timeService,
        chunkManagerService,
        blockService,
        hotbarService,
        recipeService,
        furnaceService,
        worldRendererService,
        entityManager,
        debugFeatureFlags,
    });
    yield* deathScreen.attach(control, defaultRespawnPosition);
    // FR-1.4: mount the in-session pause menu. Listens for ESC via the
    // frame-handler input stage (which calls `pauseMenu.openIfClosed(control)`)
    // and drives Resume / Settings / Save & Quit. Listeners + DOM are torn
    // down with the surrounding session scope on quit-to-title.
    yield* pauseMenu.attach(control);
    // FR-1.5: mount the F3 debug overlay. Hidden by default; F3 toggles it.
    // The 4 Hz refresh daemon is forked into the session scope so it tears
    // down with quit-to-title.
    yield* debugOverlay.attach({
        biomeService,
        chunkManager: chunkManagerService,
        gameState,
        timeService,
        cameraState: playerCameraState,
        fpsCounter,
        debugFeatureFlags,
    });
    const frameHandlerWithBrowserEvents = wrapFrameHandlerWithBrowserEffects({
        pendingResizeRef,
        pendingSaveDirtyChunksRef,
        chunkManagerService,
        persistSessionState: persistSessionState().pipe(Effect.catchAllCause(() => Effect.void)),
        settingsService,
        renderer,
        camera,
        composer,
        composerRT,
        worldRendererService,
        gtaoPass,
        bloomPass,
        bokehPass,
        smaaPass,
        godRaysPass,
        frameHandler,
    });
    return { frameHandlerWithBrowserEvents, maintenanceHandler };
});
//# sourceMappingURL=../../../../dist/packages/app/application/main/session-runtime.js.map