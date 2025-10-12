import type { CameraHUDViewModel } from '@/application/camera'
import type { JSX } from 'react'

const formatNumber = (value: number, fractionDigits = 2): string =>
  Number.isFinite(value) ? value.toFixed(fractionDigits) : '—'

const Metric = ({ label, value }: { readonly label: string; readonly value: string }): JSX.Element => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.15rem',
    }}
  >
    <span
      style={{
        fontSize: '0.7rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'rgba(255, 255, 255, 0.55)',
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontWeight: 600,
        fontSize: '0.9rem',
      }}
    >
      {value}
    </span>
  </div>
)

interface CameraStatusPanelProps {
  readonly camera: CameraHUDViewModel
}

export const CameraStatusPanel = ({ camera }: CameraStatusPanelProps): JSX.Element => {
  const statusLabel = camera.isEnabled ? 'ACTIVE' : 'DISABLED'
  const statusColor = camera.isEnabled ? '#4ade80' : '#f87171'

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        padding: '0.8rem',
        borderRadius: '12px',
        background: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
      >
        <span>Camera: {camera.cameraId}</span>
        <span
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.5rem',
        }}
      >
        <Metric label="Mode" value={camera.mode} />
        <Metric label="FOV" value={`${formatNumber(camera.projection.fov, 0)}°`} />
        <Metric label="Sensitivity" value={formatNumber(camera.sensitivity, 2)} />
        <Metric label="Smoothing" value={formatNumber(camera.smoothing, 2)} />
        <Metric label="Render Dist." value={`${formatNumber(camera.renderDistance, 0)} chunks`} />
        <Metric label="Frame Rate" value={`${formatNumber(camera.frameRate, 0)} FPS`} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.5rem',
          padding: '0.6rem',
          borderRadius: '10px',
          background: 'rgba(0, 0, 0, 0.25)',
        }}
      >
        <Metric
          label="Position"
          value={`${formatNumber(camera.position.x)}, ${formatNumber(camera.position.y)}, ${formatNumber(camera.position.z)}`}
        />
        <Metric
          label="Rotation"
          value={`${formatNumber(camera.rotation.pitch, 1)}°, ${formatNumber(camera.rotation.yaw, 1)}°, ${formatNumber(camera.rotation.roll, 1)}°`}
        />
        <Metric
          label="Near/Far"
          value={`${formatNumber(camera.projection.near, 2)} / ${formatNumber(camera.projection.far, 0)}`}
        />
        <Metric label="Aspect" value={formatNumber(camera.projection.aspectRatio, 2)} />
      </div>
    </section>
  )
}
