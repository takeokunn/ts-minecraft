/**
 * Camera Application Services Layer
 *
 * 全Camera Application Serviceの統合Layer
 */

import { Layer } from 'effect'
import { CameraModeManagerApplicationServiceLive } from './camera_mode_manager/index'
import { CameraSystemOrchestratorServiceLive } from './camera_system_orchestrator/index'
import { PlayerCameraApplicationServiceLive } from './player_camera/index'
import { SceneCameraApplicationServiceLive } from './scene_camera/index'

/**
 * 全Camera Application Serviceの統合Layer
 *
 * 4つのApplication Serviceを統合した単一のLayerを提供します。
 * この統合Layerにより、カメラドメインの全ユースケースが利用可能になります。
 */
export const CameraApplicationServicesLayer = Layer.mergeAll(
  PlayerCameraApplicationServiceLive,
  SceneCameraApplicationServiceLive,
  CameraModeManagerApplicationServiceLive,
  CameraSystemOrchestratorServiceLive
)
