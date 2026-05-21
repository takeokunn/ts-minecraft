import { Cause, Effect, Match, Option, Ref } from 'effect';
import { SettingsService } from '@ts-minecraft/game';
import { DomOperationsService } from '@ts-minecraft/app/presentation/hud/crosshair';
import { buildSettingsOverlayDom } from './settings-overlay-dom';
export class SettingsOverlayService extends Effect.Service()('@minecraft/presentation/SettingsOverlay', {
    scoped: Effect.all([
        SettingsService,
        DomOperationsService,
        Ref.make(false),
    ], { concurrency: 'unbounded' }).pipe(Effect.flatMap(([settingsService, dom, isVisibleRef]) => 
    // Build DOM once — yields const bindings, eliminates mutable let declarations
    Effect.sync(() => buildSettingsOverlayDom(dom)).pipe(Effect.flatMap(({ overlayEl, renderDistanceInput, adaptivePerformanceInput, sensitivityInput, dayLengthInput, qualitySelect, closeBtn, gearBtn }) => {
        const updateLabel = (labelId, value) => {
            Option.map(Option.flatMap(overlayEl, (el) => dom.querySelector(el, labelId)), (span) => { span.textContent = value; });
        };
        const syncInputAndLabel = (inputOpt, labelId, value) => {
            Option.map(inputOpt, (input) => {
                input.value = value;
                updateLabel(labelId, value);
            });
        };
        const commitEffect = () => settingsService.updateSettings({
            adaptivePerformanceMode: Option.match(adaptivePerformanceInput, { onNone: () => false, onSome: (el) => el.checked }),
            renderDistance: Option.match(renderDistanceInput, { onNone: () => 4, onSome: (el) => parseInt(el.value, 10) }),
            mouseSensitivity: Option.match(sensitivityInput, { onNone: () => 0.5, onSome: (el) => parseFloat(el.value) }),
            dayLengthSeconds: Option.match(dayLengthInput, { onNone: () => 400, onSome: (el) => parseInt(el.value, 10) }),
            graphicsQuality: Option.match(qualitySelect, {
                onNone: () => 'medium',
                onSome: (el) => Match.value(el.value).pipe(Match.when('low', () => 'low'), Match.when('medium', () => 'medium'), Match.when('high', () => 'high'), Match.when('ultra', () => 'ultra'), Match.orElse(() => 'high')),
            }),
        });
        const runCommit = () => {
            Effect.runFork(commitEffect().pipe(Effect.catchAllCause(cause => Effect.logError(`Settings apply error: ${Cause.pretty(cause)}`))));
        };
        function syncEffect() {
            return settingsService.getSettings().pipe(Effect.flatMap((settings) => Effect.sync(() => {
                Option.map(adaptivePerformanceInput, (el) => { el.checked = settings.adaptivePerformanceMode; });
                syncInputAndLabel(renderDistanceInput, '#rd-val', String(settings.renderDistance));
                syncInputAndLabel(sensitivityInput, '#ms-val', String(settings.mouseSensitivity));
                syncInputAndLabel(dayLengthInput, '#dl-val', String(settings.dayLengthSeconds));
                Option.map(qualitySelect, (el) => { el.value = settings.graphicsQuality; });
            })));
        }
        // Named event handler functions for proper cleanup via removeEventListener
        const handleAdaptivePerformanceChange = () => {
            runCommit();
        };
        const handleRdInput = () => {
            Option.map(renderDistanceInput, (input) => updateLabel('#rd-val', input.value));
            runCommit();
        };
        const handleMsInput = () => {
            Option.map(sensitivityInput, (input) => updateLabel('#ms-val', input.value));
            runCommit();
        };
        const handleDlInput = () => {
            Option.map(dayLengthInput, (input) => updateLabel('#dl-val', input.value));
            runCommit();
        };
        const handleQualityChange = () => {
            runCommit();
        };
        const handleClose = () => {
            Effect.runFork(Ref.set(isVisibleRef, false).pipe(Effect.andThen(Effect.sync(() => {
                Option.map(overlayEl, (el) => { el.style.display = 'none'; });
            })), Effect.catchAllCause(() => Effect.void)));
        };
        const handleGearClick = () => {
            Effect.runFork(Ref.modify(isVisibleRef, (current) => [!current, !current]).pipe(Effect.tap((next) => Effect.sync(() => {
                Option.map(overlayEl, (el) => { el.style.display = next ? 'block' : 'none'; });
            })), Effect.flatMap((next) => next ? syncEffect() : Effect.void), Effect.catchAllCause(() => Effect.void)));
        };
        return Effect.acquireRelease(Effect.sync(() => {
            Option.map(adaptivePerformanceInput, (el) => el.addEventListener('change', handleAdaptivePerformanceChange));
            Option.map(renderDistanceInput, (el) => el.addEventListener('input', handleRdInput));
            Option.map(sensitivityInput, (el) => el.addEventListener('input', handleMsInput));
            Option.map(dayLengthInput, (el) => el.addEventListener('input', handleDlInput));
            Option.map(qualitySelect, (el) => el.addEventListener('change', handleQualityChange));
            Option.map(closeBtn, (el) => el.addEventListener('click', handleClose));
            Option.map(gearBtn, (el) => el.addEventListener('click', handleGearClick));
        }).pipe(
        // FR-1.4: prime DOM inputs from SettingsService on mount so values
        // reflect actual state from frame 1, eliminating the visual flash
        // (HTML template defaults quality=medium, rd=4) that appears when the
        // overlay first opens before sync runs.
        Effect.andThen(syncEffect())), () => Effect.sync(() => {
            Option.map(adaptivePerformanceInput, (el) => el.removeEventListener('change', handleAdaptivePerformanceChange));
            Option.map(renderDistanceInput, (el) => el.removeEventListener('input', handleRdInput));
            Option.map(sensitivityInput, (el) => el.removeEventListener('input', handleMsInput));
            Option.map(dayLengthInput, (el) => el.removeEventListener('input', handleDlInput));
            Option.map(qualitySelect, (el) => el.removeEventListener('change', handleQualityChange));
            Option.map(closeBtn, (el) => el.removeEventListener('click', handleClose));
            Option.map(gearBtn, (el) => { el.removeEventListener('click', handleGearClick); el.remove(); });
            Option.map(overlayEl, (el) => el.remove());
        })).pipe(Effect.as({
            toggle: () => Ref.modify(isVisibleRef, (current) => [!current, !current]).pipe(Effect.tap((next) => Effect.sync(() => {
                Option.map(overlayEl, (el) => { el.style.display = next ? 'block' : 'none'; });
            })), Effect.tap((next) => next ? syncEffect() : Effect.void)),
            isOpen: () => Ref.get(isVisibleRef),
            syncFromSettings: () => syncEffect(),
            applyToSettings: () => commitEffect(),
        }));
    })))),
}) {
}
export const SettingsOverlayLive = SettingsOverlayService.Default;
//# sourceMappingURL=../../../../dist/packages/app/presentation/settings/settings-overlay.js.map