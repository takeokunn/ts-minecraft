import { Effect } from 'effect'

const noop = Effect.void

export const NodeFileSystem = {
  readFile: () => noop,
  writeFile: () => noop,
  mkdir: () => noop,
  rm: () => noop,
  exists: () => Effect.succeed(false),
  stat: () => Effect.fail(new Error('NodeFileSystem stub: stat not implemented')),
} as const

export default NodeFileSystem
