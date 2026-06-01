import { RedstoneComponentType } from '@ts-minecraft/entity'
import type { RedstoneComponent, RedstoneComponentType as RedstoneComponentTypeT } from '@ts-minecraft/entity'
import type { Position } from '@ts-minecraft/core'

type RedstoneComponentOverrides = Partial<{
  state: Partial<RedstoneComponent['state']>
}>

/**
 * Returns a valid RedstoneComponent with sensible default state.
 * Torches default to active=true (matching makeDefaultState); all others default to inactive.
 */
export const makeTestRedstoneComponent = (
  type: RedstoneComponentTypeT,
  pos: { x: number; y: number; z: number },
  overrides: RedstoneComponentOverrides = {},
): RedstoneComponent => ({
  type,
  position: pos as Position,
  state: {
    active: type === RedstoneComponentType.Torch,
    buttonTicksRemaining: 0,
    pistonExtended: false,
    ...overrides.state,
  },
})
