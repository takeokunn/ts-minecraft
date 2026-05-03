import { Option } from 'effect'
import type { FluidCell } from '@ts-minecraft/world-state'
import type { BlockType } from '@ts-minecraft/kernel'

// Flowing lava + any water → COBBLESTONE; lava source + any water → OBSIDIAN.
export const resolveContact = (lavaCell: FluidCell, waterCell: FluidCell): Option.Option<BlockType> => {
  if (lavaCell.type !== 'lava' || waterCell.type !== 'water') return Option.none()
  if (!lavaCell.source && waterCell.source) return Option.some('COBBLESTONE')
  if (!lavaCell.source) return Option.some('COBBLESTONE')
  return Option.some('OBSIDIAN')
}
