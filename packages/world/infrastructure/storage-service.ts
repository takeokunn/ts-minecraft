// @effect-boundary IndexedDB persistence adapter converts browser exceptions to Effect failures.
import { Effect, Option, Ref } from "effect";
import type { WorldId, ChunkCoord } from "@ts-minecraft/core";
import { openDatabase, type TypedIDBDatabase } from "./idb-utils";
import { StorageError } from "../domain/errors";
import type { ChunkStorageValue } from "../domain/storage-service-port";
import type { WorldMetadata } from "../domain/world-metadata-model";
import {
  DB_NAME,
  DB_VERSION,
  STORE_CHUNKS,
  STORE_METADATA,
  chunkKey,
  type MinecraftWorldsDB,
} from "./storage-idb-model";
import {
  tryCatchStorage,
  tryCatchStorageWithRetry,
} from "./storage-error-mapping";
import {
  collectDecodedWorldMetadata,
  decodeOptionalWorldMetadata,
  encodeWorldMetadata,
} from "./storage-serialization";

export type { ChunkCoord };
export type { ChunkStorageValue } from "../domain/storage-service-port";
export {
  CURRENT_WORLD_SAVE_VERSION,
  WorldMetadataSchema,
  type WorldMetadata,
} from "../domain/world-metadata-model";
export { WORLD_SCHEMA_VERSION, ChunkStorageKey } from "./storage-idb-model";

const uninitialized = (operation: string): StorageError =>
  new StorageError({ operation, cause: "Database not initialized" });

const withDb = <A>(
  dbRef: Ref.Ref<Option.Option<TypedIDBDatabase<MinecraftWorldsDB>>>,
  operation: string,
  f: (
    db: TypedIDBDatabase<MinecraftWorldsDB>,
  ) => Effect.Effect<A, StorageError>,
): Effect.Effect<A, StorageError> =>
  Effect.gen(function* () {
    const dbVal = Option.getOrNull(yield* Ref.get(dbRef));
    if (dbVal === null) return yield* Effect.fail(uninitialized(operation));
    return yield* f(dbVal);
  });

const openWorldDatabase = (): Effect.Effect<
  TypedIDBDatabase<MinecraftWorldsDB>,
  StorageError
> =>
  openDatabase<MinecraftWorldsDB>(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.includes(STORE_CHUNKS)) {
      db.createObjectStore(STORE_CHUNKS);
    }
    if (!db.objectStoreNames.includes(STORE_METADATA)) {
      db.createObjectStore(STORE_METADATA);
    }
  }).pipe(
    Effect.mapError(
      (cause) => new StorageError({ operation: "open database", cause }),
    ),
  );

export class StorageService extends Effect.Service<StorageService>()(
  "@minecraft/infrastructure/storage/StorageService",
  {
    effect: Effect.gen(function* () {
      const dbRef = yield* Ref.make<
        Option.Option<TypedIDBDatabase<MinecraftWorldsDB>>
      >(Option.none());
      const initialize: Effect.Effect<void, StorageError> = Effect.gen(
        function* () {
          const existingDb = yield* Ref.get(dbRef);
          if (Option.isNone(existingDb)) {
            const newDb = yield* openWorldDatabase();
            yield* Ref.set(dbRef, Option.some(newDb));
          }
        },
      );

      const withInitializedDb = <A>(
        operation: string,
        f: (
          db: TypedIDBDatabase<MinecraftWorldsDB>,
        ) => Effect.Effect<A, StorageError>,
      ): Effect.Effect<A, StorageError> =>
        Effect.gen(function* () {
          yield* initialize;
          return yield* withDb(dbRef, operation, f);
        });

      const saveChunk = (
        worldId: WorldId,
        chunkCoord: ChunkCoord,
        data: ChunkStorageValue,
      ) =>
        withInitializedDb("saveChunk", (db) =>
          tryCatchStorageWithRetry(
            "saveChunk",
            db.put(STORE_CHUNKS, data, chunkKey(worldId, chunkCoord)),
          ),
        );

      const loadChunk = (worldId: WorldId, chunkCoord: ChunkCoord) =>
        withInitializedDb("loadChunk", (db) =>
          Effect.gen(function* () {
            const raw = yield* tryCatchStorageWithRetry(
              "loadChunk",
              db.get(STORE_CHUNKS, chunkKey(worldId, chunkCoord)),
            );
            return Option.fromNullable(raw);
          }),
        );

      const saveWorldMetadata = (worldId: WorldId, metadata: WorldMetadata) =>
        withInitializedDb("saveWorldMetadata", (db) =>
          Effect.gen(function* () {
            const encoded = yield* encodeWorldMetadata(metadata);
            return yield* tryCatchStorageWithRetry(
              "saveWorldMetadata",
              db.put(STORE_METADATA, encoded, worldId),
            );
          }),
        );

      const loadWorldMetadata = (worldId: WorldId) =>
        withInitializedDb("loadWorldMetadata", (db) =>
          Effect.gen(function* () {
            const raw = yield* tryCatchStorageWithRetry(
              "loadWorldMetadata",
              db.get(STORE_METADATA, worldId),
            );
            return yield* decodeOptionalWorldMetadata(raw);
          }),
        );

      const deleteWorld = (worldId: WorldId) =>
        withInitializedDb("deleteWorld", (db) =>
          Effect.gen(function* () {
            const keys: string[] = [];
            yield* tryCatchStorage(
              "deleteWorld",
              db.forEachCursor(STORE_CHUNKS, (cursor) =>
                Effect.sync(() => {
                  if (cursor.key.toString().startsWith(`${worldId}:`)) {
                    keys.push(cursor.key.toString());
                  }
                }),
              ),
            );
            yield* Effect.forEach(
              keys,
              (key) =>
                tryCatchStorage("deleteWorld", db.delete(STORE_CHUNKS, key)),
              { concurrency: 1 },
            );
            yield* tryCatchStorage(
              "deleteWorld",
              db.delete(STORE_METADATA, worldId),
            );
          }),
        );

      const listWorldMetadata = withInitializedDb("listWorldMetadata", (db) =>
        Effect.gen(function* () {
          const raw: Array<{ key: string; value: unknown }> = [];
          yield* tryCatchStorage(
            "listWorldMetadata",
            db.forEachCursor(STORE_METADATA, (cursor) =>
              Effect.sync(() => {
                raw.push({ key: cursor.key.toString(), value: cursor.value });
              }),
            ),
          );
          return yield* collectDecodedWorldMetadata(raw);
        }),
      );

      return {
        initialize,
        saveChunk,
        loadChunk,
        saveWorldMetadata,
        loadWorldMetadata,
        listWorldMetadata,
        deleteWorld,
      };
    }),
  },
) {}
