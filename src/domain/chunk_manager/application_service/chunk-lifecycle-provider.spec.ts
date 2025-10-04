import { describe, expect, it } from '@effect/vitest'
import { ChunkLifecycleProviderLayer } from './chunk-lifecycle-provider'
import { ChunkLifecycleProviderLive } from '../domain_service/lifecycle-manager'

describe('chunk_manager/application_service/chunk_lifecycle_provider', () => {
  it('exports domain service layer as-is', () => {
    expect(ChunkLifecycleProviderLayer).toBe(ChunkLifecycleProviderLive)
  })
})
