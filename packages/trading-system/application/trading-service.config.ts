import type { TradeOffer } from '../domain/trading-model'
import { TradeOfferId } from '../domain/trading-model'
import { VillagerProfession } from '@ts-minecraft/village-system'
import type { BlockType } from '@ts-minecraft/domain'

export const TRADE_CURRENCY_BLOCK: BlockType = 'GRAVEL'

export const TRADE_OFFERS: ReadonlyArray<TradeOffer> = [
  {
    offerId: TradeOfferId.make('farmer:grass-bundle'),
    profession: VillagerProfession.Farmer,
    levelRequired: 1,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 1 },
    output: { blockType: 'GRASS', count: 4 },
    experienceReward: 3,
  },
  {
    offerId: TradeOfferId.make('farmer:sand-bundle'),
    profession: VillagerProfession.Farmer,
    levelRequired: 2,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 2 },
    output: { blockType: 'SAND', count: 6 },
    experienceReward: 4,
  },
  {
    offerId: TradeOfferId.make('librarian:wood-bundle'),
    profession: VillagerProfession.Librarian,
    levelRequired: 1,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 1 },
    output: { blockType: 'WOOD', count: 3 },
    experienceReward: 3,
  },
  {
    offerId: TradeOfferId.make('librarian:glass-bundle'),
    profession: VillagerProfession.Librarian,
    levelRequired: 2,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 2 },
    output: { blockType: 'GLASS', count: 3 },
    experienceReward: 4,
  },
  {
    offerId: TradeOfferId.make('blacksmith:stone-bundle'),
    profession: VillagerProfession.Blacksmith,
    levelRequired: 1,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 1 },
    output: { blockType: 'STONE', count: 4 },
    experienceReward: 3,
  },
  {
    offerId: TradeOfferId.make('blacksmith:cobblestone-bundle'),
    profession: VillagerProfession.Blacksmith,
    levelRequired: 2,
    input: { blockType: TRADE_CURRENCY_BLOCK, count: 2 },
    output: { blockType: 'COBBLESTONE', count: 5 },
    experienceReward: 4,
  },
]
