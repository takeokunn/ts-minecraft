import { Effect, Option } from 'effect';
import * as THREE from 'three';
import { StartupError } from '@ts-minecraft/game';
import { RendererService } from '@ts-minecraft/rendering';
import { PerfHudService } from '@ts-minecraft/rendering';
import { TerrainWorkerPool } from '@ts-minecraft/terrain';
import { SettingsService } from '@ts-minecraft/game';
import { StorageService } from '@ts-minecraft/world-state';
import { NoiseService } from '@ts-minecraft/terrain';
import { SoundManager, MusicManager } from '@ts-minecraft/game';
// Initializes the persistent process-level layer — runs ONCE at startup and returns
// a BootContext reused across every world session. Must be invoked under `Effect.scoped`
// so the renderer + audio engine are released on tab unload.
//
// Excluded from boot (lives in sessionProgram):
//   - scene + camera (per-world scene graph)
//   - composer + post-processing passes (depend on scene/camera bindings)
//   - chunk/entity/world services (per-world domain state)
//   - all overlays (mounted into session scope)
//   - game loop (forked per session)
//
// NOTE: composer/passes are kept in sessionProgram because RenderPass binds
// scene+camera by reference at construction; pulling them into boot would require
// rebinding `renderPass.scene = ...` on every session entry.
export const bootProgram = Effect.gen(function* () {
    const canvas = yield* Effect.sync(() => Option.fromNullable(document.getElementById('game-canvas'))).pipe(Effect.flatMap(Option.match({
        onNone: () => Effect.fail(new StartupError({ reason: 'Canvas element not found' })),
        onSome: (el) => el instanceof HTMLCanvasElement
            ? Effect.succeed(el)
            : Effect.fail(new StartupError({ reason: 'Canvas element is not an HTMLCanvasElement' })),
    })));
    const rendererService = yield* RendererService;
    const perfHud = yield* PerfHudService;
    const settingsService = yield* SettingsService;
    const storageService = yield* StorageService;
    const noiseService = yield* NoiseService;
    const terrainPool = yield* TerrainWorkerPool;
    const soundManager = yield* SoundManager;
    const musicManager = yield* MusicManager;
    // Renderer creation (long-lived GPU context).
    const renderer = yield* rendererService.create(canvas).pipe(Effect.mapError((cause) => new StartupError({ reason: 'Failed to create renderer', cause })));
    // Shadow map: always initialized as enabled (cannot change after first render).
    // castShadow on lights is toggled per-frame based on settings.
    yield* Effect.sync(() => {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
    });
    yield* Effect.log('Boot context ready (renderer + workers + audio + settings + storage)');
    return {
        canvas,
        renderer,
        perfHud,
        settingsService,
        storageService,
        noiseService,
        terrainPool,
        soundManager,
        musicManager,
    };
});
//# sourceMappingURL=../../../../dist/packages/app/application/main/boot.js.map