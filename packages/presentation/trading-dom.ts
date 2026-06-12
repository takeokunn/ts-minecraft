import { Option } from 'effect'
import { DomOperationsService } from '@ts-minecraft/presentation/hud/crosshair'
import {
  OVERLAY_STYLES,
  TITLE_STYLES,
  CURRENCY_STYLES,
  LIST_STYLES,
  STATUS_STYLES,
  STATUS_HINT_TEXT,
} from './trading-styles'
import type { TradingElements } from './trading-types'

export const buildTradingDom = (dom: DomOperationsService): TradingElements => {
  if (typeof document === 'undefined') {
    return {
      overlay: Option.none(),
      title: Option.none(),
      currency: Option.none(),
      list: Option.none(),
      status: Option.none(),
    }
  }

  const overlay = dom.createElement('div')
  overlay.id = 'trading-overlay'
  overlay.style.cssText = OVERLAY_STYLES

  const title = dom.createElement('div')
  title.id = 'trading-title'
  title.style.cssText = TITLE_STYLES
  title.textContent = 'Trading'

  const currency = dom.createElement('div')
  currency.id = 'trading-currency'
  currency.style.cssText = CURRENCY_STYLES

  const list = dom.createElement('div')
  list.id = 'trading-list'
  list.style.cssText = LIST_STYLES

  const status = dom.createElement('div')
  status.id = 'trading-status'
  status.style.cssText = STATUS_STYLES
  status.textContent = STATUS_HINT_TEXT

  dom.appendChildTo(overlay, title)
  dom.appendChildTo(overlay, currency)
  dom.appendChildTo(overlay, list)
  dom.appendChildTo(overlay, status)
  dom.appendChild(overlay)

  return {
    overlay: Option.some(overlay),
    title: Option.some(title),
    currency: Option.some(currency),
    list: Option.some(list),
    status: Option.some(status),
  }
}
