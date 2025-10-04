import { describe, expect, it } from '@effect/vitest'
import { Option, Schema } from 'effect'
import { sceneManagerState } from './service'
import { SceneState as Scenes, SceneProgressSchema } from '../types'

describe('domain/scene/manager/service utilities', () => {
  it('sceneManagerState.make populates defaults', () => {
    const initial = Scenes.MainMenu()
    const state = sceneManagerState.make({ current: initial })
    expect(state.current).toStrictEqual(initial)
    expect(state.stack).toEqual([])
    expect(state.isTransitioning).toBe(false)
    expect(state.history).toStrictEqual([initial])
  })

  it('toOptionActive returns None for loading scenes', () => {
    const progress = Schema.decodeSync(SceneProgressSchema)(0.5)
    const loading = Scenes.Loading({ target: Scenes.MainMenu(), progress })
    const active = sceneManagerState.toOptionActive(loading)
    expect(Option.isNone(active)).toBe(true)
  })

  it('toOptionActive returns Some for active scenes', () => {
    const scene = Scenes.Settings()
    const active = sceneManagerState.toOptionActive(scene)
    expect(Option.isSome(active)).toBe(true)
  })
})
