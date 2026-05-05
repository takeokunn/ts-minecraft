import { Effect, Layer } from 'effect';
import { AudioEnginePort } from '../domain/audio-engine-port';
import type { ToneHandle, ToneRequest } from '../domain/audio-types';
declare const AudioEngine_base: Effect.Service.Class<AudioEngine, "@minecraft/audio/AudioEngine", {
    readonly effect: Effect.Effect<{
        playTone: (request: ToneRequest) => Effect.Effect<ToneHandle, never>;
        stopTone: (handle: ToneHandle) => Effect.Effect<void, never>;
        setMasterGain: (gain: number) => Effect.Effect<void, never>;
    }, never, never>;
}>;
export declare class AudioEngine extends AudioEngine_base {
}
export declare const AudioEngineLive: Layer.Layer<AudioEngine, never, never>;
export declare const AudioEnginePortLive: Layer.Layer<AudioEnginePort, never, AudioEngine>;
export {};
//# sourceMappingURL=audio-engine.d.ts.map