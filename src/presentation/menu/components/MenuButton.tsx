import type { JSX } from 'react'

import type { MenuAction } from '../types'

interface MenuButtonProps {
  readonly action: MenuAction
  readonly onSelect: (action: MenuAction) => void
}

export const MenuButton = ({ action, onSelect }: MenuButtonProps): JSX.Element => (
  <button
    type="button"
    onClick={() => onSelect(action)}
    disabled={action.disabled}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '0.25rem',
      padding: '0.75rem 1rem',
      borderRadius: '12px',
      border: 'none',
      background: action.disabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.16)',
      color: '#f5f5f5',
      cursor: action.disabled ? 'not-allowed' : 'pointer',
      width: '100%',
      textAlign: 'left',
    }}
  >
    <span style={{ fontSize: '1rem', fontWeight: 600 }}>{action.label}</span>
    {action.description ? (
      <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{action.description}</span>
    ) : null}
  </button>
)
