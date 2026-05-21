import { Effect, MutableRef, Option, Ref } from 'effect';
import { logErrors } from '@ts-minecraft/app/frame/error-logging';
import { decideAdaptiveQuality } from '@ts-minecraft/app/frame/frame-runtime-logic';
export const hudStage = (deps, services, refs, inputs) => Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags();
    // Feed the per-frame delta into the perf-HUD ring buffer. No-op when
    // `?debug=perf` is absent (PerfHudService returns trivial impl).
    yield* services.perfHud.recordFrame(inputs.deltaTime);
    // Update FPS display — tick first, then update DOM only when displayed value changes
    const fps = yield* services.fpsCounter.tick(inputs.deltaTime).pipe(Effect.andThen(services.fpsCounter.getFPS()));
    const fpsText = fps.toFixed(1);
    yield* Ref.set(refs.frustumThrottleStrideRef, fps >= 100 ? 1 : fps >= 60 ? 2 : 4);
    const adaptiveCooldown = yield* Ref.get(refs.adaptiveQualityCooldownRef);
    // FR-1.4: suspend adaptive-quality evaluation while paused — pause-menu
    // overhead can briefly tank FPS without indicating a real perf problem.
    const adaptiveQualityDecision = inputs.paused
        ? { nextCooldown: adaptiveCooldown, settingsPatch: Option.none() }
        : decideAdaptiveQuality({
            adaptivePerformanceMode: inputs.currentSettings.adaptivePerformanceMode,
            graphicsQuality: inputs.currentSettings.graphicsQuality,
            renderDistance: inputs.currentSettings.renderDistance,
            fps,
            cooldown: adaptiveCooldown,
            chunkSyncPending: MutableRef.get(refs.chunkSyncPendingRef),
        });
    if (adaptiveQualityDecision.nextCooldown !== adaptiveCooldown) {
        yield* Ref.set(refs.adaptiveQualityCooldownRef, adaptiveQualityDecision.nextCooldown);
    }
    yield* Option.match(adaptiveQualityDecision.settingsPatch, {
        onNone: () => Effect.void,
        onSome: (patch) => services.settingsService.updateSettings(patch),
    });
    const fpsChanged = yield* Ref.modify(refs.lastFpsTextRef, (last) => last === fpsText ? [false, last] : [true, fpsText]);
    if (fpsChanged && inputs.fpsElementOrNull && debugFlags['ui.fps']) {
        yield* Effect.sync(() => {
            inputs.fpsElementOrNull.textContent = fpsText;
        });
    }
    // Render HUD hotbar overlay (second pass; autoClear=false prevents erasing the main scene)
    if (debugFlags['ui.hotbar']) {
        yield* logErrors(Effect.sync(() => {
            deps.renderer.autoClear = false;
        }).pipe(Effect.andThen(services.hotbarRenderer.render(deps.renderer)), Effect.andThen(Effect.sync(() => {
            deps.renderer.autoClear = true;
        }))), 'HUD render error');
    }
});
//# sourceMappingURL=../../../../../dist/packages/app/application/frame/stages/hud-stage.js.map