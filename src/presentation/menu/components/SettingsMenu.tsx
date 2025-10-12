import type { JSX } from 'react'

import { Match, pipe } from 'effect'

import type {
  SelectSettingsOption,
  SettingsCategory,
  SettingsOption,
  SliderSettingsOption,
  ToggleSettingsOption,
} from '../types'

interface SettingsMenuProps {
  readonly title?: string
  readonly categories: ReadonlyArray<SettingsCategory>
  readonly onToggle?: (option: ToggleSettingsOption, value: boolean) => void
  readonly onSliderChange?: (option: SliderSettingsOption, value: number) => void
  readonly onSelectChange?: (option: SelectSettingsOption, value: string) => void
}

const renderOption = (
  option: SettingsOption,
  handlers: Pick<SettingsMenuProps, 'onToggle' | 'onSliderChange' | 'onSelectChange'>
): JSX.Element =>
  pipe(
    Match.type<SettingsOption>(),
    Match.discriminatorsExhaustive('type')({
      toggle: () => (
        <label
          key={option.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.55)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontWeight: 600 }}>{option.label}</span>
            {option.description ? (
              <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>{option.description}</span>
            ) : null}
          </div>
          <input
            type="checkbox"
            checked={option.value}
            onChange={(event) => handlers.onToggle?.(option, event.target.checked)}
            style={{ width: '1.5rem', height: '1.5rem' }}
          />
        </label>
      ),
      slider: () => (
        <div
          key={option.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.55)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{option.label}</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
              {option.value}
              {option.unit ? ` ${option.unit}` : ''}
            </span>
          </div>
          {option.description ? <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>{option.description}</span> : null}
          <input
            type="range"
            min={option.min}
            max={option.max}
            step={option.step}
            value={option.value}
            onChange={(event) => handlers.onSliderChange?.(option, Number(event.target.value))}
          />
        </div>
      ),
      select: () => (
        <div
          key={option.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.55)',
          }}
        >
          <span style={{ fontWeight: 600 }}>{option.label}</span>
          {option.description ? <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>{option.description}</span> : null}
          <select
            value={option.value}
            onChange={(event) => handlers.onSelectChange?.(option, event.target.value)}
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              background: 'rgba(15, 23, 42, 0.75)',
              color: '#f8fafc',
            }}
          >
            {option.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ),
    })
  )(option)

export const SettingsMenu = ({
  title = 'Settings',
  categories,
  onToggle,
  onSliderChange,
  onSelectChange,
}: SettingsMenuProps): JSX.Element => (
  <section
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      justifyContent: 'center',
      padding: '2rem',
      background: 'rgba(2, 6, 23, 0.8)',
      color: '#e2e8f0',
      overflowY: 'auto',
    }}
  >
    <div
      style={{
        width: 'min(960px, 92vw)',
        display: 'grid',
        gridTemplateColumns: 'minmax(180px, 220px) 1fr',
        gap: '1.5rem',
        background: 'rgba(15, 23, 42, 0.75)',
        borderRadius: '18px',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        padding: '2rem',
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{title}</h2>
        <ul
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          {categories.map((category) => (
            <li key={category.id} style={{ fontWeight: 600, opacity: 0.7 }}>
              {category.label}
            </li>
          ))}
        </ul>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {categories.map((category) => (
          <section key={category.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>{category.label}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {category.options.map((option) => renderOption(option, { onToggle, onSliderChange, onSelectChange }))}
            </div>
          </section>
        ))}
      </div>
    </div>
  </section>
)
