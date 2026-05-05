import { Schema } from 'effect';
export declare const CameraRotationSchema: Schema.Struct<{
    yaw: Schema.filter<typeof Schema.Number>;
    pitch: Schema.filter<Schema.filter<typeof Schema.Number>>;
}>;
export type CameraRotation = Schema.Schema.Type<typeof CameraRotationSchema>;
export declare const CameraModeSchema: Schema.Union<[Schema.Literal<["firstPerson"]>, Schema.Literal<["thirdPerson"]>]>;
export type CameraMode = Schema.Schema.Type<typeof CameraModeSchema>;
export declare const PITCH_MIN: number;
export declare const PITCH_MAX: number;
//# sourceMappingURL=camera-state.d.ts.map