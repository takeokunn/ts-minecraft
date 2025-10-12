import type { CameraProjection, CameraSnapshot, CameraTransform } from '@domain/camera/types'
import { Effect } from 'effect'
import * as THREE from 'three'
import type { CameraError } from '../errors'
import { createPerspectiveCamera, type PerspectiveCameraParams } from './perspective_camera'

const toParams = (snapshot: CameraSnapshot): PerspectiveCameraParams => ({
  fov: snapshot.projection.fov,
  aspect: snapshot.projection.aspect,
  near: snapshot.projection.near,
  far: snapshot.projection.far,
})

export const createPerspectiveCameraFromSnapshot = (
  snapshot: CameraSnapshot
): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
  Effect.gen(function* () {
    const camera = yield* createPerspectiveCamera(toParams(snapshot))
    yield* applySnapshotToPerspectiveCamera(camera, snapshot)
    return camera
  })

export const applySnapshotToPerspectiveCamera = (
  camera: THREE.PerspectiveCamera,
  snapshot: CameraSnapshot
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    camera.fov = snapshot.projection.fov
    camera.aspect = snapshot.projection.aspect
    camera.near = snapshot.projection.near
    camera.far = snapshot.projection.far
    camera.updateProjectionMatrix()

    camera.position.set(snapshot.transform.position.x, snapshot.transform.position.y, snapshot.transform.position.z)

    const quaternion = snapshot.transform.orientation.quaternion
    camera.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w)

    const target = snapshot.transform.target
    camera.lookAt(target.x, target.y, target.z)
  })

export const toThreeCamera = (
  projection: CameraProjection,
  transform: CameraTransform
): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
  createPerspectiveCameraFromSnapshot({
    projection,
    transform,
  })
