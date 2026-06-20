// Performance boundary: plain for-loop avoids array allocation per hash.
export const hashString = (source: string): number => {
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}
