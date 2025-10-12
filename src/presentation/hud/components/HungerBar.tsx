import type { JSX } from 'react'

import type { PlayerHUDViewModel } from '@/application/player'

import { ProgressBar } from './ProgressBar'

interface HungerBarProps {
  readonly model: PlayerHUDViewModel
}

export const HungerBar = ({ model }: HungerBarProps): JSX.Element => (
  <ProgressBar
    label="Hunger"
    value={model.hunger}
    max={model.maxHunger}
    color="linear-gradient(90deg, #f59e0b, #d97706)"
  />
)
