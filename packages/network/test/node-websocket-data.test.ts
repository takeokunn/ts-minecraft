import { describe, it } from '@effect/vitest'
import { Buffer } from 'node:buffer'
import { expect } from 'vitest'
import { rawDataToArrayBuffer } from '../infrastructure/node-websocket-data'

const bytesOf = (buffer: ArrayBuffer): number[] => Array.from(new Uint8Array(buffer))

describe('network/node-websocket-data', () => {
  it('copies ArrayBuffer payloads without sharing memory', () => {
    const source = new Uint8Array([1, 2, 3])
    const converted = rawDataToArrayBuffer(source.buffer)

    source[0] = 9

    expect(bytesOf(converted)).toEqual([1, 2, 3])
  })

  it('copies Buffer payloads into standalone ArrayBuffers', () => {
    const source = Buffer.from([4, 5, 6])
    const converted = rawDataToArrayBuffer(source)

    source[0] = 9

    expect(bytesOf(converted)).toEqual([4, 5, 6])
  })

  it('concatenates multipart Buffer payloads', () => {
    const converted = rawDataToArrayBuffer([Buffer.from([7]), Buffer.from([8, 9])])

    expect(bytesOf(converted)).toEqual([7, 8, 9])
  })
})
