import { Effect, Option, Ref, Schema } from 'effect';
import { AudioEnginePort } from '../domain/audio-engine-port';
import { clamp01 } from '../domain/audio-types';
import { TRACKS, DEFAULT_CAVE_THRESHOLD_Y } from './music-manager.config';
const environmentFromContext = (isNight, playerPosition, caveThresholdY) => {
    if (playerPosition.y < caveThresholdY)
        return 'cave';
    return isNight ? 'night' : 'day';
};
export const MusicEnvironmentSchema = Schema.Literal('day', 'night', 'cave');
export const MusicSettingsSchema = Schema.Struct({
    enabled: Schema.Boolean,
    masterVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
    musicVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
});
export class MusicManager extends Effect.Service()('@minecraft/audio/MusicManager', {
    effect: Effect.all([
        AudioEnginePort,
        Ref.make(true),
        Ref.make(0.8),
        Ref.make(0.55),
        Ref.make(Option.none()),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([audioEngine, enabledRef, masterVolumeRef, musicVolumeRef, activeTrackRef]) => {
        const stopActiveTrack = () => Effect.gen(function* () {
            const activeTrackOpt = yield* Ref.getAndSet(activeTrackRef, Option.none());
            yield* Option.match(activeTrackOpt, {
                onNone: () => Effect.void,
                onSome: (activeTrack) => audioEngine.stopTone(activeTrack.handle),
            });
        });
        const playEnvironmentTrack = (environment) => Effect.gen(function* () {
            const enabled = yield* Ref.get(enabledRef);
            if (!enabled) {
                yield* stopActiveTrack();
                return;
            }
            const currentTrackOpt = yield* Ref.get(activeTrackRef);
            if (Option.exists(currentTrackOpt, (track) => track.environment === environment)) {
                return;
            }
            yield* stopActiveTrack();
            const track = TRACKS[environment];
            const [masterVolume, musicVolume] = yield* Effect.all([Ref.get(masterVolumeRef), Ref.get(musicVolumeRef)], { concurrency: 'unbounded' });
            const gain = clamp01(track.baseGain * masterVolume * musicVolume);
            const handle = yield* audioEngine.playTone({
                frequency: track.frequency,
                durationMs: 2000,
                gain,
                pan: 0,
                wave: track.wave,
                loop: true,
            });
            yield* Ref.set(activeTrackRef, Option.some({ environment, handle }));
        });
        return {
            applySettings: (settings) => Effect.gen(function* () {
                yield* Ref.set(enabledRef, settings.enabled);
                yield* Ref.set(masterVolumeRef, settings.masterVolume);
                yield* Ref.set(musicVolumeRef, settings.musicVolume);
                yield* audioEngine.setMasterGain(settings.masterVolume);
                if (!settings.enabled) {
                    yield* stopActiveTrack();
                }
            }),
            setEnvironment: (environment) => playEnvironmentTrack(environment),
            updateFromContext: (context) => playEnvironmentTrack(environmentFromContext(context.isNight, context.playerPosition, Option.getOrElse(Option.fromNullable(context.caveThresholdY), () => DEFAULT_CAVE_THRESHOLD_Y))),
            stop: () => stopActiveTrack(),
            getCurrentEnvironment: () => Ref.get(activeTrackRef).pipe(Effect.map((trackOpt) => Option.map(trackOpt, (track) => track.environment))),
            getState: () => Effect.gen(function* () {
                const [enabled, masterVolume, musicVolume] = yield* Effect.all([
                    Ref.get(enabledRef),
                    Ref.get(masterVolumeRef),
                    Ref.get(musicVolumeRef),
                ], { concurrency: 'unbounded' });
                return {
                    enabled,
                    masterVolume,
                    musicVolume,
                };
            }),
        };
    }))
}) {
}
export const MusicManagerLive = MusicManager.Default;
//# sourceMappingURL=../../../dist/packages/game/application/music-manager.js.map