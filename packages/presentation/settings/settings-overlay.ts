import { Cause, Effect, Match, Option, Ref } from 'effect'
import { SettingsService } from '@ts-minecraft/game'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import { buildSettingsOverlayDom } from './settings-overlay-dom'

export class SettingsOverlayService extends Effect.Service<SettingsOverlayService>()(
  '@minecraft/presentation/SettingsOverlay',
  {
    scoped: Effect.gen(function* () {
      const settingsService = yield* SettingsService
      const dom = yield* DomOperationsService
      const isVisibleRef = yield* Ref.make(false)
      // Build DOM once — yields const bindings, eliminates mutable let declarations
      const {
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
      } = yield* Effect.sync(() => buildSettingsOverlayDom(dom))

      const updateLabel = (labelId: string, value: string): void => {
        const span = Option.getOrNull(Option.flatMap(overlayEl, (el) => dom.querySelector(el, labelId)))
        if (span !== null) span.textContent = value
      }

      const syncInputAndLabel = (
        inputOpt: Option.Option<HTMLElement & { value: string }>,
        labelId: string,
        value: string,
      ): void => {
        const input = Option.getOrNull(inputOpt)
        if (input !== null) {
          input.value = value
          updateLabel(labelId, value)
        }
      }

      const commitEffect = (): Effect.Effect<void, never> =>
        settingsService.updateSettings({
          adaptivePerformanceMode: Option.getOrNull(adaptivePerformanceInput)?.checked ?? false,
          renderDistance: parseInt(Option.getOrNull(renderDistanceInput)?.value ?? '4', 10),
          mouseSensitivity: parseFloat(Option.getOrNull(sensitivityInput)?.value ?? '0.5'),
          dayLengthSeconds: parseInt(Option.getOrNull(dayLengthInput)?.value ?? '400', 10),
          audioEnabled: Option.getOrNull(audioEnabledInput)?.checked ?? false,
          masterVolume: parseFloat(Option.getOrNull(masterVolumeInput)?.value ?? '0.8'),
          sfxVolume: parseFloat(Option.getOrNull(sfxVolumeInput)?.value ?? '1'),
          musicVolume: parseFloat(Option.getOrNull(musicVolumeInput)?.value ?? '0.55'),
          graphicsQuality: (() => {
            const val = Option.getOrNull(qualitySelect)?.value
            if (!val) return 'medium' as const
            return Match.value(val).pipe(
              Match.when('low', () => 'low' as const),
              Match.when('medium', () => 'medium' as const),
              Match.when('high', () => 'high' as const),
              Match.when('ultra', () => 'ultra' as const),
              Match.orElse(() => 'high' as const),
            )
          })(),
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

      const syncEffect = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const settings = yield* settingsService.getSettings()
          yield* Effect.sync(() => {
            const apInput = Option.getOrNull(adaptivePerformanceInput)
            if (apInput !== null) apInput.checked = settings.adaptivePerformanceMode
            syncInputAndLabel(renderDistanceInput, '#rd-val', String(settings.renderDistance))
            syncInputAndLabel(sensitivityInput, '#ms-val', String(settings.mouseSensitivity))
            syncInputAndLabel(dayLengthInput, '#dl-val', String(settings.dayLengthSeconds))
            const aeInput = Option.getOrNull(audioEnabledInput)
            if (aeInput !== null) aeInput.checked = settings.audioEnabled
            syncInputAndLabel(masterVolumeInput, '#mv-val', String(settings.masterVolume))
            syncInputAndLabel(sfxVolumeInput, '#sv-val', String(settings.sfxVolume))
            syncInputAndLabel(musicVolumeInput, '#muv-val', String(settings.musicVolume))
            const qSel = Option.getOrNull(qualitySelect)
            if (qSel !== null) qSel.value = settings.graphicsQuality
          })
        })

      // Named event handler functions for proper cleanup via removeEventListener
      const handleAdaptivePerformanceChange = () => {
        runCommit()
      }

      const handleRdInput = () => {
        const input = Option.getOrNull(renderDistanceInput)
        if (input !== null) updateLabel('#rd-val', input.value)
        runCommit()
      }

      const handleMsInput = () => {
        const input = Option.getOrNull(sensitivityInput)
        if (input !== null) updateLabel('#ms-val', input.value)
        runCommit()
      }

      const handleDlInput = () => {
        const input = Option.getOrNull(dayLengthInput)
        if (input !== null) updateLabel('#dl-val', input.value)
        runCommit()
      }

      const handleQualityChange = () => {
        runCommit()
      }

      const handleAudioEnabledChange = () => {
        runCommit()
      }

      const handleMasterVolumeInput = () => {
        const input = Option.getOrNull(masterVolumeInput)
        if (input !== null) updateLabel('#mv-val', input.value)
        runCommit()
      }

      const handleSfxVolumeInput = () => {
        const input = Option.getOrNull(sfxVolumeInput)
        if (input !== null) updateLabel('#sv-val', input.value)
        runCommit()
      }

      const handleMusicVolumeInput = () => {
        const input = Option.getOrNull(musicVolumeInput)
        if (input !== null) updateLabel('#muv-val', input.value)
        runCommit()
      }

      const handleClose = () => {
        Effect.runFork(
          Effect.gen(function* () {
            yield* Ref.set(isVisibleRef, false)
            yield* Effect.sync(() => {
              const el = Option.getOrNull(overlayEl)
              if (el !== null) el.style.display = 'none'
            })
          }).pipe(Effect.catchAllCause(() => Effect.void))
        )
      }

      const handleGearClick = () => {
        Effect.runFork(
          Effect.gen(function* () {
            const next = yield* Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current])
            yield* Effect.sync(() => {
              const el = Option.getOrNull(overlayEl)
              if (el !== null) el.style.display = next ? 'block' : 'none'
            })
            if (next) yield* syncEffect()
          }).pipe(Effect.catchAllCause(() => Effect.void))
        )
      }

      // Register event listeners + prime DOM inputs from SettingsService on mount (FR-1.4)
      yield* Effect.sync(() => {
        Option.getOrNull(adaptivePerformanceInput)?.addEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(renderDistanceInput)?.addEventListener('input', handleRdInput)
        Option.getOrNull(sensitivityInput)?.addEventListener('input', handleMsInput)
        Option.getOrNull(dayLengthInput)?.addEventListener('input', handleDlInput)
        Option.getOrNull(audioEnabledInput)?.addEventListener('change', handleAudioEnabledChange)
        Option.getOrNull(masterVolumeInput)?.addEventListener('input', handleMasterVolumeInput)
        Option.getOrNull(sfxVolumeInput)?.addEventListener('input', handleSfxVolumeInput)
        Option.getOrNull(musicVolumeInput)?.addEventListener('input', handleMusicVolumeInput)
        Option.getOrNull(qualitySelect)?.addEventListener('change', handleQualityChange)
        Option.getOrNull(closeBtn)?.addEventListener('click', handleClose)
        Option.getOrNull(gearBtn)?.addEventListener('click', handleGearClick)
      })
      yield* syncEffect()

      // Cleanup event listeners + DOM on scope close
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        Option.getOrNull(adaptivePerformanceInput)?.removeEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(renderDistanceInput)?.removeEventListener('input', handleRdInput)
        Option.getOrNull(sensitivityInput)?.removeEventListener('input', handleMsInput)
        Option.getOrNull(dayLengthInput)?.removeEventListener('input', handleDlInput)
        Option.getOrNull(audioEnabledInput)?.removeEventListener('change', handleAudioEnabledChange)
        Option.getOrNull(masterVolumeInput)?.removeEventListener('input', handleMasterVolumeInput)
        Option.getOrNull(sfxVolumeInput)?.removeEventListener('input', handleSfxVolumeInput)
        Option.getOrNull(musicVolumeInput)?.removeEventListener('input', handleMusicVolumeInput)
        Option.getOrNull(qualitySelect)?.removeEventListener('change', handleQualityChange)
        Option.getOrNull(closeBtn)?.removeEventListener('click', handleClose)
        const gear = Option.getOrNull(gearBtn)
        if (gear !== null) { gear.removeEventListener('click', handleGearClick); gear.remove() }
        Option.getOrNull(overlayEl)?.remove()
      }))

      return {
        toggle: (): Effect.Effect<boolean, never> =>
          Effect.gen(function* () {
            const next = yield* Ref.modify(isVisibleRef, (current): [boolean, boolean] => [!current, !current])
            yield* Effect.sync(() => {
              const el = Option.getOrNull(overlayEl)
              if (el !== null) el.style.display = next ? 'block' : 'none'
            })
            if (next) yield* syncEffect()
            return next
          }),

        isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

        syncFromSettings: (): Effect.Effect<void, never> => syncEffect(),

        applyToSettings: (): Effect.Effect<void, never> => commitEffect(),
      }
    }),
  }
) {}
export const SettingsOverlayLive = SettingsOverlayService.Default
