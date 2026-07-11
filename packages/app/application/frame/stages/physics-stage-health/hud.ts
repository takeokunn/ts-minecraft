import { Effect, MutableRef } from 'effect'
import { MAX_FOOD_LEVEL } from '@ts-minecraft/entity/application/hunger-service.config'
import { MAX_ARMOR_POINTS } from '@ts-minecraft/entity/domain/combat.config'
import { toStatusEffectHudEntry, type ActiveStatusEffect } from '@ts-minecraft/entity/domain/status-effect'
import type { PhysicsColumnReadError } from '../physics-stage-utils'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'

export const writeHudText = (el: HTMLElement | null, value: string | number): void => {
  /* c8 ignore next */
  if (el !== null) el.textContent = String(value)
}

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

export const getHudContainer = (el: HTMLElement | null, selector: string): HTMLElement | null => {
  if (el === null || !('closest' in el) || typeof el.closest !== 'function') return null
  return el.closest(selector) as HTMLElement | null
}

export type VitalHudState = 'normal' | 'warning' | 'critical'

export const getVitalHudState = (value: number, max: number): VitalHudState => {
  const ratio = max > 0 ? clamp(value / max, 0, 1) : 0
  if (ratio <= 0.25) return 'critical'
  if (ratio <= 0.5) return 'warning'
  return 'normal'
}

export const updateVitalMeterAccessibility = (
  valueElement: HTMLElement | null,
  containerSelector: string,
  value: number,
  max: number,
): void => {
  const container = getHudContainer(valueElement, containerSelector)
  if (container === null || max <= 0) return

  const clamped = clamp(value, 0, max)
  const state = getVitalHudState(clamped, max)
  container.setAttribute('data-state', state)
  container.setAttribute('role', 'meter')
  container.setAttribute('aria-valuemin', '0')
  container.setAttribute('aria-valuemax', String(max))
  container.setAttribute('aria-valuenow', String(clamped))
  container.setAttribute('aria-valuetext', `${clamped} of ${max}, ${state}`)
}

export const updateIconMeter = (
  valueElement: HTMLElement | null,
  containerSelector: string,
  value: number,
  max: number,
): void => {
  const container = getHudContainer(valueElement, containerSelector)
  if (container === null || !('querySelectorAll' in container)) return

  const icons = container.querySelectorAll<HTMLElement>('[data-hud-icon]')
  if (icons.length === 0 || max <= 0) return

  const clamped = clamp(value, 0, max)
  const pointsPerIcon = max / icons.length
  for (let i = 0; i < icons.length; i += 1) {
    const remaining = clamped - i * pointsPerIcon
    const fill = remaining >= pointsPerIcon ? 'full' : remaining > 0 ? 'half' : 'empty'
    icons[i]?.setAttribute('data-fill', fill)
  }
}

export const updateXpBar = (
  xpBarElement: HTMLElement | null,
  xpIntoLevel: number,
  xpRequiredForNext: number,
): void => {
  const container = getHudContainer(xpBarElement, '#xp-display')
  if (container === null || !('querySelector' in container)) return

  const fillElement = container.querySelector<HTMLElement>('#xp-progress-fill')
  if (fillElement === null) return

  const ratio = xpRequiredForNext > 0 ? clamp(xpIntoLevel / xpRequiredForNext, 0, 1) : 0
  fillElement.style.width = `${Math.round(ratio * 1000) / 10}%`
}

// Golden absorption hearts (2 HP each) rendered above the health row; the
// row hides entirely at 0 so the HUD carries no dead chrome without the effect.
export const renderAbsorptionHearts = (container: HTMLElement | null, absorption: number): void => {
  if (container === null || !('replaceChildren' in container)) return
  const hearts = Math.max(0, Math.ceil(absorption / 2))
  if (hearts === 0) {
    container.replaceChildren()
    container.setAttribute('hidden', '')
    return
  }
  const doc = container.ownerDocument
  container.removeAttribute('hidden')
  container.replaceChildren(
    ...Array.from({ length: hearts }, (_, i) => {
      const icon = doc.createElement('span')
      icon.className = 'hud-meter-icon'
      icon.setAttribute('data-hud-icon', '')
      // Odd pools show their trailing 1 HP as a half heart (vanilla).
      icon.setAttribute('data-fill', absorption - i * 2 >= 2 ? 'full' : 'half')
      return icon
    }),
  )
}

// The absorption row is a sibling of #health-display, not an ancestor of the
// health value element — resolve it through the document instead of closest().
const getAbsorptionContainer = (healthValueElement: HTMLElement | null): HTMLElement | null => {
  if (healthValueElement === null || !('ownerDocument' in healthValueElement)) return null
  const doc = healthValueElement.ownerDocument
  /* c8 ignore next */
  if (doc === null || typeof doc.getElementById !== 'function') return null
  return doc.getElementById('absorption-display')
}

const syncHealthHud = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const health = yield* services.healthService.getHealth()
    const absorption = yield* services.healthService.getAbsorption()
    const lastHealth = MutableRef.get(refs.lastHealthRef)
    if (
      lastHealth.current !== health.current
      || lastHealth.max !== health.max
      || lastHealth.absorption !== absorption
    ) {
      lastHealth.current = health.current
      lastHealth.max = health.max
      lastHealth.absorption = absorption
      yield* Effect.sync(() => {
        writeHudText(inputs.healthValueElementOrNull, health.current)
        writeHudText(inputs.healthMaxElementOrNull, health.max)
        updateIconMeter(inputs.healthValueElementOrNull, '#health-display', health.current, health.max)
        updateVitalMeterAccessibility(inputs.healthValueElementOrNull, '#health-display', health.current, health.max)
        renderAbsorptionHearts(getAbsorptionContainer(inputs.healthValueElementOrNull), absorption)
      })
    }
  })

const syncHungerHud = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const hunger = yield* services.hungerService.getHunger()
    const lastHunger = MutableRef.get(refs.lastHungerRef)
    if (lastHunger.foodLevel !== hunger.foodLevel) {
      lastHunger.foodLevel = hunger.foodLevel
      yield* Effect.sync(() => {
        writeHudText(inputs.hungerValueElementOrNull, hunger.foodLevel)
        writeHudText(inputs.hungerMaxElementOrNull, MAX_FOOD_LEVEL)
        updateIconMeter(inputs.hungerValueElementOrNull, '#hunger-display', hunger.foodLevel, MAX_FOOD_LEVEL)
        updateVitalMeterAccessibility(inputs.hungerValueElementOrNull, '#hunger-display', hunger.foodLevel, MAX_FOOD_LEVEL)
      })
    }
  })

// Replay the level-number pop animation (class re-add needs a reflow between
// remove and add, or the browser coalesces the two and the animation never restarts).
export const triggerXpLevelPop = (el: HTMLElement | null): void => {
  if (el === null || !('classList' in el)) return
  el.classList.remove('xp-level-up')
  void el.offsetWidth
  el.classList.add('xp-level-up')
}

const syncXpHud = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const xp = yield* services.xpService.getXP()
    const lastXP = MutableRef.get(refs.lastXPRef)
    if (lastXP.level !== xp.level || lastXP.xpIntoLevel !== xp.xpIntoLevel) {
      // lastXP.level starts at the -1 sentinel, so the first sync after loading a
      // save must not read as a level-up; only genuine in-session gains celebrate.
      const leveledUp = lastXP.level >= 0 && xp.level > lastXP.level
      lastXP.level = xp.level
      lastXP.xpIntoLevel = xp.xpIntoLevel
      lastXP.xpRequiredForNext = xp.xpRequiredForNext
      yield* Effect.sync(() => {
        writeHudText(inputs.xpLevelElementOrNull, xp.level)
        writeHudText(inputs.xpBarElementOrNull, xp.xpIntoLevel)
        writeHudText(inputs.xpBarMaxElementOrNull, xp.xpRequiredForNext)
        updateXpBar(inputs.xpBarElementOrNull, xp.xpIntoLevel, xp.xpRequiredForNext)
      })
      if (leveledUp) {
        yield* services.soundManager.playEffect('levelUp')
        yield* Effect.sync(() => triggerXpLevelPop(inputs.xpLevelElementOrNull))
      }
    }
  })

// Second-granular render signature: re-render only when an effect appears,
// expires, changes level, or its displayed (whole-second) countdown ticks.
export const statusEffectsSignature = (effects: ReadonlyArray<ActiveStatusEffect>): string =>
  effects
    .map((effect) => `${effect.type}:${effect.amplifier}:${Math.ceil(effect.remainingTicks / 20)}`)
    .join('|')

export const renderStatusEffectChips = (
  container: HTMLElement | null,
  effects: ReadonlyArray<ActiveStatusEffect>,
): void => {
  if (container === null || !('replaceChildren' in container)) return
  const doc = container.ownerDocument
  container.replaceChildren(
    ...effects.map((effect) => {
      const entry = toStatusEffectHudEntry(effect)
      const chip = doc.createElement('div')
      chip.className = 'effect-chip'
      chip.setAttribute('data-effect', entry.type)
      chip.textContent = entry.display
      return chip
    }),
  )
}

const syncEffectsHud = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const effects = yield* services.healthService.getStatusEffects()
    const signature = statusEffectsSignature(effects)
    const lastEffects = MutableRef.get(refs.lastEffectsRef)
    if (lastEffects.signature !== signature) {
      lastEffects.signature = signature
      yield* Effect.sync(() => renderStatusEffectChips(inputs.effectsElementOrNull, effects))
    }
  })

const syncArmorHud = (
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  armorPoints: number,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const lastArmor = MutableRef.get(refs.lastArmorRef)
    if (lastArmor.armorPoints !== armorPoints) {
      lastArmor.armorPoints = armorPoints
      yield* Effect.sync(() => {
        writeHudText(inputs.armorValueElementOrNull, armorPoints)
        updateIconMeter(inputs.armorValueElementOrNull, '#armor-display', armorPoints, MAX_ARMOR_POINTS)
      })
    }
  })
export const updateHud = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  armorPoints: number,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    yield* syncHealthHud(services, refs, inputs)
    yield* syncHungerHud(services, refs, inputs)
    yield* syncXpHud(services, refs, inputs)
    yield* syncArmorHud(refs, inputs, armorPoints)
    yield* syncEffectsHud(services, refs, inputs)
  })
