import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  ensureFirstPersonHand,
  updateFirstPersonHandSwing,
} from '@ts-minecraft/rendering/infrastructure/viewmodel/first-person-hand'

describe('first person hand viewmodel', () => {
  it('attaches the hand group to the camera exactly once', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const first = ensureFirstPersonHand(camera, scene)
    const second = ensureFirstPersonHand(camera, scene)
    expect(second).toBe(first)
    expect(camera.children.filter((c) => c.name === 'first-person-hand')).toHaveLength(1)
  })

  it('adds the camera to the scene so the hand renders', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    ensureFirstPersonHand(camera, scene)
    expect(camera.parent).toBe(scene)
  })

  it('does not reparent a camera that is already in a scene graph', () => {
    const scene = new THREE.Scene()
    const rig = new THREE.Group()
    scene.add(rig)
    const camera = new THREE.PerspectiveCamera()
    rig.add(camera)
    ensureFirstPersonHand(camera, scene)
    expect(camera.parent).toBe(rig)
  })

  it('contains a blocky arm mesh', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const hand = ensureFirstPersonHand(camera, scene)
    expect(hand.getObjectByName('first-person-hand-arm')).toBeInstanceOf(THREE.Mesh)
  })

  it('rests at the base pose when the swing amount is 0', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const hand = ensureFirstPersonHand(camera, scene)
    const restRotationX = hand.rotation.x
    const restPositionZ = hand.position.z
    updateFirstPersonHandSwing(hand, 0.8)
    updateFirstPersonHandSwing(hand, 0)
    expect(hand.rotation.x).toBeCloseTo(restRotationX, 6)
    expect(hand.position.z).toBeCloseTo(restPositionZ, 6)
  })

  it('chops forward-and-down as the swing progresses', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const hand = ensureFirstPersonHand(camera, scene)
    const restRotationX = hand.rotation.x
    const restPositionZ = hand.position.z
    updateFirstPersonHandSwing(hand, 1)
    expect(hand.rotation.x).toBeLessThan(restRotationX) // pitched down
    expect(hand.position.z).toBeLessThan(restPositionZ) // pushed forward
  })
})
