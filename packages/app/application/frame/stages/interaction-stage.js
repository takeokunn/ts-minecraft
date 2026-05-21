// Stage 7: interactionStage — block highlight, then break/place/redstone interactions.
// Decomposed into 4 helpers to keep the orchestrator at low cyclomatic complexity:
//   - handleHotbarInput   — keyboard 1-9 / wheel slot selection + HUD update
//   - handleRedstoneInput — 8-way Match dispatch on redstone key flags
//   - handleLeftClick     — entity attack / block break / particle burst
//   - handleRightClick    — furnace select / block place
import { Effect, Ref } from 'effect';
import { logErrors } from '@ts-minecraft/app/frame/error-logging';
import { REDSTONE_PLACE_WIRE_KEY, REDSTONE_PLACE_LEVER_KEY, REDSTONE_PLACE_BUTTON_KEY, REDSTONE_PLACE_TORCH_KEY, REDSTONE_PLACE_PISTON_KEY, REDSTONE_TOGGLE_LEVER_KEY, REDSTONE_PRESS_BUTTON_KEY, REDSTONE_TOGGLE_TORCH_KEY, } from '@ts-minecraft/app/frame-handler.config';
import { handleHotbarInput, renderHotbarHud } from '@ts-minecraft/app/frame/stages/interaction-hotbar-handler';
import { handleRedstoneInput } from '@ts-minecraft/app/frame/stages/interaction-redstone-handler';
import { handleLeftClick, handleRightClick } from '@ts-minecraft/app/frame/stages/interaction-block-handler';
export const interactionStage = (deps, services, refs) => Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags();
    // Keep block targeting live for interactions while allowing the outline itself
    // to be toggled independently.
    yield* services.blockHighlight.update(deps.camera, deps.scene);
    yield* services.blockHighlight.setVisible(debugFlags['ui.blockHighlight']);
    // Handle block interaction (break/place) and hotbar (suppressed when paused)
    yield* logErrors(Effect.gen(function* () {
        const paused = yield* Ref.get(deps.gamePausedRef);
        if (paused)
            return;
        yield* handleHotbarInput(services);
        const leftClick = yield* services.inputService.consumeMouseClick(0);
        const rightClick = yield* services.inputService.consumeMouseClick(2);
        const [placeWire, placeLever, placeButton, placeTorch, placePiston, toggleLever, pressButton, toggleTorch,] = yield* Effect.all([
            services.inputService.consumeKeyPress(REDSTONE_PLACE_WIRE_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_LEVER_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_BUTTON_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_TORCH_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_PISTON_KEY),
            services.inputService.consumeKeyPress(REDSTONE_TOGGLE_LEVER_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PRESS_BUTTON_KEY),
            services.inputService.consumeKeyPress(REDSTONE_TOGGLE_TORCH_KEY),
        ], { concurrency: 'unbounded' });
        const flags = {
            placeWire,
            placeLever,
            placeButton,
            placeTorch,
            placePiston,
            toggleLever,
            pressButton,
            toggleTorch,
        };
        const hasRedstoneInput = placeWire || placeLever || placeButton || placeTorch || placePiston || toggleLever || pressButton || toggleTorch;
        if (leftClick || rightClick || hasRedstoneInput) {
            const targetBlock = yield* services.blockHighlight.getTargetBlock();
            const targetHit = yield* services.blockHighlight.getTargetHit();
            const selectedHotbarItem = yield* services.hotbarService.getSelectedBlockType();
            if (hasRedstoneInput) {
                yield* handleRedstoneInput(services, flags, targetBlock);
            }
            if (leftClick) {
                yield* handleLeftClick(deps, services, refs, { targetBlock, targetHit, selectedHotbarItem });
            }
            if (rightClick) {
                yield* handleRightClick(services, refs, { targetHit });
            }
        }
        // Update hotbar renderer with current slot state (first pass; second pass in hudStage)
        if (debugFlags['ui.hotbar']) {
            yield* renderHotbarHud(services);
        }
    }), 'Block interaction error');
});
//# sourceMappingURL=../../../../../dist/packages/app/application/frame/stages/interaction-stage.js.map