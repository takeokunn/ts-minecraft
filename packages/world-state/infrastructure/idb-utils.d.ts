import { Effect } from 'effect';
export type DBSchema = {
    [storeName: string]: {
        key: IDBValidKey;
        value: unknown;
    };
};
export type UpgradeDB = {
    readonly objectStoreNames: ReadonlyArray<string>;
    createObjectStore(name: string): void;
    deleteObjectStore(name: string): void;
};
export declare class IndexedDBError extends Error {
    readonly cause: unknown;
    constructor(message: string, cause: unknown);
}
export type TypedIDBDatabase<T extends DBSchema> = {
    put<S extends Extract<keyof T, string>>(storeName: S, value: T[S]['value'], key?: T[S]['key']): Effect.Effect<T[S]['key'], IndexedDBError>;
    get<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']): Effect.Effect<T[S]['value'] | undefined, IndexedDBError>;
    delete<S extends Extract<keyof T, string>>(storeName: S, key: T[S]['key']): Effect.Effect<void, IndexedDBError>;
    forEachCursor<S extends Extract<keyof T, string>>(storeName: S, onCursor: (cursor: {
        readonly key: T[S]['key'];
        readonly value: T[S]['value'];
    }) => Effect.Effect<void, never>): Effect.Effect<void, IndexedDBError>;
    close(): void;
};
export declare const deleteDatabase: (name: string) => Effect.Effect<void, IndexedDBError>;
export declare const openDatabase: <T extends DBSchema>(name: string, version: number, upgrade: (db: UpgradeDB, oldVersion: number) => void) => Effect.Effect<TypedIDBDatabase<T>, IndexedDBError>;
//# sourceMappingURL=idb-utils.d.ts.map