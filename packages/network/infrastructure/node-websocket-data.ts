import { Buffer } from 'node:buffer'
import type { RawData } from 'ws'

const copyBytes = (data: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(data.byteLength)
  new Uint8Array(buffer).set(data)
  return buffer
}

export const rawDataToArrayBuffer = (data: RawData): ArrayBuffer => {
  if (data instanceof ArrayBuffer) {
    return data.slice(0)
  }
  if (Array.isArray(data)) {
    return copyBytes(Buffer.concat(data))
  }
  return copyBytes(data)
}
