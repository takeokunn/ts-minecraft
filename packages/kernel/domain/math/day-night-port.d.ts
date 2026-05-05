import { Option, Schema } from 'effect';
export { Option };
type Vec3Set = (x: number, y: number, z: number) => void;
type ClearColor = (color: ColorPort) => void;
type UpdateMatrixWorld = () => void;
type UpdateProjectionMatrix = () => void;
type SkyUniformSet = (x: number, y: number, z: number) => void;
export type ColorPort = {
    readonly r: number;
    readonly g: number;
    readonly b: number;
    setHSL(h: number, s: number, l: number, colorSpace?: string): unknown;
    lerpColors(color1: ColorPort, color2: ColorPort, alpha: number): unknown;
};
export declare const ColorPortSchema: Schema.declare<ColorPort, ColorPort, readonly [], never>;
export declare const LightTargetPortSchema: Schema.mutable<Schema.Struct<{
    position: Schema.Struct<{
        set: Schema.declare<Vec3Set, Vec3Set, readonly [], never>;
    }>;
    updateMatrixWorld: Schema.declare<UpdateMatrixWorld, UpdateMatrixWorld, readonly [], never>;
}>>;
export type LightTargetPort = Schema.Schema.Type<typeof LightTargetPortSchema>;
export declare const LightPortSchema: Schema.mutable<Schema.Struct<{
    intensity: typeof Schema.Number;
    castShadow: typeof Schema.Boolean;
    color: Schema.declare<ColorPort, ColorPort, readonly [], never>;
    position: Schema.Struct<{
        x: typeof Schema.Number;
        y: typeof Schema.Number;
        z: typeof Schema.Number;
        set: Schema.declare<Vec3Set, Vec3Set, readonly [], never>;
    }>;
    target: Schema.mutable<Schema.Struct<{
        position: Schema.Struct<{
            set: Schema.declare<Vec3Set, Vec3Set, readonly [], never>;
        }>;
        updateMatrixWorld: Schema.declare<UpdateMatrixWorld, UpdateMatrixWorld, readonly [], never>;
    }>>;
    shadow: Schema.mutable<Schema.Struct<{
        camera: Schema.mutable<Schema.Struct<{
            far: typeof Schema.Number;
            left: typeof Schema.Number;
            right: typeof Schema.Number;
            top: typeof Schema.Number;
            bottom: typeof Schema.Number;
            updateProjectionMatrix: Schema.declare<UpdateProjectionMatrix, UpdateProjectionMatrix, readonly [], never>;
        }>>;
    }>>;
}>>;
export type LightPort = Schema.Schema.Type<typeof LightPortSchema>;
export declare const AmbientLightPortSchema: Schema.mutable<Schema.Struct<{
    intensity: typeof Schema.Number;
    color: Schema.declare<ColorPort, ColorPort, readonly [], never>;
}>>;
export type AmbientLightPort = Schema.Schema.Type<typeof AmbientLightPortSchema>;
export declare const RendererPortSchema: Schema.mutable<Schema.Struct<{
    setClearColor: Schema.declare<ClearColor, ClearColor, readonly [], never>;
}>>;
export type RendererPort = Schema.Schema.Type<typeof RendererPortSchema>;
export declare const SkyMaterialPortSchema: Schema.mutable<Schema.Struct<{
    uniforms: Schema.mutable<Schema.Struct<{
        sunPosition: Schema.mutable<Schema.Struct<{
            value: Schema.mutable<Schema.Struct<{
                set: Schema.declare<SkyUniformSet, SkyUniformSet, readonly [], never>;
            }>>;
        }>>;
        turbidity: Schema.mutable<Schema.Struct<{
            value: typeof Schema.Number;
        }>>;
        rayleigh: Schema.mutable<Schema.Struct<{
            value: typeof Schema.Number;
        }>>;
    }>>;
}>>;
export type SkyMaterialPort = Schema.Schema.Type<typeof SkyMaterialPortSchema>;
declare const DayNightLightsPortSchemaBase: Schema.mutable<Schema.Struct<{
    light: Schema.mutable<Schema.Struct<{
        intensity: typeof Schema.Number;
        castShadow: typeof Schema.Boolean;
        color: Schema.declare<ColorPort, ColorPort, readonly [], never>;
        position: Schema.Struct<{
            x: typeof Schema.Number;
            y: typeof Schema.Number;
            z: typeof Schema.Number;
            set: Schema.declare<Vec3Set, Vec3Set, readonly [], never>;
        }>;
        target: Schema.mutable<Schema.Struct<{
            position: Schema.Struct<{
                set: Schema.declare<Vec3Set, Vec3Set, readonly [], never>;
            }>;
            updateMatrixWorld: Schema.declare<UpdateMatrixWorld, UpdateMatrixWorld, readonly [], never>;
        }>>;
        shadow: Schema.mutable<Schema.Struct<{
            camera: Schema.mutable<Schema.Struct<{
                far: typeof Schema.Number;
                left: typeof Schema.Number;
                right: typeof Schema.Number;
                top: typeof Schema.Number;
                bottom: typeof Schema.Number;
                updateProjectionMatrix: Schema.declare<UpdateProjectionMatrix, UpdateProjectionMatrix, readonly [], never>;
            }>>;
        }>>;
    }>>;
    ambientLight: Schema.mutable<Schema.Struct<{
        intensity: typeof Schema.Number;
        color: Schema.declare<ColorPort, ColorPort, readonly [], never>;
    }>>;
    renderer: Schema.mutable<Schema.Struct<{
        setClearColor: Schema.declare<ClearColor, ClearColor, readonly [], never>;
    }>>;
    skyNight: Schema.declare<ColorPort, ColorPort, readonly [], never>;
    skyDay: Schema.declare<ColorPort, ColorPort, readonly [], never>;
    skyCurrent: Schema.declare<ColorPort, ColorPort, readonly [], never>;
    sky: Schema.declare<Option.Option<{
        uniforms: {
            sunPosition: {
                value: {
                    set: SkyUniformSet;
                };
            };
            turbidity: {
                value: number;
            };
            rayleigh: {
                value: number;
            };
        };
    }>, Option.Option<{
        uniforms: {
            sunPosition: {
                value: {
                    set: SkyUniformSet;
                };
            };
            turbidity: {
                value: number;
            };
            rayleigh: {
                value: number;
            };
        };
    }>, readonly [], never>;
}>>;
export declare const DayNightLightsPortSchema: Schema.mutable<Schema.Struct<{
    light: Schema.mutable<Schema.Struct<{
        intensity: typeof Schema.Number;
        castShadow: typeof Schema.Boolean;
        color: Schema.declare<ColorPort, ColorPort, readonly [], never>;
        position: Schema.Struct<{
            x: typeof Schema.Number;
            y: typeof Schema.Number;
            z: typeof Schema.Number;
            set: Schema.declare<Vec3Set, Vec3Set, readonly [], never>;
        }>;
        target: Schema.mutable<Schema.Struct<{
            position: Schema.Struct<{
                set: Schema.declare<Vec3Set, Vec3Set, readonly [], never>;
            }>;
            updateMatrixWorld: Schema.declare<UpdateMatrixWorld, UpdateMatrixWorld, readonly [], never>;
        }>>;
        shadow: Schema.mutable<Schema.Struct<{
            camera: Schema.mutable<Schema.Struct<{
                far: typeof Schema.Number;
                left: typeof Schema.Number;
                right: typeof Schema.Number;
                top: typeof Schema.Number;
                bottom: typeof Schema.Number;
                updateProjectionMatrix: Schema.declare<UpdateProjectionMatrix, UpdateProjectionMatrix, readonly [], never>;
            }>>;
        }>>;
    }>>;
    ambientLight: Schema.mutable<Schema.Struct<{
        intensity: typeof Schema.Number;
        color: Schema.declare<ColorPort, ColorPort, readonly [], never>;
    }>>;
    renderer: Schema.mutable<Schema.Struct<{
        setClearColor: Schema.declare<ClearColor, ClearColor, readonly [], never>;
    }>>;
    skyNight: Schema.declare<ColorPort, ColorPort, readonly [], never>;
    skyDay: Schema.declare<ColorPort, ColorPort, readonly [], never>;
    skyCurrent: Schema.declare<ColorPort, ColorPort, readonly [], never>;
    sky: Schema.declare<Option.Option<{
        uniforms: {
            sunPosition: {
                value: {
                    set: SkyUniformSet;
                };
            };
            turbidity: {
                value: number;
            };
            rayleigh: {
                value: number;
            };
        };
    }>, Option.Option<{
        uniforms: {
            sunPosition: {
                value: {
                    set: SkyUniformSet;
                };
            };
            turbidity: {
                value: number;
            };
            rayleigh: {
                value: number;
            };
        };
    }>, readonly [], never>;
}>>;
type DayNightLightsPortBase = Schema.Schema.Type<typeof DayNightLightsPortSchemaBase>;
export type DayNightLightsPort = Omit<DayNightLightsPortBase, 'sky'> & {
    readonly sky: Option.Option<SkyMaterialPort>;
};
//# sourceMappingURL=day-night-port.d.ts.map