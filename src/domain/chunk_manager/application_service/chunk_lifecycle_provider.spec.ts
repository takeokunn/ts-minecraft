import { describe, expect, it } from '@effect/vitest'
import { ChunkLifecycleProviderLive } from '../domain_service/lifecycle_manager'
import { ChunkLifecycleProviderLayer } from './chunk_lifecycle_provider'

describe('chunk_manager/application_service/chunk_lifecycle_provider', () => {
  it('exports domain service layer as-is', () => {
    expect(ChunkLifecycleProviderLayer).toBe(ChunkLifecycleProviderLive)
  })
})
