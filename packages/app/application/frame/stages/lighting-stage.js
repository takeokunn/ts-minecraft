import { Effect, Ref } from 'effect';
import { logErrors } from '@ts-minecraft/app/frame/error-logging';
import { updateDayNightCycle } from '@ts-minecraft/game';
export const lightingStage = (deps, services, refs, inputs) => Effect.gen(function* () {
    yield* logErrors(updateDayNightCycle(inputs.deltaTime, inputs.effectiveLights, services.timeService), 'Day/night error');
    yield* Ref.updateAndGet(refs.shadowUpdateCounterRef, (n) => (n + 1) % 8).pipe(Effect.flatMap((shadowFrame) => shadowFrame === 0 && deps.lights.light.castShadow
        ? Effect.sync(() => {
            inputs.markShadowMapDirty();
        })
        : Effect.void));
    yield* logErrors(services.timeService.isNight().pipe(Effect.flatMap((isNight) => services.musicManager.updateFromContext({ isNight, playerPosition: inputs.playerPos }))), 'Music update error');
    const timeOfDay = yield* services.timeService.getTimeOfDay();
    // Sun-driven shader uniform — derived from the canonical day-factor formula
    // (matches `updateDayNightCycle`'s sin curve so chunk lighting tracks the visible sun).
    const sunIntensity = Math.max(0, Math.sin((timeOfDay - 0.25) * Math.PI * 2));
    yield* logErrors(services.chunkMeshService.setSunIntensity(sunIntensity), 'Sun intensity sync error');
    return { timeOfDay };
});
//# sourceMappingURL=../../../../../dist/packages/app/application/frame/stages/lighting-stage.js.map