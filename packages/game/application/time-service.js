import { Effect, Ref, Schema } from 'effect';
const TimeStateSchema = Schema.Struct({
    ticks: Schema.Number.pipe(Schema.nonNegative()),
    dayLengthTicks: Schema.Number.pipe(Schema.positive()),
});
// Time-of-day: 0.0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk. One tick = one frame ≈ 16ms at 60fps.
export class TimeService extends Effect.Service()('@minecraft/application/TimeService', {
    effect: Ref.make({
        ticks: 0,
        dayLengthTicks: 24000, // 400 seconds at 60fps
    }).pipe(Effect.map((stateRef) => ({
        advanceTick: (deltaTime) => Ref.update(stateRef, (state) => ({
            ...state,
            ticks: state.ticks + deltaTime * 60,
        })),
        getTimeOfDay: () => Ref.get(stateRef).pipe(Effect.map((state) => (state.ticks % state.dayLengthTicks) / state.dayLengthTicks)),
        isNight: () => Ref.get(stateRef).pipe(Effect.map((state) => {
            const timeOfDay = (state.ticks % state.dayLengthTicks) / state.dayLengthTicks;
            return timeOfDay < 0.25 || timeOfDay > 0.75;
        })),
        getDayLength: () => Ref.get(stateRef).pipe(Effect.map((state) => state.dayLengthTicks / 60)),
        setDayLength: (seconds) => Ref.update(stateRef, (state) => ({
            ...state,
            dayLengthTicks: Math.max(120, Math.min(1200, seconds)) * 60, // clamps to 120-1200s range
        })),
        setTimeOfDay: (fraction) => Ref.update(stateRef, (state) => ({
            ...state,
            ticks: Math.max(0, Math.min(0.9999, fraction)) * state.dayLengthTicks, // 0.9999 avoids exact midnight wrap
        })),
    })))
}) {
}
export const TimeServiceLive = TimeService.Default;
//# sourceMappingURL=time-service.js.map