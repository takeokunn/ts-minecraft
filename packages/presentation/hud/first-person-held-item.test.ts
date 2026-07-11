import { Effect } from 'effect'
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { StackCount, type InventoryItem } from '@ts-minecraft/core'
import { createFirstPersonHeldItemPresenter } from './first-person-held-item'

const selected = (item: InventoryItem) => ({ item, count: StackCount.make(1) })

describe('FirstPersonHeldItemPresenter', () => {
  it('renders the exact scene and camera owned by the presenter', () => {
    const renderOverlay = vi.fn(() => Effect.void)
    const presenter = createFirstPersonHeldItemPresenter(
      { renderOverlay },
      new THREE.Texture(),
      800,
      600,
    )
    const renderer = {} as THREE.WebGLRenderer

    presenter.replace(selected('GRASS'))
    Effect.runSync(presenter.render(renderer))
    Effect.runSync(presenter.render(renderer, 0.8))

    const firstCall = renderOverlay.mock.calls[0]
    const secondCall = renderOverlay.mock.calls[1]
    expect(firstCall?.[0]).toBe(renderer)
    expect(firstCall?.[1]).toBe(secondCall?.[1])
    expect(firstCall?.[2]).toBe(secondCall?.[2])
    expect(firstCall?.[1].children).toHaveLength(1)
  })

  it('replaces models by object reference and disposes the removed resources', () => {
    const renderOverlay = vi.fn(() => Effect.void)
    const presenter = createFirstPersonHeldItemPresenter({ renderOverlay }, new THREE.Texture())
    const renderer = {} as THREE.WebGLRenderer

    presenter.replace(selected('GRASS'))
    Effect.runSync(presenter.render(renderer))
    const scene = renderOverlay.mock.calls[0]?.[1]
    const firstGroup = scene?.children[0] as THREE.Group
    const firstMesh = firstGroup.children[0] as THREE.Mesh
    const geometryDispose = vi.spyOn(firstMesh.geometry, 'dispose')
    const material = firstMesh.material as THREE.Material
    const materialDispose = vi.spyOn(material, 'dispose')

    presenter.replace(selected('STONE'))
    Effect.runSync(presenter.render(renderer))

    expect(scene?.children).toHaveLength(1)
    expect(scene?.children[0]).not.toBe(firstGroup)
    expect(scene?.children).not.toContain(firstGroup)
    expect(geometryDispose).toHaveBeenCalledOnce()
    expect(materialDispose).toHaveBeenCalledOnce()
  })

  it('removes the model and suppresses rendering after replace(null)', () => {
    const renderOverlay = vi.fn(() => Effect.void)
    const presenter = createFirstPersonHeldItemPresenter({ renderOverlay }, new THREE.Texture())
    const renderer = {} as THREE.WebGLRenderer

    presenter.replace(selected('GRASS'))
    Effect.runSync(presenter.render(renderer))
    const scene = renderOverlay.mock.calls[0]?.[1]
    presenter.replace(null)
    Effect.runSync(presenter.render(renderer))

    expect(scene?.children).toHaveLength(0)
    expect(renderOverlay).toHaveBeenCalledOnce()
  })

  it('keeps camera identity while resize updates its aspect', () => {
    const renderOverlay = vi.fn(() => Effect.void)
    const presenter = createFirstPersonHeldItemPresenter({ renderOverlay }, new THREE.Texture())
    const renderer = {} as THREE.WebGLRenderer
    presenter.replace(selected('GRASS'))

    Effect.runSync(presenter.render(renderer))
    const camera = renderOverlay.mock.calls[0]?.[2] as THREE.PerspectiveCamera
    presenter.resize(390, 844)
    Effect.runSync(presenter.render(renderer))

    expect(renderOverlay.mock.calls[1]?.[2]).toBe(camera)
    expect(camera.aspect).toBeCloseTo(390 / 844)
  })
})
