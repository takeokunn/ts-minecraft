import type { JSX } from 'react'

import type { CraftingResultView } from '../types'

interface CraftingResultProps {
  readonly result?: CraftingResultView
  readonly disabled?: boolean
  readonly onCraft?: (result: CraftingResultView) => void
}

export const CraftingResult = ({ result, disabled = false, onCraft }: CraftingResultProps): JSX.Element => (
  <button
    type="button"
    disabled={!result || disabled}
    onClick={() => {
      if (result && !disabled) {
        onCraft?.(result)
      }
    }}
    style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      minHeight: '6rem',
      borderRadius: '14px',
      border: '1px solid rgba(250, 204, 21, 0.45)',
      background: disabled || !result ? 'rgba(17, 24, 39, 0.55)' : 'linear-gradient(135deg, #facc15, #f97316)',
      color: disabled || !result ? 'rgba(148, 163, 184, 0.5)' : '#111827',
      cursor: disabled || !result ? 'not-allowed' : 'pointer',
      gap: '0.35rem',
      transition: 'transform 120ms ease-out',
    }}
  >
    {result ? (
      <>
        <span style={{ fontSize: '1rem', fontWeight: 700 }}>{result.itemName ?? result.itemId}</span>
        <span style={{ fontSize: '0.85rem' }}>x{result.quantity}</span>
        {result.description ? (
          <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>{result.description}</span>
        ) : null}
      </>
    ) : (
      <span style={{ fontSize: '0.85rem', opacity: 0.5 }}>No recipe</span>
    )}
  </button>
)
