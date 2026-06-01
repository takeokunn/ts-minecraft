type EnvLike = {
  readonly DEV?: boolean
}

type ProcessLike = {
  readonly env?: { readonly NODE_ENV?: string }
}

export const getUnknownProperty = (value: object, key: PropertyKey): unknown => Reflect.get(value, key)

const isEnvLike = (value: unknown): value is EnvLike =>
  typeof value === 'object' &&
  value !== null &&
  (getUnknownProperty(value, 'DEV') === undefined || typeof getUnknownProperty(value, 'DEV') === 'boolean')

const isProcessLike = (value: unknown): value is ProcessLike => {
  if (typeof value !== 'object' || value === null) return false
  const env = getUnknownProperty(value, 'env')
  if (env === undefined) return true
  return (
    typeof env === 'object' &&
    env !== null &&
    (getUnknownProperty(env, 'NODE_ENV') === undefined || typeof getUnknownProperty(env, 'NODE_ENV') === 'string')
  )
}

export const isQaApiEnabled = (): boolean => {
  const qaApiEnv = getUnknownProperty(import.meta, 'env')
  const qaApiProcess = getUnknownProperty(globalThis, 'process')
  const isViteDev = isEnvLike(qaApiEnv) && qaApiEnv.DEV === true
  const isNodeDev = isProcessLike(qaApiProcess) && qaApiProcess.env?.NODE_ENV === 'development'
  return isViteDev || isNodeDev
}
