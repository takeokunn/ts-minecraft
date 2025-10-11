import type { JSX } from 'react'

interface ProgressBarProps {
  readonly label: string
  readonly value: number
  readonly max: number
  readonly color: string
  readonly backgroundColor?: string
  readonly showValue?: boolean
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const ProgressBar = ({
  label,
  value,
  max,
  color,
  backgroundColor = 'rgba(0, 0, 0, 0.35)',
  showValue = true,
}: ProgressBarProps): JSX.Element => {
  const safeMax = max <= 0 ? 1 : max
  const ratio = clamp(value, 0, safeMax) / safeMax

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        minWidth: '10rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
        }}
      >
        <span>{label}</span>
        {showValue ? <span>{`${Math.round(value)}/${Math.round(safeMax)}`}</span> : null}
      </div>
      <div
        style={{
          position: 'relative',
          height: '0.75rem',
          borderRadius: '999px',
          backgroundColor,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${ratio * 100}%`,
            background: color,
            transition: 'width 120ms ease-out',
          }}
        />
      </div>
    </div>
  )
}
