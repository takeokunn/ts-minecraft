import type { Layer } from 'effect'
import { ChunkLifecycleProviderLive } from '../domain_service/lifecycle_manager'
import { ChunkLifecycleProvider as ChunkLifecycleProviderTag } from '../types/interfaces'

export const ChunkLifecycleProviderLayer: Layer<never, never, typeof ChunkLifecycleProviderTag> =
  ChunkLifecycleProviderLive
