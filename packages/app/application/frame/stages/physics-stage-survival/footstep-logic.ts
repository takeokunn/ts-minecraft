export type FootstepState = {
  readonly nextAccumulator: number
  readonly shouldPlay: boolean
}

type FootstepStateInput = {
  readonly currentAccumulator: number
  readonly distanceMoved: number
  readonly isGrounded: boolean
  readonly isSneaking: boolean
  readonly hasFootstepEffect: boolean
  readonly intervalBlocks: number
}

export const resolveFootstepState = (input: FootstepStateInput): FootstepState => {
  if (!input.isGrounded || input.distanceMoved <= 0 || input.isSneaking || !input.hasFootstepEffect) {
    return { nextAccumulator: 0, shouldPlay: false }
  }

  const nextDistance = input.currentAccumulator + input.distanceMoved
  return {
    nextAccumulator: nextDistance >= input.intervalBlocks ? nextDistance % input.intervalBlocks : nextDistance,
    shouldPlay: nextDistance >= input.intervalBlocks,
  }
}
