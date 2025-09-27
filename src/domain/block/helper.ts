import type { BlockPhysics, BlockSound } from './types'

export const createDefaultPhysics = (): BlockPhysics => ({
  hardness: 1.0,
  resistance: 1.0,
  luminance: 0,
  opacity: 15,
  flammable: false,
  gravity: false,
  solid: true,
  replaceable: false,
  waterloggable: false,
})

export const createDefaultSound = (): BlockSound => ({
  break: 'block.stone.break',
  place: 'block.stone.place',
  step: 'block.stone.step',
})
