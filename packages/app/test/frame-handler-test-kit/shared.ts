export type CameraMode = 'firstPerson' | 'thirdPerson'

export interface CameraStateStub {
  mode: CameraMode
}

export interface OverlayState {
  open: boolean
}

export const DEFAULT_SETTINGS = {
  renderDistance: 8,
  mouseSensitivity: 0.5,
  dayLengthSeconds: 400,
  difficulty: 'normal' as const,
  graphicsQuality: 'high' as const,
  adaptivePerformanceMode: false,
  audioEnabled: true,
  masterVolume: 0.8,
  sfxVolume: 1,
  musicVolume: 0.55,
}
