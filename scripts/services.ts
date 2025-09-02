import { Context, Layer, Effect } from 'effect'
import sharp from 'sharp'
import fs from 'fs/promises'

// --- FileSystem Service ---
export class FileSystem extends Context.Tag('FileSystem')<
  FileSystem,
  {
    readonly readdir: (
      path: string,
      options: { withFileTypes: true },
    ) => Effect.Effect<fs.Dirent[], Error>
    readonly readdirSimple: (path: string) => Effect.Effect<string[], Error>
  }
>() {}

export const FileSystemLive = Layer.succeed(
  FileSystem,
  FileSystem.of({
    readdir: (path, options) =>
      Effect.tryPromise({
        try: () => fs.readdir(path, options),
        catch: (e) => e as Error,
      }),
    readdirSimple: (path) =>
      Effect.tryPromise({
        try: () => fs.readdir(path),
        catch: (e) => e as Error,
      }),
  }),
)

// --- ImageProcessor Service ---
export type SharpInstance = sharp.Sharp

export class ImageProcessor extends Context.Tag('ImageProcessor')<
  ImageProcessor,
  {
    readonly createImage: (options: sharp.Create) => Effect.Effect<SharpInstance, Error>
    readonly resizeImage: (path: string, width: number, height: number) => Effect.Effect<Buffer, Error>
    readonly compositeImages: (
      baseImage: SharpInstance,
      composites: readonly sharp.OverlayOptions[],
    ) => Effect.Effect<SharpInstance, Error>
    readonly toFile: (image: SharpInstance, path: string) => Effect.Effect<sharp.OutputInfo, Error>
  }
>() {}

export const ImageProcessorLive = Layer.succeed(
  ImageProcessor,
  ImageProcessor.of({
    createImage: (options) =>
      Effect.try({
        try: () => sharp(options),
        catch: (e) => e as Error,
      }),
    resizeImage: (path, width, height) =>
      Effect.tryPromise({
        try: () => sharp(path).resize(width, height).toBuffer(),
        catch: (e) => e as Error,
      }),
    compositeImages: (baseImage, composites) =>
      Effect.try({
        try: () => baseImage.composite(composites),
        catch: (e) => e as Error,
      }),
    toFile: (image, path) =>
      Effect.tryPromise({
        try: () => image.toFile(path),
        catch: (e) => e as Error,
      }),
  }),
)

// --- Logger Service ---
export class Logger extends Context.Tag('Logger')<
  Logger,
  {
    readonly log: (message: string) => Effect.Effect<void>
    readonly warn: (message: string) => Effect.Effect<void>
    readonly error: (message: unknown) => Effect.Effect<void>
  }
>() {}

export const LoggerLive = Layer.succeed(
  Logger,
  Logger.of({
    log: (message) => Effect.sync(() => console.log(message)),
    warn: (message) => Effect.sync(() => console.warn(message)),
    error: (error) => Effect.sync(() => console.error(error)),
  }),
)
