import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import { shouldContinueMaintenanceCycle } from './frame-maintenance-cycle.plan'

describe('frame-maintenance / maintenance cycle continuation plan', () => {
  it('continues when chunk loading made progress', () => {
    expect(
      shouldContinueMaintenanceCycle({
        didLoadChunks: true,
        chunkSyncPending: false,
        flushedDirtyChunkCount: 0,
        simulationResult: {
          despawnedCount: 0,
          spawnResult: Option.none(),
        },
      }),
    ).toBe(true)
  })

  it('continues when simulation changed the world even if sync stayed idle', () => {
    expect(
      shouldContinueMaintenanceCycle({
        didLoadChunks: false,
        chunkSyncPending: false,
        flushedDirtyChunkCount: 0,
        simulationResult: {
          despawnedCount: 2,
          spawnResult: Option.some('entity-id'),
        },
      }),
    ).toBe(true)
  })

  it('stops only when every maintenance step was idle', () => {
    expect(
      shouldContinueMaintenanceCycle({
        didLoadChunks: false,
        chunkSyncPending: false,
        flushedDirtyChunkCount: 0,
        simulationResult: {
          despawnedCount: 0,
          spawnResult: Option.none(),
        },
      }),
    ).toBe(false)
  })
})
