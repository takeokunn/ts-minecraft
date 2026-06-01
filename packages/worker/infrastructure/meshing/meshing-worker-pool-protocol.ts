// @effect-boundary - infrastructure worker protocol boundary operations
import { Array as Arr, MutableRef, Schema } from "effect";
import { MeshedChunkSchema, type MeshedChunk } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing-types'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const extractResponseId = (data: unknown): number | null => {
  if (!isRecord(data)) return null
  const id = data['id']
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 ? id : null
}

export const toNullableMeshed = (
  positions: Float32Array | null,
  normals: Int8Array | null,
  colors: Uint8Array | null,
  uvs: Float32Array | null,
  tileIndexes: Float32Array | null,
  indices: Uint32Array | null,
  meshName: string,
): MeshedChunk | null => {
  if (
    positions === null
    && normals === null
    && colors === null
    && uvs === null
    && tileIndexes === null
    && indices === null
  ) {
    return null
  }

  if (
    positions !== null
    && normals !== null
    && colors !== null
    && uvs !== null
    && tileIndexes !== null
    && indices !== null
  ) {
    // postMessage with transfer always detaches the underlying ArrayBuffer —
    // the received typed arrays always have a plain ArrayBuffer backing store.
    return {
      positions: positions as Float32Array<ArrayBuffer>,
      normals: normals as Int8Array<ArrayBuffer>,
      colors: colors as Uint8Array<ArrayBuffer>,
      uvs: uvs as Float32Array<ArrayBuffer>,
      tileIndexes: tileIndexes as Float32Array<ArrayBuffer>,
      indices: indices as Uint32Array<ArrayBuffer>,
    }
  }

  throw new Error(`Malformed meshing worker response: incomplete ${meshName} mesh payload`)
}

export const toWorkerMeshResult = (response: WorkerResponse): WorkerMeshResult => ({
  opaque: {
    positions: response.opositions,
    normals: response.onormals,
    colors: response.ocolors,
    uvs: response.ouvs,
    tileIndexes: response.otileIndexes,
    indices: response.oindices,
  },
  water: toNullableMeshed(
    response.wpositions, response.wnormals, response.wcolors,
    response.wuvs, response.wtileIndexes, response.windices,
    'water',
  ),
  transparentSolid: toNullableMeshed(
    response.tspositions, response.tsnormals, response.tscolors,
    response.tsuvs, response.tstileIndexes, response.tsindices,
    'transparentSolid',
  ),
})

export const toMeshingWorkerError = (error: unknown, prefix: string): Error => {
  if (error instanceof Error) {
    return new Error(`${prefix}: ${error.message}`)
  }
  return new Error(`${prefix}: ${String(error)}`)
}

export const rejectPendingRequest = (
  pendingRef: MutableRef.MutableRef<Map<number, PendingMesh>>,
  id: number,
  error: unknown,
): boolean => {
  const pending = MutableRef.get(pendingRef)
  const req = pending.get(id)
  if (req === undefined) return false
  pending.delete(id)
  req.reject(error)
  return true
}

export const rejectAllPendingRequests = (
  pendingRef: MutableRef.MutableRef<Map<number, PendingMesh>>,
  error: unknown,
): void => {
  const pending = MutableRef.get(pendingRef)
  Arr.forEach(Arr.fromIterable(pending.values()), (req) => {
    req.reject(error)
  })
  pending.clear()
}

export const WorkerMeshResultSchema = Schema.Struct({
  opaque: MeshedChunkSchema,
  water: Schema.NullOr(MeshedChunkSchema),
  transparentSolid: Schema.NullOr(MeshedChunkSchema),
})
export type WorkerMeshResult = Schema.Schema.Type<typeof WorkerMeshResultSchema>

// Typed shape of the message returned by meshing-worker.ts.
// 'o' prefix = opaque, 'w' prefix = water, 'ts' prefix = transparent solid (GLASS/LEAVES).
// null arrays mean no faces of that type in this chunk.
// ArrayBuffer (not ArrayBufferLike) because postMessage with transfer always detaches
// the underlying ArrayBuffer — SharedArrayBuffer cannot be transferred this way.
export const WorkerResponseSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  opositions: Schema.instanceOf(Float32Array),
  onormals: Schema.instanceOf(Int8Array),
  ocolors: Schema.instanceOf(Uint8Array),
  ouvs: Schema.instanceOf(Float32Array),
  otileIndexes: Schema.instanceOf(Float32Array),
  oindices: Schema.instanceOf(Uint32Array),
  wpositions: Schema.NullOr(Schema.instanceOf(Float32Array)),
  wnormals: Schema.NullOr(Schema.instanceOf(Int8Array)),
  wcolors: Schema.NullOr(Schema.instanceOf(Uint8Array)),
  wuvs: Schema.NullOr(Schema.instanceOf(Float32Array)),
  wtileIndexes: Schema.NullOr(Schema.instanceOf(Float32Array)),
  windices: Schema.NullOr(Schema.instanceOf(Uint32Array)),
  tspositions: Schema.NullOr(Schema.instanceOf(Float32Array)),
  tsnormals: Schema.NullOr(Schema.instanceOf(Int8Array)),
  tscolors: Schema.NullOr(Schema.instanceOf(Uint8Array)),
  tsuvs: Schema.NullOr(Schema.instanceOf(Float32Array)),
  tstileIndexes: Schema.NullOr(Schema.instanceOf(Float32Array)),
  tsindices: Schema.NullOr(Schema.instanceOf(Uint32Array)),
})
export type WorkerResponse = Schema.Schema.Type<typeof WorkerResponseSchema>

const PendingMeshSchema = Schema.Struct({
  resolve: Schema.declare((u): u is (value: WorkerMeshResult) => void => typeof u === 'function'),
  reject: Schema.declare((u): u is (e: unknown) => void => typeof u === 'function'),
})
export type PendingMesh = Schema.Schema.Type<typeof PendingMeshSchema>

export type PoolWorker = {
  readonly worker: Worker
  readonly pending: MutableRef.MutableRef<Map<number, PendingMesh>>
}
