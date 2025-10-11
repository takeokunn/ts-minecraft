import type { JSX } from 'react'

import type { PlayerHUDViewModel } from '@/application/player'

import { ExperienceBar } from './ExperienceBar'
import { HealthBar } from './HealthBar'
import { HungerBar } from './HungerBar'

interface HUDOverlayProps {
  readonly model: PlayerHUDViewModel
  readonly onOpenSettings?: () => void
  readonly onOpenInventory?: () => void
}

export const HUDOverlay = ({ model, onOpenSettings, onOpenInventory }: HUDOverlayProps): JSX.Element => (
  <aside
    style={{
      position: 'absolute',
      left: '1.5rem',
      bottom: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      padding: '1rem',
      borderRadius: '16px',
      background: 'rgba(12, 12, 12, 0.65)',
      color: '#f5f5f5',
      backdropFilter: 'blur(6px)',
      minWidth: '14rem',
    }}
  >
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.9rem',
      }}
    >
      <span>{model.playerId}</span>
      <span style={{ opacity: 0.65 }}>LV {model.experienceLevel}</span>
    </header>

    <HealthBar model={model} />
    <HungerBar model={model} />
    <ExperienceBar model={model} />

    <footer
      style={{
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'flex-end',
      }}
    >
      {onOpenInventory ? (
        <button
          type="button"
          onClick={onOpenInventory}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.12)',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          Inventory
        </button>
      ) : null}
      {onOpenSettings ? (
        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.12)',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          Settings
        </button>
      ) : null}
    </footer>
  </aside>
)
