import { Console, Effect } from 'effect'
import { ServerServiceImpl, type ServerServiceShape } from '../application/server-service'
import { NodeWebSocketServer } from '../infrastructure/node-websocket-server'

const port = 25565

const logPlayerCountChanges = (server: ServerServiceShape) =>
  Effect.gen(function* () {
    let previousCount = 0
    while (true) {
      const players = yield* server.getConnectedPlayers()
      if (players.size !== previousCount) {
        yield* Console.log(`Connected players: ${players.size}`)
        previousCount = players.size
      }
      yield* Effect.sleep('1 second')
    }
  })

const main = Effect.gen(function* () {
  const server = yield* ServerServiceImpl(new NodeWebSocketServer())
  yield* server.start(port)
  yield* Console.log(`ts-minecraft multiplayer server listening on ws://127.0.0.1:${port}`)
  yield* logPlayerCountChanges(server)
})

Effect.runPromise(main).catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error)
  process.exitCode = 1
})
