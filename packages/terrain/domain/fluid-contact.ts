import { Option } from 'effect'
import type { FluidCell } from '@ts-minecraft/world-state'
import type { BlockType } from '@ts-minecraft/kernel'

// Lava + water contact (vanilla): the LAVA's source state alone decides the
// product — source lava → OBSIDIAN, flowing lava → COBBLESTONE. The water's
// source state is irrelevant (the previous extra `waterCell.source` branch was
// redundant: it returned COBBLESTONE exactly like the flowing-lava case below).
export const resolveContact = (lavaCell: FluidCell, waterCell: FluidCell): Option.Option<BlockType> => {
  if (lavaCell.type !== 'lava' || waterCell.type !== 'water') return Option.none()
  return Option.some(lavaCell.source ? 'OBSIDIAN' : 'COBBLESTONE')
}
