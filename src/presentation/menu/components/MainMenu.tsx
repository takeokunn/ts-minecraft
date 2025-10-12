import type { JSX } from 'react'

import type { MenuAction } from '../types'

import { MenuButton } from './MenuButton'

interface MainMenuProps {
  readonly title?: string
  readonly subtitle?: string
  readonly actions: ReadonlyArray<MenuAction>
  readonly onSelect: (action: MenuAction) => void
}

export const MainMenu = ({
  title = 'TypeScript Minecraft',
  subtitle,
  actions,
  onSelect,
}: MainMenuProps): JSX.Element => (
  <section
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'linear-gradient(135deg, rgba(14, 14, 32, 0.92), rgba(8, 24, 44, 0.85))',
      color: '#f8fafc',
    }}
  >
    <div
      style={{
        width: 'min(420px, 90vw)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '2rem',
        borderRadius: '16px',
        background: 'rgba(12, 28, 48, 0.7)',
        boxShadow: '0 32px 72px rgba(2, 6, 14, 0.45)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '0.08em' }}>{title}</h1>
        {subtitle ? <p style={{ margin: 0, opacity: 0.7 }}>{subtitle}</p> : null}
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {actions.map((action) => (
          <MenuButton key={action.id} action={action} onSelect={onSelect} />
        ))}
      </div>
    </div>
  </section>
)
