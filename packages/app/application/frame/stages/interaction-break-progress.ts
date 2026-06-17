export type BreakProgressState = {
  readonly blockKey: string
  readonly ticks: number
  readonly totalTicks: number
}

export type AdvanceBreakProgressInput = {
  readonly current: BreakProgressState | null
  readonly blockKey: string
  readonly breakTicks: number
}

export type AdvanceBreakProgressResult = {
  readonly nextProgress: BreakProgressState | null
  readonly shouldBreak: boolean
}

export const advanceBreakProgress = (
  input: AdvanceBreakProgressInput,
): AdvanceBreakProgressResult => {
  const currentTicks = input.current !== null && input.current.blockKey === input.blockKey ? input.current.ticks : 0
  const newTicks = currentTicks + 1

  if (input.breakTicks === 0 || newTicks >= input.breakTicks) {
    return {
      nextProgress: null,
      shouldBreak: true,
    }
  }

  return {
    nextProgress: {
      blockKey: input.blockKey,
      ticks: newTicks,
      totalTicks: input.breakTicks,
    },
    shouldBreak: false,
  }
}
