import { Effect, HashMap, Layer, Option, Ref } from 'effect';
import { AudioEnginePort } from '../domain/audio-engine-port';
import { clamp01, clampPan } from '../domain/audio-types';
const acquireAudioContext = () => {
    if (typeof AudioContext === 'undefined') {
        return Effect.succeed(Option.none());
    }
    return Effect.try({
        try: () => new AudioContext(),
        catch: () => new Error('AudioContext creation failed'),
    }).pipe(Effect.map(Option.some), Effect.catchAllCause(() => Effect.succeed(Option.none())));
};
const wireMasterGain = (context, initialGain) => {
    const masterGain = context.createGain();
    masterGain.gain.value = initialGain;
    masterGain.connect(context.destination);
    return { masterGain };
};
const safeDisconnect = (node) => Effect.try({
    try: () => node.disconnect(),
    catch: (error) => new Error(error instanceof Error ? error.message : 'AudioNode disconnect failed'),
}).pipe(Effect.catchAll(() => Effect.void));
const safeStop = (oscillator) => Effect.try({
    try: () => oscillator.stop(),
    catch: (error) => new Error(error instanceof Error ? error.message : 'Oscillator stop failed'),
}).pipe(Effect.catchAll(() => Effect.void));
export class AudioEngine extends Effect.Service()('@minecraft/audio/AudioEngine', {
    effect: Effect.all([
        Ref.make(Option.none()),
        Ref.make(Option.none()),
        Ref.make(0.8),
        Ref.make(HashMap.empty()),
        Ref.make(1),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([contextRef, masterGainRef, masterGainValueRef, activeTonesRef, nextToneIdRef]) => {
        const ensureContext = () => Effect.gen(function* () {
            const [contextOpt, masterOpt] = yield* Effect.all([Ref.get(contextRef), Ref.get(masterGainRef)], { concurrency: 'unbounded' });
            const cached = Option.zipWith(contextOpt, masterOpt, (context, masterGain) => ({ context, masterGain }));
            return yield* Option.match(cached, {
                onSome: () => Effect.succeed(cached),
                onNone: () => Effect.gen(function* () {
                    const contextCreated = yield* acquireAudioContext();
                    return yield* Option.match(contextCreated, {
                        onNone: () => Effect.succeed(Option.none()),
                        onSome: (context) => Effect.gen(function* () {
                            const initialGain = yield* Ref.get(masterGainValueRef);
                            const { masterGain } = wireMasterGain(context, initialGain);
                            yield* Ref.set(contextRef, Option.some(context));
                            yield* Ref.set(masterGainRef, Option.some(masterGain));
                            return Option.some({ context, masterGain });
                        }),
                    });
                }),
            });
        });
        const playTone = (request) => Effect.gen(function* () {
            const handle = yield* Ref.modify(nextToneIdRef, (id) => [{ id }, id + 1]);
            const runtimeOpt = yield* ensureContext();
            return yield* Option.match(runtimeOpt, {
                onNone: () => Effect.succeed(handle),
                onSome: ({ context, masterGain }) => Effect.gen(function* () {
                    yield* Effect.tryPromise({
                        try: () => context.resume(),
                        catch: () => new Error('AudioContext resume failed'),
                    }).pipe(Effect.catchAllCause(() => Effect.void));
                    const oscillator = context.createOscillator();
                    oscillator.frequency.value = Math.max(20, request.frequency);
                    oscillator.type = request.wave;
                    const gainNode = context.createGain();
                    gainNode.gain.value = clamp01(request.gain);
                    const stereoPanner = 'createStereoPanner' in context
                        ? Option.some(context.createStereoPanner())
                        : Option.none();
                    yield* Effect.sync(() => {
                        oscillator.connect(gainNode);
                        Option.match(stereoPanner, {
                            onNone: () => {
                                gainNode.connect(masterGain);
                            },
                            onSome: (pannerNode) => {
                                pannerNode.pan.value = clampPan(request.pan);
                                gainNode.connect(pannerNode);
                                pannerNode.connect(masterGain);
                            },
                        });
                        oscillator.onended = () => {
                            Effect.runFork(Effect.all([
                                safeDisconnect(oscillator),
                                safeDisconnect(gainNode),
                                Option.match(stereoPanner, {
                                    onNone: () => Effect.void,
                                    onSome: (pannerNode) => safeDisconnect(pannerNode),
                                }),
                                Ref.update(activeTonesRef, (state) => HashMap.remove(state, handle.id)),
                            ], { concurrency: 'unbounded' }).pipe(Effect.asVoid));
                        };
                        oscillator.start();
                        if (!request.loop) {
                            oscillator.stop(context.currentTime + Math.max(0.01, request.durationMs / 1000));
                        }
                    });
                    yield* Ref.update(activeTonesRef, (state) => HashMap.set(state, handle.id, {
                        oscillator,
                        gainNode,
                        pannerNode: stereoPanner,
                    }));
                    return handle;
                }),
            });
        });
        const stopTone = (handle) => Effect.gen(function* () {
            const toneOpt = yield* Ref.modify(activeTonesRef, (state) => [HashMap.get(state, handle.id), HashMap.remove(state, handle.id)]);
            yield* Option.match(toneOpt, {
                onNone: () => Effect.void,
                onSome: (tone) => Effect.all([
                    safeStop(tone.oscillator),
                    safeDisconnect(tone.oscillator),
                    safeDisconnect(tone.gainNode),
                    Option.match(tone.pannerNode, {
                        onNone: () => Effect.void,
                        onSome: (pannerNode) => safeDisconnect(pannerNode),
                    }),
                ], { concurrency: 'unbounded' }).pipe(Effect.asVoid),
            });
        });
        const setMasterGain = (gain) => Effect.gen(function* () {
            const nextGain = clamp01(gain);
            yield* Ref.set(masterGainValueRef, nextGain);
            const masterOpt = yield* Ref.get(masterGainRef);
            yield* Option.match(masterOpt, {
                onNone: () => Effect.void,
                onSome: (masterGain) => Effect.sync(() => { masterGain.gain.value = nextGain; }),
            });
        });
        return {
            playTone,
            stopTone,
            setMasterGain,
        };
    }))
}) {
}
export const AudioEngineLive = AudioEngine.Default;
export const AudioEnginePortLive = Layer.effect(AudioEnginePort, AudioEngine.pipe(Effect.map((engine) => ({
    playTone: engine.playTone,
    stopTone: engine.stopTone,
    setMasterGain: engine.setMasterGain,
}))));
//# sourceMappingURL=../../../dist/packages/game/infrastructure/audio-engine.js.map