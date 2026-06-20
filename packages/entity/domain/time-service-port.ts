import { Effect } from 'effect'

// Minimal port covering only the subset of TimeService used by MobSpawner.
// The game package's TimeService satisfies this interface; tests supply stubs.
export class TimeServicePort extends Effect.Service<TimeServicePort>()(
  '@minecraft/entity/domain/TimeServicePort',
  {
    /* c8 ignore next */
    succeed: {
      /* c8 ignore next */
      isNight: (): Effect.Effect<boolean, never> => Effect.succeed(false),
    },
  },
) {}
