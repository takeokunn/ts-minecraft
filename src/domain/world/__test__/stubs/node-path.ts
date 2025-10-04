export const NodePath = {
  join: (...parts: readonly string[]) => parts.join('/'),
  dirname: (path: string) => path.split('/').slice(0, -1).join('/') || '.',
  basename: (path: string) => path.split('/').pop() ?? '',
  resolve: (...parts: readonly string[]) => parts.join('/'),
} as const

export default NodePath
