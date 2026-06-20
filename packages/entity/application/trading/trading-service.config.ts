import type { TradeOffer } from '../../domain/trading/trading-model'
import { TradeOfferId } from '../../domain/trading/trading-model'
import { VillagerProfession } from '../../domain/village/village-model'
import type { InventoryItem } from '@ts-minecraft/core'

export const TRADE_CURRENCY_BLOCK: InventoryItem = 'EMERALD'

export const TRADE_OFFERS: ReadonlyArray<TradeOffer> = [
  {
    offerId: TradeOfferId.make('farmer:grass-bundle'),
    profession: VillagerProfession.Farmer,
    levelRequired: 1,
    input: { itemType: TRADE_CURRENCY_BLOCK, count: 1 },
    output: { itemType: 'GRASS', count: 4 },
    experienceReward: 3,
  },
  {
    offerId: TradeOfferId.make('farmer:sand-bundle'),
    profession: VillagerProfession.Farmer,
    levelRequired: 2,
    input: { itemType: TRADE_CURRENCY_BLOCK, count: 2 },
    output: { itemType: 'SAND', count: 6 },
    experienceReward: 4,
  },
  {
    offerId: TradeOfferId.make('librarian:wood-bundle'),
    profession: VillagerProfession.Librarian,
    levelRequired: 1,
    input: { itemType: TRADE_CURRENCY_BLOCK, count: 1 },
    output: { itemType: 'WOOD', count: 3 },
    experienceReward: 3,
  },
  {
    offerId: TradeOfferId.make('librarian:glass-bundle'),
    profession: VillagerProfession.Librarian,
    levelRequired: 2,
    input: { itemType: TRADE_CURRENCY_BLOCK, count: 2 },
    output: { itemType: 'GLASS', count: 3 },
    experienceReward: 4,
  },
  {
    offerId: TradeOfferId.make('blacksmith:stone-bundle'),
    profession: VillagerProfession.Blacksmith,
    levelRequired: 1,
    input: { itemType: TRADE_CURRENCY_BLOCK, count: 1 },
    output: { itemType: 'STONE', count: 4 },
    experienceReward: 3,
  },
  {
    offerId: TradeOfferId.make('blacksmith:cobblestone-bundle'),
    profession: VillagerProfession.Blacksmith,
    levelRequired: 2,
    input: { itemType: TRADE_CURRENCY_BLOCK, count: 2 },
    output: { itemType: 'COBBLESTONE', count: 5 },
    experienceReward: 4,
  },
]
