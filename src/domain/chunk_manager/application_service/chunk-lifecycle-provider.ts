import type { Layer } from 'effect'
import { ChunkLifecycleProvider as ChunkLifecycleProviderTag } from '../types/interfaces'
import { ChunkLifecycleProviderLive } from '../domain_service/lifecycle-manager'

export const ChunkLifecycleProviderLayer: Layer<never, never, typeof ChunkLifecycleProviderTag> =
  ChunkLifecycleProviderLive
