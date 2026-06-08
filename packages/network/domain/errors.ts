export class NetworkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}
