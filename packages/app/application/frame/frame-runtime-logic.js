import { Option } from 'effect';
import { ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD } from '@ts-minecraft/app/frame-handler.config';
export const captureCameraPose = (camera, version) => {
    const projection = camera.projectionMatrix.elements;
    return {
        version,
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        qx: camera.quaternion.x,
        qy: camera.quaternion.y,
        qz: camera.quaternion.z,
        qw: camera.quaternion.w,
        p0: projection[0] ?? Number.NaN,
        p5: projection[5] ?? Number.NaN,
        p10: projection[10] ?? Number.NaN,
        p14: projection[14] ?? Number.NaN,
    };
};
export const hasCameraPoseChanged = (previous, current) => previous.version !== current.version
    || previous.x !== current.x
    || previous.y !== current.y
    || previous.z !== current.z
    || previous.qx !== current.qx
    || previous.qy !== current.qy
    || previous.qz !== current.qz
    || previous.qw !== current.qw
    || previous.p0 !== current.p0
    || previous.p5 !== current.p5
    || previous.p10 !== current.p10
    || previous.p14 !== current.p14;
export const advanceFixedStep = (accumulated, deltaTime, intervalSeconds) => {
    const nextAccumulated = accumulated + deltaTime;
    const ticks = Math.floor(nextAccumulated / intervalSeconds);
    return {
        ticks,
        remainder: nextAccumulated - ticks * intervalSeconds,
    };
};
const nextGraphicsQuality = (graphicsQuality) => graphicsQuality === 'ultra'
    ? 'high'
    : graphicsQuality === 'high'
        ? 'medium'
        : 'low';
const noChange = (cooldown) => ({ nextCooldown: cooldown, settingsPatch: Option.none() });
export const decideAdaptiveQuality = ({ adaptivePerformanceMode, graphicsQuality, renderDistance, fps, cooldown, }) => {
    if (!adaptivePerformanceMode) {
        return noChange(cooldown);
    }
    if (cooldown > 0) {
        return noChange(cooldown - 1);
    }
    if (fps <= 0 || fps >= ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD) {
        return noChange(cooldown);
    }
    if (graphicsQuality !== 'low') {
        return {
            nextCooldown: 20,
            settingsPatch: Option.some({ graphicsQuality: nextGraphicsQuality(graphicsQuality) }),
        };
    }
    // Lower view distance even while chunk sync is draining; waiting keeps cold-load
    // worlds stuck in the most expensive state for too long.
    if (renderDistance > 4) {
        return {
            nextCooldown: 20,
            settingsPatch: Option.some({ renderDistance: renderDistance - 1 }),
        };
    }
    return noChange(cooldown);
};
//# sourceMappingURL=../../../../dist/packages/app/application/frame/frame-runtime-logic.js.map