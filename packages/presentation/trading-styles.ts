const SELECTED_ROW_STYLES = 'padding:6px 8px;border-radius:4px;background:#2f4f2f;border:1px solid #8fbc8f'
const DEFAULT_ROW_STYLES = 'padding:6px 8px;border-radius:4px;background:#1f1f1f;border:1px solid #3d3d3d'

export const OVERLAY_STYLES = [
  'position:fixed',
  'top:50%',
  'left:50%',
  'transform:translate(-50%,-50%)',
  'background:rgba(10,10,10,0.92)',
  'color:#fff',
  'padding:16px',
  'border-radius:8px',
  'min-width:360px',
  'max-width:480px',
  'font-family:monospace',
  'z-index:1002',
  'display:none',
  'border:1px solid #4d4d4d',
].join(';')

export const TITLE_STYLES = 'font-size:16px;font-weight:bold;margin-bottom:8px'
export const CURRENCY_STYLES = 'font-size:12px;color:#ddd;margin-bottom:8px'
export const LIST_STYLES = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;max-height:180px;overflow:auto'
export const STATUS_STYLES = 'font-size:12px;color:#b0b0b0'
export const EMPTY_TEXT_STYLES = 'color:#aaa;font-size:12px'

export const STATUS_HINT_TEXT = 'T: open/close, ↑↓: select, Enter: trade, Esc: close'
export const EMPTY_VILLAGER_TEXT = 'No villager selected.'
export const EMPTY_OFFERS_TEXT = 'No available offers for current villager level.'

export const rowStyles = (selected: boolean): string =>
  selected ? SELECTED_ROW_STYLES : DEFAULT_ROW_STYLES
