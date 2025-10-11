import type { JSX } from 'react'

import type { CraftingPanelView, CraftingSlotView, CraftingResultView } from '../types'

import { CraftingGrid } from './CraftingGrid'
import { CraftingResult } from './CraftingResult'

interface CraftingPanelProps {
  readonly view: CraftingPanelView
  readonly onSelectSlot?: (slot: CraftingSlotView) => void
  readonly onCraft?: (result: CraftingResultView) => void
}

export const CraftingPanel = ({ view, onSelectSlot, onCraft }: CraftingPanelProps): JSX.Element => (
  <section
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 120px',
      gap: '1.5rem',
      padding: '1.5rem',
      borderRadius: '18px',
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      color: '#e2e8f0',
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <CraftingGrid view={view.grid} onSelectSlot={onSelectSlot} />
      <footer style={{ fontSize: '0.75rem', opacity: 0.65 }}>
        {view.recipeId ? `Recipe: ${view.recipeId}` : 'Insert ingredients to discover recipes'}
      </footer>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
      <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem', opacity: 0.7 }}>Result</span>
      <CraftingResult
        result={view.result}
        disabled={!view.canCraft || !view.result}
        onCraft={(result) => {
          if (view.canCraft) {
            onCraft?.(result)
          }
        }}
      />
    </div>
  </section>
)
