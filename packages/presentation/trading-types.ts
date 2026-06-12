import { Option } from 'effect'
import type { TradeOffer } from '@ts-minecraft/entity'
import type { VillagerId } from '@ts-minecraft/entity'

export type TradingUiState = {
  readonly villagerId: VillagerId
  readonly offers: ReadonlyArray<TradeOffer>
  readonly selectedIndex: number
}

export type TradingElements = {
  readonly overlay: Option.Option<HTMLDivElement>
  readonly title: Option.Option<HTMLDivElement>
  readonly currency: Option.Option<HTMLDivElement>
  readonly list: Option.Option<HTMLDivElement>
  readonly status: Option.Option<HTMLDivElement>
}
