import type { CameraSnapshot } from '@domain/camera/types'
import { makeCameraSync } from '@domain/camera/types'
import type { Camera } from '../aggregate/camera/camera'

const degToRad = (value: number): number => (value * Math.PI) / 180

const rotationToQuaternion = (rotation: { readonly pitch: number; readonly yaw: number; readonly roll: number }) => {
  const halfPitch = degToRad(rotation.pitch) / 2
  const halfYaw = degToRad(rotation.yaw) / 2
  const halfRoll = degToRad(rotation.roll) / 2

  const sinPitch = Math.sin(halfPitch)
  const cosPitch = Math.cos(halfPitch)
  const sinYaw = Math.sin(halfYaw)
  const cosYaw = Math.cos(halfYaw)
  const sinRoll = Math.sin(halfRoll)
  const cosRoll = Math.cos(halfRoll)

  return {
    x: sinRoll * cosPitch * cosYaw - cosRoll * sinPitch * sinYaw,
    y: cosRoll * sinPitch * cosYaw + sinRoll * cosPitch * sinYaw,
    z: cosRoll * cosPitch * sinYaw - sinRoll * sinPitch * cosYaw,
    w: cosRoll * cosPitch * cosYaw + sinRoll * sinPitch * sinYaw,
  }
}

const forwardVector = (rotation: { readonly pitch: number; readonly yaw: number }) => {
  const pitchRad = degToRad(rotation.pitch)
  const yawRad = degToRad(rotation.yaw)

  const x = Math.sin(yawRad) * Math.cos(pitchRad)
  const y = Math.sin(pitchRad)
  const z = Math.cos(yawRad) * Math.cos(pitchRad)

  return { x, y, z }
}

export const cameraToSnapshot = (camera: Camera): CameraSnapshot => {
  const position = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  }

  const quaternion = rotationToQuaternion({
    pitch: camera.rotation.pitch,
    yaw: camera.rotation.yaw,
    roll: camera.rotation.roll,
  })

  const forward = forwardVector({ pitch: camera.rotation.pitch, yaw: camera.rotation.yaw })
  const target = {
    x: camera.position.x + forward.x,
    y: camera.position.y + forward.y,
    z: camera.position.z + forward.z,
  }

  return makeCameraSync({
    projection: {
      fov: camera.settings.fov,
      aspect: camera.settings.aspectRatio,
      near: camera.settings.nearPlane,
      far: camera.settings.farPlane,
    },
    transform: {
      position,
      target,
      orientation: {
        rotation: {
          pitch: camera.rotation.pitch,
          yaw: camera.rotation.yaw,
          roll: camera.rotation.roll,
        },
        quaternion,
      },
    },
  })
}
