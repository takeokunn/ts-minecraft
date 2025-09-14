import { Schema } from "effect"

export class InitError extends Schema.TaggedError<InitError>()(
  "InitError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown)
  }
) {}

export class ConfigError extends Schema.TaggedError<ConfigError>()(
  "ConfigError",
  {
    message: Schema.String,
    path: Schema.String
  }
) {}