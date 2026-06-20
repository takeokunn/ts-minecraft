import { TradeOfferId } from '@ts-minecraft/entity/domain/trading/trading-model';
import { VillagerProfession } from '@ts-minecraft/entity/domain/village/village-model';
import type { TradeOffer } from '@ts-minecraft/entity/domain/trading/trading-model';
import type { VillagerProfession as VillagerProfessionT } from '@ts-minecraft/entity/domain/village/village-model';
import type { InventoryItem } from '@ts-minecraft/core'

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
