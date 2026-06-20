import { Effect, MutableRef } from 'effect'
import { MAX_FOOD_LEVEL } from '@ts-minecraft/entity/application/hunger-service.config'
import type { PhysicsColumnReadError } from '../physics-stage-utils'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'

const writeHudText = (el: HTMLElement | null, value: string | number): void => {
  /* c8 ignore next */
  if (el !== null) el.textContent = String(value)
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

const getHudContainer = (el: HTMLElement | null, selector: string): HTMLElement | null => {
  if (el === null || !('closest' in el) || typeof el.closest !== 'function') return null
  return el.closest(selector) as HTMLElement | null
}

const updateIconMeter = (
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

const updateXpBar = (
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

const syncHealthHud = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const health = yield* services.healthService.getHealth()
    const lastHealth = MutableRef.get(refs.lastHealthRef)
    if (lastHealth.current !== health.current || lastHealth.max !== health.max) {
      lastHealth.current = health.current
      lastHealth.max = health.max
      yield* Effect.sync(() => {
        writeHudText(inputs.healthValueElementOrNull, health.current)
        writeHudText(inputs.healthMaxElementOrNull, health.max)
        updateIconMeter(inputs.healthValueElementOrNull, '#health-display', health.current, health.max)
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
    if (lastHunger.foodLevel !== hunger.foodLevel || lastHunger.max !== MAX_FOOD_LEVEL) {
      lastHunger.foodLevel = hunger.foodLevel
      lastHunger.max = MAX_FOOD_LEVEL
      yield* Effect.sync(() => {
        writeHudText(inputs.hungerValueElementOrNull, hunger.foodLevel)
        writeHudText(inputs.hungerMaxElementOrNull, MAX_FOOD_LEVEL)
        updateIconMeter(inputs.hungerValueElementOrNull, '#hunger-display', hunger.foodLevel, MAX_FOOD_LEVEL)
      })
    }
  })

const syncXpHud = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const xp = yield* services.xpService.getXP()
    const lastXP = MutableRef.get(refs.lastXPRef)
    if (lastXP.level !== xp.level || lastXP.xpIntoLevel !== xp.xpIntoLevel) {
      lastXP.level = xp.level
      lastXP.xpIntoLevel = xp.xpIntoLevel
      lastXP.xpRequiredForNext = xp.xpRequiredForNext
      yield* Effect.sync(() => {
        writeHudText(inputs.xpLevelElementOrNull, xp.level)
        writeHudText(inputs.xpBarElementOrNull, xp.xpIntoLevel)
        writeHudText(inputs.xpBarMaxElementOrNull, xp.xpRequiredForNext)
        updateXpBar(inputs.xpBarElementOrNull, xp.xpIntoLevel, xp.xpRequiredForNext)
      })
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
        updateIconMeter(inputs.armorValueElementOrNull, '#armor-display', armorPoints, 20)
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
  })
