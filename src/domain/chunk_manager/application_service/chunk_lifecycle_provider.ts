import type { Layer } from 'effect'
import { ChunkLifecycleProviderLive } from '../domain_service'
import { ChunkLifecycleProvider as ChunkLifecycleProviderTag } from '../types'

export const ChunkLifecycleProviderLayer: Layer<never, never, typeof ChunkLifecycleProviderTag> =
  ChunkLifecycleProviderLive
