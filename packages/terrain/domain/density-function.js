import { evaluateSpline } from './spline';
import { OFFSET_SPLINE, FACTOR_SPLINE, PV_OFFSET, JAGGED_AMP, } from './terrain-splines';
const MIN_Y = 1;
const MAX_Y = 250;
export const computeColumnYFromValues = (continentalness, erosion, pv, jaggedness) => {
    const c = continentalness;
    const e = erosion;
    const p = pv;
    const j = jaggedness;
    const offset = evaluateSpline(OFFSET_SPLINE, c);
    const factor = evaluateSpline(FACTOR_SPLINE, e);
    const pvOffset = evaluateSpline(PV_OFFSET, p);
    const jaggedAmp = evaluateSpline(JAGGED_AMP, e);
    const y = offset + factor * (pvOffset + j * jaggedAmp);
    const clamped = Math.max(MIN_Y, Math.min(MAX_Y, Math.round(y)));
    return clamped;
};
export const computeColumnY = (noises, x, z) => {
    const i = z * 16 + x;
    return computeColumnYFromValues(noises.continentalness[i], noises.erosion[i], noises.pv[i], noises.jaggedness[i]);
};
//# sourceMappingURL=../../../dist/packages/terrain/domain/density-function.js.map