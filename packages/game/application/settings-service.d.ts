import { Effect, Schema } from 'effect';
import { EnvironmentPort } from '@ts-minecraft/kernel';
export declare const GraphicsQuality: Schema.Literal<["low", "medium", "high", "ultra"]>;
export type GraphicsQuality = Schema.Schema.Type<typeof GraphicsQuality>;
export declare const ResolvedGraphicsSchema: Schema.Struct<{
    shadowsEnabled: typeof Schema.Boolean;
    ssaoEnabled: typeof Schema.Boolean;
    bloomEnabled: typeof Schema.Boolean;
    smaaEnabled: typeof Schema.Boolean;
    skyEnabled: typeof Schema.Boolean;
    dofEnabled: typeof Schema.Boolean;
    godRaysEnabled: typeof Schema.Boolean;
    godRaysSamples: Schema.filter<Schema.filter<typeof Schema.Number>>;
    bloomStrength: Schema.filter<Schema.filter<typeof Schema.Number>>;
    refractionThrottleFrames: Schema.filter<Schema.filter<typeof Schema.Number>>;
    pixelRatioCap: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>;
export type ResolvedGraphics = Schema.Schema.Type<typeof ResolvedGraphicsSchema>;
export declare const resolvePreset: (quality: GraphicsQuality) => ResolvedGraphics;
export declare const SettingsSchema: Schema.Struct<{
    renderDistance: Schema.filter<Schema.filter<typeof Schema.Number>>;
    mouseSensitivity: Schema.filter<Schema.filter<typeof Schema.Number>>;
    dayLengthSeconds: Schema.filter<Schema.filter<typeof Schema.Number>>;
    graphicsQuality: Schema.Literal<["low", "medium", "high", "ultra"]>;
    adaptivePerformanceMode: typeof Schema.Boolean;
    audioEnabled: typeof Schema.Boolean;
    masterVolume: Schema.filter<Schema.filter<typeof Schema.Number>>;
    sfxVolume: Schema.filter<Schema.filter<typeof Schema.Number>>;
    musicVolume: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>;
export type Settings = Schema.Schema.Type<typeof SettingsSchema>;
declare const SettingsService_base: Effect.Service.Class<SettingsService, "@minecraft/application/SettingsService", {
    readonly effect: Effect.Effect<{
        getSettings: () => Effect.Effect<{
            readonly masterVolume: number;
            readonly musicVolume: number;
            readonly renderDistance: number;
            readonly mouseSensitivity: number;
            readonly dayLengthSeconds: number;
            readonly graphicsQuality: "low" | "medium" | "high" | "ultra";
            readonly adaptivePerformanceMode: boolean;
            readonly audioEnabled: boolean;
            readonly sfxVolume: number;
        }, never, never>;
        updateSettings: (partial: Partial<Settings>) => Effect.Effect<void, never, never>;
        resetToDefaults: () => Effect.Effect<void, never, never>;
    }, never, EnvironmentPort>;
}>;
export declare class SettingsService extends SettingsService_base {
}
export declare const SettingsServiceLive: import("effect/Layer").Layer<SettingsService, never, EnvironmentPort>;
export {};
//# sourceMappingURL=settings-service.d.ts.map