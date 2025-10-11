import type { JSX } from 'react'

import type { PlayerHUDViewModel } from '@/application/player'

import { ProgressBar } from './ProgressBar'

interface HealthBarProps {
  readonly model: PlayerHUDViewModel
}

export const HealthBar = ({ model }: HealthBarProps): JSX.Element => (
  <ProgressBar label="Health" value={model.health} max={model.maxHealth} color="linear-gradient(90deg, #ff4d4f, #d9363e)" />
)
