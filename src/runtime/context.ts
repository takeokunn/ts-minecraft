import { Context, Ref } from 'effect'
import type { World } from '@/domain/world'

export class WorldContext extends Context.Tag('app/WorldContext')<
  WorldContext,
  {
    readonly world: Ref.Ref<World>
  }
>() {}
