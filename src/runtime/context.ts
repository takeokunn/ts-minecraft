import { Context, Ref } from 'effect'
import type { World } from './world-pure'

export class WorldContext extends Context.Tag('WorldContext')<
  WorldContext,
  {
    readonly world: Ref.Ref<World>
  }
>() {}
