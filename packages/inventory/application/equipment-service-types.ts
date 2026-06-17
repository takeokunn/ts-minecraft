import { Option } from 'effect'

import type { ArmorSlot } from '../domain/armor'
import type { ItemStack } from '../domain/item-stack'

export type EquipmentSlots = {
  readonly [slot in ArmorSlot]: Option.Option<ItemStack>
}
