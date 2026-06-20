import { Option } from 'effect'

import type { ArmorSlot } from '../domain/armor.config'
import type { ItemStack } from '../domain/item-stack'

export type EquipmentSlots = {
  readonly [slot in ArmorSlot]: Option.Option<ItemStack>
}
