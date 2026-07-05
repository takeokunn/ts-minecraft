// Stack-count badge for hotbar slots (vanilla style): a white numeral with a
// hard dark drop shadow anchored to the slot's bottom-right corner. Hidden for
// counts of 1 — vanilla never shows a "1". Pure presentation concern, split
// from hotbar-three.ts so the renderer service stays focused on scene wiring.
import * as THREE from 'three'
import { StackCount } from '@ts-minecraft/core'
import type { HotbarSlotValue } from './hotbar-three-state'

export const COUNT_BADGE_WIDTH = 34
export const COUNT_BADGE_HEIGHT = 22
const COUNT_BADGE_CANVAS_SCALE = 2 // 2x canvas for crisp text on HiDPI
export const COUNT_BADGE_HIDDEN = 0

export type SlotCountBadge = {
  readonly mesh: THREE.Mesh
  readonly texture: THREE.CanvasTexture
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
  /** Currently drawn count; COUNT_BADGE_HIDDEN when invisible. Redraw gate. */
  shownCount: number
}

export const createSlotCountBadge = (
  slotX: number,
  slotY: number,
  slotSize: number,
): SlotCountBadge | null => {
  /* c8 ignore next -- browser runtime always provides document */
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = COUNT_BADGE_WIDTH * COUNT_BADGE_CANVAS_SCALE
  canvas.height = COUNT_BADGE_HEIGHT * COUNT_BADGE_CANVAS_SCALE
  const context = canvas.getContext('2d')
  if (context === null) return null

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(COUNT_BADGE_WIDTH, COUNT_BADGE_HEIGHT),
    material,
  )
  // Bottom-right corner of the slot cell, in front of the item tile (z 1).
  mesh.position.set(
    slotX + slotSize / 2 - COUNT_BADGE_WIDTH / 2 - 1,
    badgeAnchorY(slotY, slotSize),
    2,
  )
  mesh.visible = false

  return { mesh, texture, canvas, context, shownCount: COUNT_BADGE_HIDDEN }
}

/** Y for a badge given its slot's center Y — shared by creation and resize re-anchoring. */
export const badgeAnchorY = (slotY: number, slotSize: number): number =>
  slotY - slotSize / 2 + COUNT_BADGE_HEIGHT / 2 + 1

const redrawSlotCountBadge = (badge: SlotCountBadge, count: number): void => {
  const { canvas, context, texture } = badge
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.font = `bold ${17 * COUNT_BADGE_CANVAS_SCALE}px sans-serif`
  context.textAlign = 'right'
  context.textBaseline = 'alphabetic'
  const text = String(count)
  const x = canvas.width - 3 * COUNT_BADGE_CANVAS_SCALE
  const y = canvas.height - 4 * COUNT_BADGE_CANVAS_SCALE
  context.fillStyle = 'rgba(24, 24, 24, 0.95)'
  context.fillText(text, x + COUNT_BADGE_CANVAS_SCALE, y + COUNT_BADGE_CANVAS_SCALE)
  context.fillStyle = 'rgba(255, 255, 255, 0.98)'
  context.fillText(text, x, y)
  context.restore()
  texture.needsUpdate = true
}

/** Idempotent: redraws only when the displayed value actually changes. */
export const updateSlotCountBadge = (badge: SlotCountBadge, slotValue: HotbarSlotValue): void => {
  const count = slotValue === null ? COUNT_BADGE_HIDDEN : StackCount.toNumber(slotValue.count)
  const displayCount = count > 1 ? count : COUNT_BADGE_HIDDEN
  if (badge.shownCount === displayCount) return
  badge.shownCount = displayCount
  if (displayCount === COUNT_BADGE_HIDDEN) {
    badge.mesh.visible = false
    return
  }
  redrawSlotCountBadge(badge, displayCount)
  badge.mesh.visible = true
}
