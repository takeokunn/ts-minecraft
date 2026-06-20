import type { Position } from '@ts-minecraft/core'

/** Vanilla explosion powers. */
export const CREEPER_EXPLOSION_POWER = 3
export const CHARGED_CREEPER_EXPLOSION_POWER = 6
export const TNT_EXPLOSION_POWER = 4

export type ExplosionSource = 'creeper'

export type ExplosionEvent = {
  readonly source: ExplosionSource
  readonly position: Position
  readonly power: number
}
