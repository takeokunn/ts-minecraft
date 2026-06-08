import { Effect, Option } from 'effect'

export const acquireAudioContext = (): Effect.Effect<Option.Option<AudioContext>, never> => {
  if (typeof AudioContext === 'undefined') {
    return Effect.succeed(Option.none())
  }
  return Effect.try({
    try: () => new AudioContext(),
    catch: () => new Error('AudioContext creation failed'),
  }).pipe(
    Effect.map(Option.some),
    Effect.catchAllCause(() => Effect.succeed(Option.none())),
  )
}

export const wireMasterGain = (
  context: AudioContext,
  initialGain: number,
): { masterGain: GainNode } => {
  const masterGain = context.createGain()
  masterGain.gain.value = initialGain
  masterGain.connect(context.destination)
  return { masterGain }
}

export const safeDisconnect = (node: AudioNode): Effect.Effect<void, never> =>
  Effect.try({
    try: () => node.disconnect(),
    catch: (error) => new Error(error instanceof Error ? error.message : 'AudioNode disconnect failed'),
  }).pipe(Effect.catchAll(() => Effect.void))

export const safeStop = (oscillator: OscillatorNode): Effect.Effect<void, never> =>
  Effect.try({
    try: () => oscillator.stop(),
    catch: (error) => new Error(error instanceof Error ? error.message : 'Oscillator stop failed'),
  }).pipe(Effect.catchAll(() => Effect.void))
