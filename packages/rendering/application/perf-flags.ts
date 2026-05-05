// Feature flag: performance profiling is active when `?debug=perf` is in the URL.
// Evaluated once at module load time (constant). Application layer — safe to import
// from presentation or infrastructure.
export const PERF_ENABLED: boolean =
  typeof window !== 'undefined' &&
  typeof performance !== 'undefined' &&
  new URLSearchParams(window.location.search).get('debug') === 'perf'

export const isPerfEnabled = (): boolean => PERF_ENABLED
