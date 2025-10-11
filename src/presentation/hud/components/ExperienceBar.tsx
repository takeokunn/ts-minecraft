import type { JSX } from 'react'

import type { PlayerHUDViewModel } from '@/application/player'

import { ProgressBar } from './ProgressBar'

interface ExperienceBarProps {
  readonly model: PlayerHUDViewModel
  readonly maxLevel?: number
}

const DEFAULT_MAX_LEVEL = 30

export const ExperienceBar = ({ model, maxLevel = DEFAULT_MAX_LEVEL }: ExperienceBarProps): JSX.Element => (
  <ProgressBar
    label="Experience"
    value={model.experienceLevel}
    max={maxLevel}
    color="linear-gradient(90deg, #22c55e, #15803d)"
    showValue
  />
)
