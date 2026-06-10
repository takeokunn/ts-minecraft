import { Cause, Effect, Match, Option, Ref } from 'effect'
import { SettingsService } from '@ts-minecraft/game'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { buildSettingsOverlayDom } from './settings-overlay-dom'

export class SettingsOverlayService extends Effect.Service<SettingsOverlayService>()(
  '@minecraft/presentation/SettingsOverlay',
  {
    scoped: Effect.all([
      SettingsService,
      DomOperationsService,
      Ref.make(false),
    ], { concurrency: 'unbounded' }).pipe(
      Effect.flatMap(([settingsService, dom, isVisibleRef]) =>
        // Build DOM once — yields const bindings, eliminates mutable let declarations
        Effect.sync(() => buildSettingsOverlayDom(dom)).pipe(
          Effect.flatMap(({
            overlayEl,
            renderDistanceInput,
            adaptivePerformanceInput,
            sensitivityInput,
            dayLengthInput,
            audioEnabledInput,
            masterVolumeInput,
            sfxVolumeInput,
            musicVolumeInput,
            qualitySelect,
            closeBtn,
            gearBtn,
          }) => {
        const updateLabel = (labelId: string, value: string): void => {
          Option.map(
            Option.flatMap(overlayEl, (el) => dom.querySelector(el, labelId)),
            (span) => { span.textContent = value },
          )
        }

        const syncInputAndLabel = (
          inputOpt: Option.Option<HTMLElement & { value: string }>,
          labelId: string,
          value: string,
        ): void => {
          Option.map(inputOpt, (input) => {
            input.value = value
            updateLabel(labelId, value)
          })
        }

        const commitEffect = (): Effect.Effect<void, never> =>
        settingsService.updateSettings({
          adaptivePerformanceMode: Option.match(adaptivePerformanceInput, { onNone: () => false, onSome: (el) => el.checked }),
          renderDistance: Option.match(renderDistanceInput, { onNone: () => 4, onSome: (el) => parseInt(el.value, 10) }),
          mouseSensitivity: Option.match(sensitivityInput, { onNone: () => 0.5, onSome: (el) => parseFloat(el.value) }),
          dayLengthSeconds: Option.match(dayLengthInput, { onNone: () => 400, onSome: (el) => parseInt(el.value, 10) }),
          audioEnabled: Option.match(audioEnabledInput, { onNone: () => false, onSome: (el) => el.checked }),
          masterVolume: Option.match(masterVolumeInput, { onNone: () => 0.8, onSome: (el) => parseFloat(el.value) }),
          sfxVolume: Option.match(sfxVolumeInput, { onNone: () => 1, onSome: (el) => parseFloat(el.value) }),
          musicVolume: Option.match(musicVolumeInput, { onNone: () => 0.55, onSome: (el) => parseFloat(el.value) }),
          graphicsQuality: Option.match(qualitySelect, {
            onNone: () => 'medium' as const,
            onSome: (el) => Match.value(el.value).pipe(
              Match.when('low', () => 'low' as const),
              Match.when('medium', () => 'medium' as const),
              Match.when('high', () => 'high' as const),
              Match.when('ultra', () => 'ultra' as const),
              Match.orElse(() => 'high' as const),
            ),
          }),
        })

      const runCommit = () => {
        Effect.runFork(
          commitEffect().pipe(
            Effect.catchAllCause(cause =>
              Effect.logError(`Settings apply error: ${Cause.pretty(cause)}`)
            )
          )
        )
      }

      function syncEffect(): Effect.Effect<void, never> {
        return settingsService.getSettings().pipe(
          Effect.flatMap((settings) => Effect.sync(() => {
            Option.map(adaptivePerformanceInput, (el) => { el.checked = settings.adaptivePerformanceMode })
            syncInputAndLabel(renderDistanceInput, '#rd-val', String(settings.renderDistance))
            syncInputAndLabel(sensitivityInput, '#ms-val', String(settings.mouseSensitivity))
            syncInputAndLabel(dayLengthInput, '#dl-val', String(settings.dayLengthSeconds))
            Option.map(audioEnabledInput, (el) => { el.checked = settings.audioEnabled })
            syncInputAndLabel(masterVolumeInput, '#mv-val', String(settings.masterVolume))
            syncInputAndLabel(sfxVolumeInput, '#sv-val', String(settings.sfxVolume))
            syncInputAndLabel(musicVolumeInput, '#muv-val', String(settings.musicVolume))
            Option.map(qualitySelect, (el) => { el.value = settings.graphicsQuality })
          }))
        )
      }

      // Named event handler functions for proper cleanup via removeEventListener
      const handleAdaptivePerformanceChange = () => {
        runCommit()
      }

      const handleRdInput = () => {
        Option.map(renderDistanceInput, (input) => updateLabel('#rd-val', input.value))
        runCommit()
      }

      const handleMsInput = () => {
        Option.map(sensitivityInput, (input) => updateLabel('#ms-val', input.value))
        runCommit()
      }

      const handleDlInput = () => {
        Option.map(dayLengthInput, (input) => updateLabel('#dl-val', input.value))
        runCommit()
      }

      const handleQualityChange = () => {
        runCommit()
      }

      const handleAudioEnabledChange = () => {
        runCommit()
      }

      const handleMasterVolumeInput = () => {
        Option.map(masterVolumeInput, (input) => updateLabel('#mv-val', input.value))
        runCommit()
      }

      const handleSfxVolumeInput = () => {
        Option.map(sfxVolumeInput, (input) => updateLabel('#sv-val', input.value))
        runCommit()
      }

      const handleMusicVolumeInput = () => {
        Option.map(musicVolumeInput, (input) => updateLabel('#muv-val', input.value))
        runCommit()
      }

      const handleClose = () => {
        Effect.runFork(
          Ref.set(isVisibleRef, false).pipe(
            Effect.andThen(Effect.sync(() => {
              Option.map(overlayEl, (el) => { el.style.display = 'none' })
            })),
            Effect.catchAllCause(() => Effect.void)
          )
        )
      }

      const handleGearClick = () => {
        Effect.runFork(
          Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current]).pipe(
            Effect.tap((next) => Effect.sync(() => {
              Option.map(overlayEl, (el) => { el.style.display = next ? 'block' : 'none' })
            })),
            Effect.flatMap((next) => next ? syncEffect() : Effect.void),
            Effect.catchAllCause(() => Effect.void)
          )
        )
      }

        return Effect.acquireRelease(
          Effect.sync(() => {
            Option.map(adaptivePerformanceInput, (el) => el.addEventListener('change', handleAdaptivePerformanceChange))
            Option.map(renderDistanceInput, (el) => el.addEventListener('input', handleRdInput))
            Option.map(sensitivityInput, (el) => el.addEventListener('input', handleMsInput))
            Option.map(dayLengthInput, (el) => el.addEventListener('input', handleDlInput))
            Option.map(audioEnabledInput, (el) => el.addEventListener('change', handleAudioEnabledChange))
            Option.map(masterVolumeInput, (el) => el.addEventListener('input', handleMasterVolumeInput))
            Option.map(sfxVolumeInput, (el) => el.addEventListener('input', handleSfxVolumeInput))
            Option.map(musicVolumeInput, (el) => el.addEventListener('input', handleMusicVolumeInput))
            Option.map(qualitySelect, (el) => el.addEventListener('change', handleQualityChange))
            Option.map(closeBtn, (el) => el.addEventListener('click', handleClose))
            Option.map(gearBtn, (el) => el.addEventListener('click', handleGearClick))
          }).pipe(
            // FR-1.4: prime DOM inputs from SettingsService on mount so values
            // reflect actual state from frame 1, eliminating the visual flash
            // (HTML template defaults quality=medium, rd=4) that appears when the
            // overlay first opens before sync runs.
            Effect.andThen(syncEffect()),
          ),
          () => Effect.sync(() => {
            Option.map(adaptivePerformanceInput, (el) => el.removeEventListener('change', handleAdaptivePerformanceChange))
            Option.map(renderDistanceInput, (el) => el.removeEventListener('input', handleRdInput))
            Option.map(sensitivityInput, (el) => el.removeEventListener('input', handleMsInput))
            Option.map(dayLengthInput, (el) => el.removeEventListener('input', handleDlInput))
            Option.map(audioEnabledInput, (el) => el.removeEventListener('change', handleAudioEnabledChange))
            Option.map(masterVolumeInput, (el) => el.removeEventListener('input', handleMasterVolumeInput))
            Option.map(sfxVolumeInput, (el) => el.removeEventListener('input', handleSfxVolumeInput))
            Option.map(musicVolumeInput, (el) => el.removeEventListener('input', handleMusicVolumeInput))
            Option.map(qualitySelect, (el) => el.removeEventListener('change', handleQualityChange))
            Option.map(closeBtn, (el) => el.removeEventListener('click', handleClose))
            Option.map(gearBtn, (el) => { el.removeEventListener('click', handleGearClick); el.remove() })
            Option.map(overlayEl, (el) => el.remove())
          })
        ).pipe(Effect.as({
        toggle: (): Effect.Effect<boolean, never> =>
          Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current]).pipe(
            Effect.tap((next) => Effect.sync(() => {
              Option.map(overlayEl, (el) => { el.style.display = next ? 'block' : 'none' })
            })),
            Effect.tap((next) => next ? syncEffect() : Effect.void),
          ),

        isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

        syncFromSettings: (): Effect.Effect<void, never> => syncEffect(),

        applyToSettings: (): Effect.Effect<void, never> => commitEffect(),
        }))
      })
        )
      )
    ),
  }
) {}
export const SettingsOverlayLive = SettingsOverlayService.Default
