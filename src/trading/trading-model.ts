import { Data, Schema } from 'effect'
import { BlockTypeSchema } from '@/domain/block'
import { VillagerProfessionSchema, type Villager } from '@/village/village-model'

export const TradeOfferIdSchema = Schema.String.pipe(Schema.brand('TradeOfferId'))
export type TradeOfferId = Schema.Schema.Type<typeof TradeOfferIdSchema>
export const TradeOfferId = {
  make: (value: string): TradeOfferId => Schema.decodeUnknownSync(TradeOfferIdSchema)(value),
}

export const TradeStackSchema = Schema.Struct({
  blockType: BlockTypeSchema,
  count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
})
export type TradeStack = Schema.Schema.Type<typeof TradeStackSchema>

export const TradeOfferSchema = Schema.Struct({
  offerId: TradeOfferIdSchema,
  profession: VillagerProfessionSchema,
  levelRequired: Schema.Number.pipe(Schema.int(), Schema.between(1, 5)),
  input: TradeStackSchema,
  output: TradeStackSchema,
  experienceReward: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type TradeOffer = Schema.Schema.Type<typeof TradeOfferSchema>

export const TradeFailureReasonSchema = Schema.Literal(
  'villager_not_found',
  'offer_not_found',
  'villager_level_too_low',
  'insufficient_input',
  'inventory_full',
)
export type TradeFailureReason = Schema.Schema.Type<typeof TradeFailureReasonSchema>

export class TradeSuccess extends Data.TaggedClass('TradeSuccess')<{
  readonly offer: TradeOffer
  readonly villager: Villager
  readonly levelUp: boolean
}> {}

export class TradeFailure extends Data.TaggedClass('TradeFailure')<{
  readonly reason: TradeFailureReason
}> {}

export type TradeResult = TradeSuccess | TradeFailure
