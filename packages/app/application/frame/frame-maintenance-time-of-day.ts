import { Effect } from 'effect'

type MaintenanceTimeService = {
  readonly getTimeOfDay: () => Effect.Effect<number, never>
}

export const resolveMaintenanceTimeOfDay = (
  timeService: MaintenanceTimeService,
  shouldResolveTimeOfDay: boolean,
): Effect.Effect<number, never> =>
  shouldResolveTimeOfDay
    ? timeService.getTimeOfDay().pipe(Effect.catchAllCause(() => Effect.succeed(0.5)))
    : Effect.succeed(0.5)
