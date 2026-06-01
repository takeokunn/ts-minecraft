// @ts-minecraft/app — composition root package
// Layer wiring, frame stages, presentation/UI, worker entry points

// Frame handler (public API consumed by src/main.ts + tests)
export {
  createFrameHandlers,
} from './application/frame-handler'
export type {
  FrameHandlerDeps,
  FrameHandlerServices,
  FrameLoopHandlers,
} from './application/frame/types'

// Layer wiring (consumed by src/layers.ts + tests via @/layers)
export * from './application/main/layers'

// Boot + session (consumed by src/main.ts)
export { bootProgram } from './application/main/boot'
export type { BootContext } from './application/main/boot'
export { sessionProgram } from './application/main/session'

// QA helpers (used in E2E / debug builds)
export { installQaApi } from './application/main/qa-api'
export { installBrowserEventBridge, wrapFrameHandlerWithBrowserEffects } from './application/main/browser-runtime'
