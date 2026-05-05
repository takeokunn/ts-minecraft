// Structural port for the scene lighting objects manipulated by the day/night cycle.
// Duck-typed — no Three.js import required. Any Three.js objects satisfying this
// shape will work, keeping the application layer free from rendering infrastructure.
import { Option, Schema } from 'effect';
export { Option };
const hasFunctionProperty = (value, key) => key in value && typeof value[key] === 'function';
const hasNumberProperty = (value, key) => key in value && typeof Reflect.get(value, key) === 'number';
export const ColorPortSchema = Schema.declare((u) => typeof u === 'object' &&
    u !== null &&
    hasNumberProperty(u, 'r') &&
    hasNumberProperty(u, 'g') &&
    hasNumberProperty(u, 'b') &&
    hasFunctionProperty(u, 'setHSL') &&
    hasFunctionProperty(u, 'lerpColors'));
export const LightTargetPortSchema = Schema.mutable(Schema.Struct({
    position: Schema.Struct({
        set: Schema.declare((u) => typeof u === 'function'),
    }),
    updateMatrixWorld: Schema.declare((u) => typeof u === 'function'),
}));
export const LightPortSchema = Schema.mutable(Schema.Struct({
    intensity: Schema.Number,
    castShadow: Schema.Boolean,
    color: ColorPortSchema,
    position: Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
        z: Schema.Number,
        set: Schema.declare((u) => typeof u === 'function'),
    }),
    target: LightTargetPortSchema,
    shadow: Schema.mutable(Schema.Struct({
        camera: Schema.mutable(Schema.Struct({
            far: Schema.Number,
            left: Schema.Number,
            right: Schema.Number,
            top: Schema.Number,
            bottom: Schema.Number,
            updateProjectionMatrix: Schema.declare((u) => typeof u === 'function'),
        })),
    })),
}));
export const AmbientLightPortSchema = Schema.mutable(Schema.Struct({
    intensity: Schema.Number,
    color: ColorPortSchema,
}));
export const RendererPortSchema = Schema.mutable(Schema.Struct({
    setClearColor: Schema.declare((u) => typeof u === 'function'),
}));
export const SkyMaterialPortSchema = Schema.mutable(Schema.Struct({
    uniforms: Schema.mutable(Schema.Struct({
        sunPosition: Schema.mutable(Schema.Struct({
            value: Schema.mutable(Schema.Struct({
                set: Schema.declare((u) => typeof u === 'function'),
            })),
        })),
        turbidity: Schema.mutable(Schema.Struct({
            value: Schema.Number,
        })),
        rayleigh: Schema.mutable(Schema.Struct({
            value: Schema.Number,
        })),
    })),
}));
const DayNightLightsPortSchemaBase = Schema.mutable(Schema.Struct({
    light: LightPortSchema,
    ambientLight: AmbientLightPortSchema,
    renderer: RendererPortSchema,
    skyNight: ColorPortSchema,
    skyDay: ColorPortSchema,
    skyCurrent: ColorPortSchema,
    sky: Schema.declare((u) => typeof u === 'object' && u !== null && '_tag' in u),
}));
export const DayNightLightsPortSchema = DayNightLightsPortSchemaBase;
//# sourceMappingURL=day-night-port.js.map