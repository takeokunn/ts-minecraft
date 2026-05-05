import { Schema } from 'effect';
export const CameraRotationSchema = Schema.Struct({
    yaw: Schema.Number.pipe(Schema.finite()),
    pitch: Schema.Number.pipe(Schema.finite(), Schema.between(-Math.PI / 2 + 0.01, Math.PI / 2 - 0.01)),
});
export const CameraModeSchema = Schema.Union(Schema.Literal('firstPerson'), Schema.Literal('thirdPerson'));
export const PITCH_MIN = -Math.PI / 2 + 0.01;
export const PITCH_MAX = Math.PI / 2 - 0.01;
//# sourceMappingURL=camera-state.js.map