import { describe, it } from '@effect/vitest'
import { afterEach, beforeEach, expect, vi } from 'vitest'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/worker'

type WorkerSelfMock = {
  postMessage: ReturnType<typeof vi.fn>
  onmessage: ((event: MessageEvent<unknown>) => void) | null
}

const makeChunkBuffer = (): ArrayBuffer => {
  const blocks = new Uint8Array(16 * 256 * 16)
  blocks[0] = 1
  return blocks.buffer
}

const makeWaterChunkBuffer = (): ArrayBuffer => {
  const blocks = new Uint8Array(16 * 256 * 16)
  blocks[0] = 6
  return blocks.buffer
}

const makeLightBuffer = (): ArrayBuffer => new Uint8Array(LIGHT_BYTE_LENGTH).buffer

const installWorkerSelf = (): WorkerSelfMock => {
  const selfMock: WorkerSelfMock = {
    postMessage: vi.fn(),
    onmessage: null,
  }

  Object.defineProperty(globalThis, 'self', {
    configurable: true,
    writable: true,
    value: selfMock,
  })

  return selfMock
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'self')
})

describe('infrastructure/meshing/meshing-worker', () => {
  it('registers a worker message handler and posts meshed chunk data for valid requests', async () => {
    const selfMock = installWorkerSelf()

    await import('../infrastructure/meshing/meshing-worker')

    expect(typeof selfMock.onmessage).toBe('function')

    selfMock.onmessage?.({
      data: {
        id: 7,
        blocks: makeChunkBuffer(),
        skyLight: null,
        blockLight: null,
        wx: 0,
        wz: 0,
        transparentBlockIds: [6],
      },
    } as MessageEvent<unknown>)

    expect(selfMock.postMessage).toHaveBeenCalledTimes(1)

    const message = selfMock.postMessage.mock.calls[0]?.[0] as {
      id: number
      opositions: Float32Array
      onormals: Float32Array
      ocolors: Uint8Array
      ouvs: Float32Array
      otileIndexes: Float32Array
      oindices: Uint32Array
      wpositions: Float32Array | null
      windices: Uint32Array | null
    }
    const transferList = selfMock.postMessage.mock.calls[0]?.[1] as ArrayBuffer[]

    expect(message.id).toBe(7)
    expect(message.opositions.length).toBeGreaterThan(0)
    expect(message.onormals.length).toBeGreaterThan(0)
    expect(message.ocolors.length).toBeGreaterThan(0)
    expect(message.ouvs.length).toBeGreaterThan(0)
    expect(message.otileIndexes.length).toBeGreaterThan(0)
    expect(message.oindices.length).toBeGreaterThan(0)
    expect(message.wpositions).toBeNull()
    expect(message.windices).toBeNull()
    expect(transferList).toHaveLength(6)
  })

  it('posts a failure response with the raw id when request decoding fails', async () => {
    const selfMock = installWorkerSelf()

    await import('../infrastructure/meshing/meshing-worker')

    selfMock.onmessage?.({
      data: {
        id: 11,
        blocks: null,
      },
    } as MessageEvent<unknown>)

    expect(selfMock.postMessage).toHaveBeenCalledTimes(1)
    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 11,
        kind: 'failure',
      })
    )
  })

  it('uses the fallback id for malformed requests without a finite numeric id', async () => {
    const selfMock = installWorkerSelf()

    await import('../infrastructure/meshing/meshing-worker')

    selfMock.onmessage?.({ data: null } as MessageEvent<unknown>)

    expect(selfMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: -1,
        kind: 'failure',
      })
    )
  })

  it('uses valid light buffers and transfers water geometry buffers when water is meshed', async () => {
    const selfMock = installWorkerSelf()

    await import('../infrastructure/meshing/meshing-worker')

    selfMock.onmessage?.({
      data: {
        id: 17,
        blocks: makeWaterChunkBuffer(),
        skyLight: makeLightBuffer(),
        blockLight: makeLightBuffer(),
        wx: 0,
        wz: 0,
        transparentBlockIds: [6],
      },
    } as MessageEvent<unknown>)

    const message = selfMock.postMessage.mock.calls[0]?.[0] as {
      id: number
      wpositions: Float32Array | null
      wnormals: Int8Array | null
      wcolors: Uint8Array | null
      wuvs: Float32Array | null
      wtileIndexes: Float32Array | null
      windices: Uint32Array | null
    }
    const transferList = selfMock.postMessage.mock.calls[0]?.[1] as ArrayBuffer[]

    expect(message.id).toBe(17)
    expect(message.wpositions).toBeInstanceOf(Float32Array)
    expect(message.wnormals).toBeInstanceOf(Int8Array)
    expect(message.wcolors).toBeInstanceOf(Uint8Array)
    expect(message.wuvs).toBeInstanceOf(Float32Array)
    expect(message.wtileIndexes).toBeInstanceOf(Float32Array)
    expect(message.windices).toBeInstanceOf(Uint32Array)
    expect(transferList).toHaveLength(12)
  })
})
