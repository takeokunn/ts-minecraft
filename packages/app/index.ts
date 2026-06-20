// @ts-minecraft/app — composition root package
// Layer wiring, frame stages, presentation/UI, worker entry points

// Layer wiring (consumed by src/layers.ts + tests via @/layers)
export { MainLayers } from './application/main/layers'

// Boot + session (consumed by src/main.ts)
export { bootProgram } from './application/main/boot'
export type { BootContext } from './application/main/boot'
export { sessionProgram } from './application/main/session'

// QA helpers (used in E2E / debug builds)
export { installQaApi } from './application/main/qa-api'
export { installBrowserEventBridge } from './application/main/browser-runtime'
export { wrapFrameHandlerWithBrowserEffects } from './application/main/browser-runtime-effects'
