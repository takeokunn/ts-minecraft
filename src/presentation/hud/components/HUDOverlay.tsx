import type { JSX } from 'react'

import type { CameraHUDViewModel } from '@/application/camera'
import type { PlayerHUDViewModel } from '@/application/player'
import { useMenuActions } from '@presentation/menu'

import { ExperienceBar } from './ExperienceBar'
import { CameraStatusPanel } from './CameraStatusPanel'
import { HealthBar } from './HealthBar'
import { HungerBar } from './HungerBar'

interface HUDOverlayProps {
  readonly model: PlayerHUDViewModel
  readonly cameraStatus?: CameraHUDViewModel
  readonly onOpenSettings?: () => void
  readonly onOpenInventory?: () => void
}

export const HUDOverlay = ({ model, cameraStatus, onOpenSettings, onOpenInventory }: HUDOverlayProps): JSX.Element => {
  const { openSettings } = useMenuActions()
  const handleSettings = onOpenSettings ?? openSettings

  return (
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
      minWidth: '18rem',
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
    {cameraStatus ? <CameraStatusPanel camera={cameraStatus} /> : null}

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
      {handleSettings ? (
        <button
          type="button"
          onClick={handleSettings}
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
}
