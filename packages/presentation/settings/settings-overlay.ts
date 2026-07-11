import { Cause, Effect, Match, Option, Ref } from 'effect'
import { SettingsService } from '@ts-minecraft/game'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import {
  currentActiveElement,
  getActiveDocument,
  restoreFocusIfConnected,
  trapDialogFocus,
  visibleFocusableElements,
} from '../dom-focus-utils'
import { isKeyBindingNavigationKey } from './key-binding-navigation'
import { buildSettingsOverlayDom } from './settings-overlay-dom'

export class SettingsOverlayService extends Effect.Service<SettingsOverlayService>()(
  '@minecraft/presentation/SettingsOverlay',
  {
    scoped: Effect.gen(function* () {
      const settingsService = yield* SettingsService
      const dom = yield* DomOperationsService
      const isVisibleRef = yield* Ref.make(false)
      const restoreFocusRef = yield* Ref.make<Option.Option<HTMLElement>>(Option.none())
      // Build DOM once — yields const bindings, eliminates mutable let declarations
      const {
        overlayEl,
        renderDistanceInput,
        adaptivePerformanceInput,
        sensitivityInput,
        fovInput,
        dayLengthInput,
        audioEnabledInput,
        audioCaptionsInput,
        masterVolumeInput,
        sfxVolumeInput,
        musicVolumeInput,
        qualitySelect,
        difficultySelect,
        reducedMotionInput,
        uiScaleInput,
        colorVisionSelect,
        keyBindingsContainer,
        closeBtn,
        gearBtn,
      } = yield* Effect.sync(() => buildSettingsOverlayDom(dom))

      const updateLabel = (labelId: string, value: string): void => {
        const span = Option.getOrNull(Option.flatMap(overlayEl, (el) => dom.querySelector(el, labelId)))
        if (span !== null) span.textContent = value
      }

      const formatVolumePercent = (value: string): string => {
        const volume = Number.parseFloat(value)
        if (!Number.isFinite(volume)) return '0%'
        return `${Math.round(Math.min(1, Math.max(0, volume)) * 100)}%`
      }

      const setRangeValueText = (input: HTMLElement, value: string): void => {
        const setAttribute = (input as { readonly setAttribute?: (name: string, value: string) => void }).setAttribute
        if (typeof setAttribute === 'function') setAttribute.call(input, 'aria-valuetext', value)
      }

      const syncInputAndLabel = (
        inputOpt: Option.Option<HTMLElement & { value: string }>,
        labelId: string,
        value: string,
        formatLabel: (value: string) => string = (rawValue) => rawValue,
      ): void => {
        const input = Option.getOrNull(inputOpt)
        if (input !== null) {
          input.value = value
          const label = formatLabel(value)
          updateLabel(labelId, label)
          setRangeValueText(input, label)
        }
      }

      const updateInputLabel = (
        inputOpt: Option.Option<HTMLElement & { value: string }>,
        labelId: string,
        formatLabel: (value: string) => string = (rawValue) => rawValue,
      ): void => {
        const input = Option.getOrNull(inputOpt)
        if (input !== null) {
          const label = formatLabel(input.value)
          updateLabel(labelId, label)
          setRangeValueText(input, label)
        }
      }

      const commitEffect = (): Effect.Effect<void, never> =>
        settingsService.updateSettings({
          adaptivePerformanceMode: Option.getOrNull(adaptivePerformanceInput)?.checked ?? false,
          renderDistance: parseInt(Option.getOrNull(renderDistanceInput)?.value ?? '4', 10),
          mouseSensitivity: parseFloat(Option.getOrNull(sensitivityInput)?.value ?? '0.5'),
          fov: parseFloat(Option.getOrNull(fovInput)?.value ?? '75'),
          dayLengthSeconds: parseInt(Option.getOrNull(dayLengthInput)?.value ?? '400', 10),
          audioEnabled: Option.getOrNull(audioEnabledInput)?.checked ?? false,
          audioCaptionsEnabled: Option.getOrNull(audioCaptionsInput)?.checked ?? false,
          masterVolume: parseFloat(Option.getOrNull(masterVolumeInput)?.value ?? '0.8'),
          sfxVolume: parseFloat(Option.getOrNull(sfxVolumeInput)?.value ?? '1'),
          musicVolume: parseFloat(Option.getOrNull(musicVolumeInput)?.value ?? '0.55'),
          reducedMotion: Option.getOrNull(reducedMotionInput)?.checked ?? false,
          uiScale: parseFloat(Option.getOrNull(uiScaleInput)?.value ?? '1'),
          colorVisionMode: (() => {
            const val = Option.getOrNull(colorVisionSelect)?.value
            if (!val) return 'off' as const
            return Match.value(val).pipe(
              Match.when('protanopia', () => 'protanopia' as const),
              Match.when('deuteranopia', () => 'deuteranopia' as const),
              Match.when('tritanopia', () => 'tritanopia' as const),
              Match.orElse(() => 'off' as const),
            )
          })(),
          keyBindings: Object.fromEntries(keyBindingValues),
          difficulty: (() => {
            const val = Option.getOrNull(difficultySelect)?.value
            if (!val) return 'normal' as const
            return Match.value(val).pipe(
              Match.when('peaceful', () => 'peaceful' as const),
              Match.when('easy', () => 'easy' as const),
              Match.when('normal', () => 'normal' as const),
              Match.when('hard', () => 'hard' as const),
              Match.orElse(() => 'normal' as const),
            )
          })(),
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

      // Player-rebindable actions (curated core set; F-keys and hotbar digits
      // keep their defaults). Values live in this map between commits.
      const REBINDABLE_ACTIONS: ReadonlyArray<readonly [string, string]> = [
        ['MOVE_FORWARD', 'Move Forward'],
        ['MOVE_BACKWARD', 'Move Backward'],
        ['MOVE_LEFT', 'Move Left'],
        ['MOVE_RIGHT', 'Move Right'],
        ['JUMP', 'Jump'],
        ['SNEAK', 'Sneak'],
        ['SPRINT', 'Sprint'],
        ['DROP_ITEM', 'Drop Item'],
        ['INVENTORY_OPEN', 'Open Inventory'],
      ]
      const keyBindingValues = new Map<string, string>()

      const buildKeyBindingRows = (): void => {
        const container = Option.getOrNull(keyBindingsContainer)
        if (container === null || typeof container.appendChild !== 'function') return
        container.innerHTML = ''
        for (const [action, label] of REBINDABLE_ACTIONS) {
          const name = container.ownerDocument.createElement('span')
          name.textContent = label
          name.style.cssText = 'font-size:12px'
          const input = container.ownerDocument.createElement('input')
          input.type = 'text'
          input.readOnly = true
          input.dataset['action'] = action
          input.placeholder = 'default'
          // Programmatic accessible name: the visible label is a sibling <span>,
          // so a screen reader would otherwise announce this only as "edit text".
          input.setAttribute('aria-label', `Rebind ${label}`)
          input.style.cssText = 'width:110px;font-size:11px;text-align:center;cursor:pointer'
          input.value = keyBindingValues.get(action) ?? ''
          input.addEventListener('keydown', (event) => {
            if (isKeyBindingNavigationKey(event.key)) return
            event.preventDefault()
            event.stopPropagation()
            if (event.code === 'Escape' || event.code === 'Backspace') {
              keyBindingValues.delete(action)
              input.value = ''
            } else {
              keyBindingValues.set(action, event.code)
              input.value = event.code
            }
            input.blur()
            runCommit()
          })
          container.appendChild(name)
          container.appendChild(input)
        }
      }

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
            syncInputAndLabel(fovInput, '#fov-val', String(settings.fov))
            syncInputAndLabel(dayLengthInput, '#dl-val', String(settings.dayLengthSeconds))
            const aeInput = Option.getOrNull(audioEnabledInput)
            if (aeInput !== null) aeInput.checked = settings.audioEnabled
            const acInput = Option.getOrNull(audioCaptionsInput)
            if (acInput !== null) acInput.checked = settings.audioCaptionsEnabled
            syncInputAndLabel(masterVolumeInput, '#mv-val', String(settings.masterVolume), formatVolumePercent)
            syncInputAndLabel(sfxVolumeInput, '#sv-val', String(settings.sfxVolume), formatVolumePercent)
            syncInputAndLabel(musicVolumeInput, '#muv-val', String(settings.musicVolume), formatVolumePercent)
            const qSel = Option.getOrNull(qualitySelect)
            if (qSel !== null) qSel.value = settings.graphicsQuality
            const dSel = Option.getOrNull(difficultySelect)
            if (dSel !== null) dSel.value = settings.difficulty
            const rmInput = Option.getOrNull(reducedMotionInput)
            if (rmInput !== null) rmInput.checked = settings.reducedMotion
            syncInputAndLabel(uiScaleInput, '#us-val', String(settings.uiScale), formatVolumePercent)
            const cvSel = Option.getOrNull(colorVisionSelect)
            if (cvSel !== null) cvSel.value = settings.colorVisionMode
            keyBindingValues.clear()
            for (const [action, code] of Object.entries(settings.keyBindings ?? {})) keyBindingValues.set(action, code)
            buildKeyBindingRows()
          })
        })

      const documentAddKeydownListener = (): void => {
        const activeDocument = getActiveDocument()
        const addEventListener = (activeDocument as { readonly addEventListener?: unknown } | null)?.addEventListener
        if (typeof addEventListener === 'function') {
          addEventListener.call(activeDocument, 'keydown', handleDocumentKeyDown)
        }
      }

      const documentRemoveKeydownListener = (): void => {
        const activeDocument = getActiveDocument()
        const removeEventListener = (activeDocument as { readonly removeEventListener?: unknown } | null)?.removeEventListener
        if (typeof removeEventListener === 'function') {
          removeEventListener.call(activeDocument, 'keydown', handleDocumentKeyDown)
        }
      }

      const focusableSettingsControls = (): ReadonlyArray<HTMLElement> =>
        visibleFocusableElements([
          Option.getOrNull(qualitySelect),
          Option.getOrNull(adaptivePerformanceInput),
          Option.getOrNull(renderDistanceInput),
          Option.getOrNull(sensitivityInput),
          Option.getOrNull(fovInput),
          Option.getOrNull(dayLengthInput),
          Option.getOrNull(difficultySelect),
          Option.getOrNull(audioEnabledInput),
          Option.getOrNull(audioCaptionsInput),
          Option.getOrNull(masterVolumeInput),
          Option.getOrNull(sfxVolumeInput),
          Option.getOrNull(musicVolumeInput),
          Option.getOrNull(reducedMotionInput),
          Option.getOrNull(uiScaleInput),
          Option.getOrNull(colorVisionSelect),
          ...Array.from(Option.getOrNull(keyBindingsContainer)?.querySelectorAll?.('input') ?? []),
          Option.getOrNull(closeBtn),
        ])

      const focusFirstSettingsControl = (): void => {
        const first = focusableSettingsControls()[0]
        if (first !== undefined) first.focus()
      }

      const trapSettingsOverlayFocus = (event: KeyboardEvent): void => {
        trapDialogFocus(event, focusableSettingsControls(), currentActiveElement())
      }

      const captureFocusBeforeOpen = (): Effect.Effect<void, never> =>
        Ref.set(restoreFocusRef, Option.fromNullable(currentActiveElement()))

      const restoreFocusAfterClose = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const restoreFocus = yield* Ref.get(restoreFocusRef)
          yield* Ref.set(restoreFocusRef, Option.none())
          yield* Effect.sync(() => {
            restoreFocusIfConnected(Option.getOrNull(restoreFocus))
          })
        })

      const setOverlayVisible = (visible: boolean): void => {
        const el = Option.getOrNull(overlayEl)
        if (el !== null) el.style.display = visible ? 'block' : 'none'
      }

      const openOverlay = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          yield* captureFocusBeforeOpen()
          yield* Ref.set(isVisibleRef, true)
          yield* Effect.sync(() => {
            setOverlayVisible(true)
            documentAddKeydownListener()
          })
          yield* syncEffect()
          yield* Effect.sync(focusFirstSettingsControl)
        })

      const closeOverlay = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          yield* Ref.set(isVisibleRef, false)
          yield* Effect.sync(() => {
            setOverlayVisible(false)
            documentRemoveKeydownListener()
          })
          yield* restoreFocusAfterClose()
        })

      const handleDocumentKeyDown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          Effect.runSync(closeOverlay())
          return
        }
        if (event.key === 'Tab') {
          trapSettingsOverlayFocus(event)
        }
      }

      // Named event handler functions for proper cleanup via removeEventListener
      const handleAdaptivePerformanceChange = () => {
        runCommit()
      }

      const handleRdInput = () => {
        updateInputLabel(renderDistanceInput, '#rd-val')
        runCommit()
      }

      const handleMsInput = () => {
        updateInputLabel(sensitivityInput, '#ms-val')
        runCommit()
      }

      const handleFovInput = () => {
        updateInputLabel(fovInput, '#fov-val')
        runCommit()
      }

      const handleUiScaleInput = () => {
        updateInputLabel(uiScaleInput, '#us-val', formatVolumePercent)
        runCommit()
      }

      const handleDlInput = () => {
        updateInputLabel(dayLengthInput, '#dl-val')
        runCommit()
      }

      const handleQualityChange = () => {
        runCommit()
      }

      const handleAudioEnabledChange = () => {
        runCommit()
      }

      const handleMasterVolumeInput = () => {
        updateInputLabel(masterVolumeInput, '#mv-val', formatVolumePercent)
        runCommit()
      }

      const handleSfxVolumeInput = () => {
        updateInputLabel(sfxVolumeInput, '#sv-val', formatVolumePercent)
        runCommit()
      }

      const handleMusicVolumeInput = () => {
        updateInputLabel(musicVolumeInput, '#muv-val', formatVolumePercent)
        runCommit()
      }

      const handleClose = () => {
        Effect.runSync(closeOverlay())
      }

      const handleGearClick = () => {
        Effect.runFork(
          Effect.gen(function* () {
            const isVisible = yield* Ref.get(isVisibleRef)
            if (isVisible) yield* closeOverlay()
            else yield* openOverlay()
          }).pipe(Effect.catchAllCause(() => Effect.void))
        )
      }

      // Register event listeners + prime DOM inputs from SettingsService on mount (FR-1.4)
      yield* Effect.sync(() => {
        Option.getOrNull(adaptivePerformanceInput)?.addEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(difficultySelect)?.addEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(reducedMotionInput)?.addEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(colorVisionSelect)?.addEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(uiScaleInput)?.addEventListener('input', handleUiScaleInput)
        Option.getOrNull(renderDistanceInput)?.addEventListener('input', handleRdInput)
        Option.getOrNull(sensitivityInput)?.addEventListener('input', handleMsInput)
        Option.getOrNull(fovInput)?.addEventListener('input', handleFovInput)
        Option.getOrNull(dayLengthInput)?.addEventListener('input', handleDlInput)
        Option.getOrNull(audioEnabledInput)?.addEventListener('change', handleAudioEnabledChange)
        Option.getOrNull(audioCaptionsInput)?.addEventListener('change', handleAdaptivePerformanceChange)
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
        documentRemoveKeydownListener()
        Option.getOrNull(adaptivePerformanceInput)?.removeEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(difficultySelect)?.removeEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(reducedMotionInput)?.removeEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(colorVisionSelect)?.removeEventListener('change', handleAdaptivePerformanceChange)
        Option.getOrNull(uiScaleInput)?.removeEventListener('input', handleUiScaleInput)
        Option.getOrNull(renderDistanceInput)?.removeEventListener('input', handleRdInput)
        Option.getOrNull(sensitivityInput)?.removeEventListener('input', handleMsInput)
        Option.getOrNull(fovInput)?.removeEventListener('input', handleFovInput)
        Option.getOrNull(dayLengthInput)?.removeEventListener('input', handleDlInput)
        Option.getOrNull(audioEnabledInput)?.removeEventListener('change', handleAudioEnabledChange)
        Option.getOrNull(audioCaptionsInput)?.removeEventListener('change', handleAdaptivePerformanceChange)
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
            const isVisible = yield* Ref.get(isVisibleRef)
            if (isVisible) {
              yield* closeOverlay()
              return false
            }
            yield* openOverlay()
            return true
          }),

        isOpen: (): Effect.Effect<boolean, never> => Ref.get(isVisibleRef),

        syncFromSettings: (): Effect.Effect<void, never> => syncEffect(),

        applyToSettings: (): Effect.Effect<void, never> => commitEffect(),
      }
    }),
  }
) {}
