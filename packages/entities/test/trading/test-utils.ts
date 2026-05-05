import { TradeOfferId, VillagerProfession } from '@ts-minecraft/entities'
import type { TradeOffer, VillagerProfession as VillagerProfessionT } from '@ts-minecraft/entities'
import type { InventoryItem } from '@ts-minecraft/kernel'

type TradeOfferOverrides = Partial<{
  offerId: TradeOffer['offerId']
  profession: VillagerProfessionT
  levelRequired: number
  input: TradeOffer['input']
  output: TradeOffer['output']
  experienceReward: number
}>

/**
 * Returns a valid TradeOffer with sensible defaults.
 */
export const makeTestTradeOffer = (overrides: TradeOfferOverrides = {}): TradeOffer => ({
  offerId: overrides.offerId ?? TradeOfferId.make('test-offer:wheat-bundle'),
  profession: overrides.profession ?? VillagerProfession.Farmer,
  levelRequired: overrides.levelRequired ?? 1,
  input: overrides.input ?? { itemType: 'GRAVEL' as InventoryItem, count: 1 },
  output: overrides.output ?? { itemType: 'WHEAT' as InventoryItem, count: 4 },
  experienceReward: overrides.experienceReward ?? 2,
})
