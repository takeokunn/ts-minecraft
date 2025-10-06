/**
 * Camera Domain Services Layer
 *
 * 全カメラドメインサービスの統合Layer
 */

import { Layer } from 'effect'
import {
  AnimationEngineServiceLive,
  CameraControlServiceLive,
  CollisionDetectionServiceLive,
  SettingsValidatorServiceLive,
  ViewModeManagerServiceLive,
} from './camera_control'

/**
 * 全カメラドメインサービスの統合Layer
 *
 * この単一のLayerを提供することで、すべてのカメラ
 * ドメインサービスを一度に利用可能にします。
 */
export const CameraDomainServicesLayer = Layer.mergeAll(
  CameraControlServiceLive,
  AnimationEngineServiceLive,
  CollisionDetectionServiceLive,
  SettingsValidatorServiceLive,
  ViewModeManagerServiceLive
)
