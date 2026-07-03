import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { PLAYER_HALF_HEIGHT } from '@ts-minecraft/core'
import { createVehicleVisual } from '../infrastructure/player/vehicle-visual'

const findRoot = (scene: THREE.Scene): THREE.Group => {
  const root = scene.getObjectByName('vehicle-visual')
  expect(root).toBeDefined()
  return root as THREE.Group
}

describe('vehicle-visual', () => {
  it('adds a hidden root group to the scene', () => {
    const scene = new THREE.Scene()
    createVehicleVisual(scene)
    expect(findRoot(scene).visible).toBe(false)
  })

  it('shows the boat body at the feet position, rotated by yaw', () => {
    const scene = new THREE.Scene()
    const visual = createVehicleVisual(scene)
    visual.update('boat', { x: 10, y: 64.9, z: -3 }, Math.PI / 2)
    const root = findRoot(scene)
    expect(root.visible).toBe(true)
    expect(root.position.x).toBe(10)
    expect(root.position.y).toBeCloseTo(64.9 - PLAYER_HALF_HEIGHT - 0.05)
    expect(root.position.z).toBe(-3)
    expect(root.rotation.y).toBeCloseTo(Math.PI / 2)
    const [boat, minecart] = root.children
    expect(boat!.visible).toBe(true)
    expect(minecart!.visible).toBe(false)
  })

  it('switches bodies when the kind changes and hides on null', () => {
    const scene = new THREE.Scene()
    const visual = createVehicleVisual(scene)
    visual.update('boat', { x: 0, y: 64, z: 0 }, 0)
    visual.update('minecart', { x: 0, y: 64, z: 0 }, 0)
    const root = findRoot(scene)
    const [boat, minecart] = root.children
    expect(boat!.visible).toBe(false)
    expect(minecart!.visible).toBe(true)
    visual.update(null, { x: 0, y: 64, z: 0 }, 0)
    expect(root.visible).toBe(false)
  })
})
