import { Effect, HashMap, Option, Ref, Schema } from 'effect'

export const OscillatorWaveSchema = Schema.Literal('sine', 'square', 'sawtooth', 'triangle', 'custom')
export type OscillatorWave = Schema.Schema.Type<typeof OscillatorWaveSchema>

export const ToneRequestSchema = Schema.Struct({
  frequency: Schema.Number.pipe(Schema.finite(), Schema.positive()),
  durationMs: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
  gain: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  pan: Schema.Number.pipe(Schema.finite(), Schema.between(-1, 1)),
  wave: OscillatorWaveSchema,
  loop: Schema.Boolean,
})
export type ToneRequest = Schema.Schema.Type<typeof ToneRequestSchema>

export const ToneHandleSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type ToneHandle = Schema.Schema.Type<typeof ToneHandleSchema>

type ActiveTone = {
  readonly oscillator: OscillatorNode
  readonly gainNode: GainNode
  readonly pannerNode: Option.Option<StereoPannerNode>
}

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))
export const clampPan = (value: number): number => Math.max(-1, Math.min(1, value))

type GlobalAudioCtor = typeof globalThis & {
  readonly AudioContext?: typeof AudioContext
  readonly webkitAudioContext?: typeof AudioContext
}

const hasAudioContextCtor = (value: typeof globalThis): value is GlobalAudioCtor =>
  'AudioContext' in value || 'webkitAudioContext' in value

const getAudioContextCtor = (): Option.Option<typeof AudioContext> => {
  const audioGlobal = globalThis
  if (!hasAudioContextCtor(audioGlobal)) {
    return Option.none()
  }

  const ctor = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext
  return Option.fromNullable(ctor)
}

const safeDisconnect = (node: AudioNode): Effect.Effect<void, never> =>
  Effect.try({
    try: () => node.disconnect(),
    catch: (error) => new Error(error instanceof Error ? error.message : 'AudioNode disconnect failed'),
  }).pipe(Effect.catchAll(() => Effect.void))

const safeStop = (oscillator: OscillatorNode): Effect.Effect<void, never> =>
  Effect.try({
    try: () => oscillator.stop(),
    catch: (error) => new Error(error instanceof Error ? error.message : 'Oscillator stop failed'),
  }).pipe(Effect.catchAll(() => Effect.void))

export class AudioEngine extends Effect.Service<AudioEngine>()('@minecraft/audio/AudioEngine', {
  effect: Effect.all([
    Ref.make<Option.Option<AudioContext>>(Option.none()),
    Ref.make<Option.Option<GainNode>>(Option.none()),
    Ref.make(0.8),
    Ref.make(HashMap.empty<number, ActiveTone>()),
    Ref.make(1),
  ], { concurrency: 'unbounded' }).pipe(Effect.map(([contextRef, masterGainRef, masterGainValueRef, activeTonesRef, nextToneIdRef]) => {
    const ensureContext = (): Effect.Effect<Option.Option<{ context: AudioContext; masterGain: GainNode }>, never> =>
      Effect.gen(function* () {
        const [contextOpt, masterOpt] = yield* Effect.all(
          [Ref.get(contextRef), Ref.get(masterGainRef)],
          { concurrency: 'unbounded' }
        )

        return yield* Option.match(
          Option.zipWith(contextOpt, masterOpt, (context, masterGain) => ({ context, masterGain })),
          {
            onSome: (pair) => Effect.succeed(Option.some(pair)),
            onNone: () =>
              Effect.gen(function* () {
                const createdOpt = yield* Option.match(getAudioContextCtor(), {
                  onNone: () => Effect.succeed(Option.none<AudioContext>()),
                  onSome: (Ctor) =>
                    Effect.try({
                      try: () => new Ctor(),
                      catch: () => new Error('AudioContext creation failed'),
                    }).pipe(
                      Effect.map(Option.some),
                      Effect.catchAllCause(() => Effect.succeed(Option.none<AudioContext>())),
                    ),
                })

                return yield* Option.match(createdOpt, {
                  onNone: () => Effect.succeed(Option.none<{ context: AudioContext; masterGain: GainNode }>()),
                  onSome: (context) =>
                    Effect.gen(function* () {
                      const masterGain = context.createGain()
                      masterGain.gain.value = yield* Ref.get(masterGainValueRef)
                      masterGain.connect(context.destination)

                      yield* Ref.set(contextRef, Option.some(context))
                      yield* Ref.set(masterGainRef, Option.some(masterGain))

                      return Option.some({ context, masterGain })
                    }),
                })
              }),
          },
        )
      })

    const playTone = (request: ToneRequest): Effect.Effect<ToneHandle, never> =>
      Effect.gen(function* () {
        const handle = yield* Ref.modify(nextToneIdRef, (id): [ToneHandle, number] => [{ id }, id + 1])

        const runtimeOpt = yield* ensureContext()

        return yield* Option.match(runtimeOpt, {
          onNone: () => Effect.succeed(handle),
          onSome: ({ context, masterGain }) =>
            Effect.gen(function* () {
              yield* Effect.tryPromise({
                try: () => context.resume(),
                catch: () => new Error('AudioContext resume failed'),
              }).pipe(Effect.catchAllCause(() => Effect.void))

              const oscillator = context.createOscillator()
              oscillator.frequency.value = Math.max(20, request.frequency)
              oscillator.type = request.wave

              const gainNode = context.createGain()
              gainNode.gain.value = clamp01(request.gain)

              const stereoPanner: Option.Option<StereoPannerNode> =
                'createStereoPanner' in context
                  ? Option.some(context.createStereoPanner())
                  : Option.none()

              yield* Effect.sync(() => {
                oscillator.connect(gainNode)

                Option.match(stereoPanner, {
                  onNone: () => {
                    gainNode.connect(masterGain)
                  },
                  onSome: (pannerNode) => {
                    pannerNode.pan.value = clampPan(request.pan)
                    gainNode.connect(pannerNode)
                    pannerNode.connect(masterGain)
                  },
                })

                oscillator.onended = () => {
                  Effect.runFork(
                    Effect.all(
                      [
                        safeDisconnect(oscillator),
                        safeDisconnect(gainNode),
                        Option.match(stereoPanner, {
                          onNone: () => Effect.void,
                          onSome: (pannerNode) => safeDisconnect(pannerNode),
                        }),
                        Ref.update(activeTonesRef, (state) => HashMap.remove(state, handle.id)),
                      ],
                      { concurrency: 'unbounded' },
                    ).pipe(Effect.asVoid),
                  )
                }

                oscillator.start()

                if (!request.loop) {
                  oscillator.stop(context.currentTime + Math.max(0.01, request.durationMs / 1000))
                }
              })

              yield* Ref.update(activeTonesRef, (state) =>
                HashMap.set(state, handle.id, {
                  oscillator,
                  gainNode,
                  pannerNode: stereoPanner,
                }),
              )

              return handle
            }),
        })
      })

    const stopTone = (handle: ToneHandle): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const toneOpt = yield* Ref.modify(
          activeTonesRef,
          (state): [Option.Option<ActiveTone>, HashMap.HashMap<number, ActiveTone>] =>
            [HashMap.get(state, handle.id), HashMap.remove(state, handle.id)],
        )

          yield* Option.match(toneOpt, {
          onNone: () => Effect.void,
          onSome: (tone) =>
            Effect.all(
              [
                safeStop(tone.oscillator),
                safeDisconnect(tone.oscillator),
                safeDisconnect(tone.gainNode),
                Option.match(tone.pannerNode, {
                  onNone: () => Effect.void,
                  onSome: (pannerNode) => safeDisconnect(pannerNode),
                }),
              ],
              { concurrency: 'unbounded' },
            ).pipe(Effect.asVoid),
        })
      })

    const setMasterGain = (gain: number): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const nextGain = clamp01(gain)
        yield* Ref.set(masterGainValueRef, nextGain)

        const masterOpt = yield* Ref.get(masterGainRef)
        yield* Option.match(masterOpt, {
          onNone: () => Effect.void,
          onSome: (masterGain) => Effect.sync(() => { masterGain.gain.value = nextGain }),
        })
      })

    return {
      playTone,
      stopTone,
      setMasterGain,
    }
  }))
}) {}

export const AudioEngineLive = AudioEngine.Default
