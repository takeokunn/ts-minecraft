import { ChunkLifecycleProviderLive } from '@/domain/chunk_manager/domain_service'
import { ChunkLifecycleProvider as ChunkLifecycleProviderTag } from '@/domain/chunk_manager/types'
import type { Layer } from 'effect'

export const ChunkLifecycleProviderLayer: Layer<never, never, typeof ChunkLifecycleProviderTag> =
  ChunkLifecycleProviderLive
