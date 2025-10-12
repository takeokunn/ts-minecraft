import type { JSX } from 'react'

import type { MenuAction } from '../types'

import { MenuButton } from './MenuButton'

interface PauseMenuProps {
  readonly title?: string
  readonly sessionName?: string
  readonly actions: ReadonlyArray<MenuAction>
  readonly onSelect: (action: MenuAction) => void
}

export const PauseMenu = ({
  title = 'Paused',
  sessionName,
  actions,
  onSelect,
}: PauseMenuProps): JSX.Element => (
  <section
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.65)',
      color: '#f8fafc',
      padding: '1.5rem',
    }}
  >
    <div
      style={{
        minWidth: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
        borderRadius: '14px',
        background: 'rgba(12, 20, 32, 0.9)',
        border: '1px solid rgba(148, 163, 184, 0.25)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {sessionName ? <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>{sessionName}</span> : null}
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {actions.map((action) => (
          <MenuButton key={action.id} action={action} onSelect={onSelect} />
        ))}
      </div>
    </div>
  </section>
)
