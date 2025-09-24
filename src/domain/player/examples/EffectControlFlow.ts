import { Effect, Match, pipe, Option, Either, Array as EffectArray, Stream } from 'effect'
import { Schema } from 'effect'
import * as Types from '../PlayerTypes.js'

// =========================================
// 制御フロー変換パターン集
// =========================================

// ============================================
// 1. if/else → Match.value/Match.when
// ============================================

// ❌ 禁止パターン: if/else
export const processPlayerHealth_BAD = (player: Types.Player): string => {
  if (player.stats.health <= 0) {
    return 'dead'
  } else if (player.stats.health <= 5) {
    return 'critical'
  } else if (player.stats.health <= 10) {
    return 'injured'
  } else {
    return 'healthy'
  }
}

// ✅ 推奨パターン: Match.value
export const processPlayerHealth_GOOD = (player: Types.Player): Effect.Effect<string> =>
  pipe(
    player.stats.health,
    Match.value,
    Match.when(h => h <= 0, () => 'dead'),
    Match.when(h => h <= 5, () => 'critical'),
    Match.when(h => h <= 10, () => 'injured'),
    Match.orElse(() => 'healthy'),
    Effect.succeed
  )

// ============================================
// 2. switch → Match.tag/Match.exhaustive
// ============================================

// ❌ 禁止パターン: switch
export const handlePlayerAction_BAD = (action: Types.PlayerAction): string => {
  switch (action._tag) {
    case 'Move':
      return `Moving ${action.direction.forward ? 'forward' : 'backward'}`
    case 'Jump':
      return 'Jumping'
    case 'Attack':
      return `Attacking entity ${action.targetId}`
    case 'PlaceBlock':
      return `Placing block at ${action.position.x},${action.position.y},${action.position.z}`
    default:
      return 'Unknown action'
  }
}

// ✅ 推奨パターン: Match.type with exhaustive
export const handlePlayerAction_GOOD = (action: Types.PlayerAction): Effect.Effect<string> =>
  pipe(
    action,
    Match.type<Types.PlayerAction>(),
    Match.tag('Move', ({ direction }) =>
      Effect.succeed(`Moving ${direction.forward ? 'forward' : 'backward'}`)
    ),
    Match.tag('Jump', () => Effect.succeed('Jumping')),
    Match.tag('Attack', ({ targetId }) => Effect.succeed(`Attacking entity ${targetId}`)),
    Match.tag('PlaceBlock', ({ position }) =>
      Effect.succeed(`Placing block at ${position.x},${position.y},${position.z}`)
    ),
    Match.tag('BreakBlock', ({ position }) =>
      Effect.succeed(`Breaking block at ${position.x},${position.y},${position.z}`)
    ),
    Match.tag('UseItem', ({ slotIndex }) => Effect.succeed(`Using item in slot ${slotIndex}`)),
    Match.tag('OpenContainer', ({ position }) =>
      Effect.succeed(`Opening container at ${position.x},${position.y},${position.z}`)
    ),
    Match.tag('DropItem', ({ slotIndex, count }) =>
      Effect.succeed(`Dropping ${count} items from slot ${slotIndex}`)
    ),
    Match.exhaustive
  )

// ============================================
// 3. try/catch → Effect.try/Effect.catchAll
// ============================================

// ❌ 禁止パターン: try/catch
export const loadPlayerData_BAD = async (playerId: string): Promise<Types.Player | null> => {
  try {
    const response = await fetch(`/api/players/${playerId}`)
    if (!response.ok) {
      throw new Error(`Failed to load player: ${response.status}`)
    }
    const data = await response.json()
    return Schema.decodeSync(Types.Player)(data)
  } catch (error) {
    console.error('Error loading player:', error)
    return null
  }
}

// ✅ 推奨パターン: Effect.tryPromise + Effect.catchAll
export const loadPlayerData_GOOD = (playerId: string): Effect.Effect<Types.Player, Types.PlayerError> =>
  pipe(
    Effect.tryPromise({
      try: () => fetch(`/api/players/${playerId}`),
      catch: (error) => ({
        _tag: 'PlayerError' as const,
        reason: 'PlayerNotFound' as const,
        playerId: Types.makePlayerId(playerId),
        message: `Failed to fetch player: ${error}`
      })
    }),
    Effect.flatMap(response =>
      pipe(
        response.ok,
        Match.value,
        Match.when(
          ok => ok === true,
          () => Effect.tryPromise(() => response.json())
        ),
        Match.orElse(() =>
          Effect.fail({
            _tag: 'PlayerError' as const,
            reason: 'PlayerNotFound' as const,
            playerId: Types.makePlayerId(playerId),
            message: `HTTP ${response.status}`
          })
        )
      )
    ),
    Effect.flatMap(data => Schema.decodeUnknown(Types.Player)(data)),
    Effect.mapError(error => ({
      _tag: 'PlayerError' as const,
      reason: 'ValidationFailed' as const,
      playerId: Types.makePlayerId(playerId),
      message: 'Invalid player data',
      context: { originalError: error }
    }))
  )

// ============================================
// 4. for/forEach → Effect.forEach
// ============================================

// ❌ 禁止パターン: for loop
export const processPlayers_BAD = async (playerIds: string[]): Promise<Types.Player[]> => {
  const results: Types.Player[] = []
  for (const id of playerIds) {
    const player = await loadPlayerData_BAD(id)
    if (player) {
      results.push(player)
    }
  }
  return results
}

// ✅ 推奨パターン: Effect.forEach with concurrency
export const processPlayers_GOOD = (
  playerIds: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<Types.Player>, Types.PlayerError> =>
  Effect.forEach(
    playerIds,
    (id) => loadPlayerData_GOOD(id),
    { concurrency: 5 } // Process up to 5 players concurrently
  )

// ============================================
// 5. while → Effect.loop/Stream.iterate
// ============================================

// ❌ 禁止パターン: while loop
export const findFirstHealthyPlayer_BAD = (players: Types.Player[]): Types.Player | null => {
  let index = 0
  while (index < players.length) {
    const player = players[index]
    if (player.stats.health > 10) {
      return player
    }
    index++
  }
  return null
}

// ✅ 推奨パターン: Effect.loop
export const findFirstHealthyPlayer_GOOD = (
  players: ReadonlyArray<Types.Player>
): Effect.Effect<Option.Option<Types.Player>> =>
  Effect.loop(
    0,
    {
      while: (index) => index < players.length,
      step: (index) => index + 1,
      body: (index) =>
        pipe(
          players[index].stats.health > 10,
          Match.value,
          Match.when(
            healthy => healthy === true,
            () => Effect.succeed(Option.some(players[index]))
          ),
          Match.orElse(() => Effect.succeed(Option.none()))
        )
    }
  ).pipe(
    Effect.map(results =>
      pipe(
        results,
        EffectArray.findFirst(Option.isSome),
        Option.flatten
      )
    )
  )

// ============================================
// 6. Promise/async → Effect.gen
// ============================================

// ❌ 禁止パターン: async/await
export const updatePlayerStats_BAD = async (
  playerId: string,
  health: number
): Promise<Types.Player | null> => {
  try {
    const player = await loadPlayerData_BAD(playerId)
    if (!player) {
      return null
    }

    const updatedPlayer = {
      ...player,
      stats: {
        ...player.stats,
        health: Types.makeHealth(Math.min(20, Math.max(0, health)))
      }
    }

    const response = await fetch(`/api/players/${playerId}`, {
      method: 'PUT',
      body: JSON.stringify(updatedPlayer)
    })

    if (!response.ok) {
      throw new Error(`Failed to update player: ${response.status}`)
    }

    return updatedPlayer
  } catch (error) {
    console.error('Error updating player:', error)
    return null
  }
}

// ✅ 推奨パターン: Effect.gen
export const updatePlayerStats_GOOD = (
  playerId: string,
  health: number
): Effect.Effect<Types.Player, Types.PlayerError> =>
  Effect.gen(function* () {
    // Load player
    const player = yield* loadPlayerData_GOOD(playerId)

    // Update health with bounds checking
    const newHealth = yield* pipe(
      health,
      Match.value,
      Match.when(h => h < 0, () => Effect.succeed(0)),
      Match.when(h => h > 20, () => Effect.succeed(20)),
      Match.orElse(h => Effect.succeed(h))
    ).pipe(Effect.map(Types.makeHealth))

    // Create updated player
    const updatedPlayer: Types.Player = {
      ...player,
      stats: {
        ...player.stats,
        health: newHealth
      }
    }

    // Save updated player
    yield* Effect.tryPromise({
      try: () =>
        fetch(`/api/players/${playerId}`, {
          method: 'PUT',
          body: JSON.stringify(updatedPlayer),
          headers: { 'Content-Type': 'application/json' }
        }),
      catch: (error) => ({
        _tag: 'PlayerError' as const,
        reason: 'ValidationFailed' as const,
        playerId: Types.makePlayerId(playerId),
        message: `Failed to save player: ${error}`
      })
    })

    return updatedPlayer
  })

// ============================================
// 7. Complex nested control flow
// ============================================

// ❌ 禁止パターン: Nested if/else with loops
export const processPlayerInventory_BAD = (player: Types.Player): string[] => {
  const messages: string[] = []

  for (let i = 0; i < player.inventory.slots.length; i++) {
    const item = player.inventory.slots[i]
    if (item) {
      if (item.count > 32) {
        messages.push(`Slot ${i}: Stack overflow (${item.count}/${64})`)
      } else if (item.itemId.startsWith('weapon_')) {
        messages.push(`Slot ${i}: Weapon ${item.itemId}`)
      } else {
        messages.push(`Slot ${i}: ${item.itemId} x${item.count}`)
      }
    }
  }

  if (messages.length === 0) {
    return ['Inventory is empty']
  } else {
    return messages
  }
}

// ✅ 推奨パターン: Effect.gen + Match + Effect.forEach
export const processPlayerInventory_GOOD = (
  player: Types.Player
): Effect.Effect<ReadonlyArray<string>> =>
  Effect.gen(function* () {
    const messages = yield* Effect.forEach(
      player.inventory.slots.map((item, index) => ({ item, index })),
      ({ item, index }) =>
        pipe(
          Option.fromNullable(item),
          Option.match({
            onNone: () => Effect.succeed(Option.none<string>()),
            onSome: (itemStack) =>
              pipe(
                itemStack,
                Match.value,
                Match.when(
                  item => item.count > 32,
                  item => Effect.succeed(Option.some(`Slot ${index}: Stack overflow (${item.count}/64)`))
                ),
                Match.when(
                  item => item.itemId.startsWith('weapon_'),
                  item => Effect.succeed(Option.some(`Slot ${index}: Weapon ${item.itemId}`))
                ),
                Match.orElse(item =>
                  Effect.succeed(Option.some(`Slot ${index}: ${item.itemId} x${item.count}`))
                )
              )
          })
      )
    ).pipe(
      Effect.map(EffectArray.getSomes)
    )

    return yield* pipe(
      messages,
      EffectArray.isEmptyReadonlyArray,
      Match.value,
      Match.when(
        isEmpty => isEmpty === true,
        () => Effect.succeed(['Inventory is empty'] as ReadonlyArray<string>)
      ),
      Match.orElse(() => Effect.succeed(messages))
    )
  })

// ============================================
// 8. Error handling patterns
// ============================================

export const applyDamage = (
  player: Types.Player,
  damage: number,
  source: Types.DamageSource
): Effect.Effect<Types.Player, Types.PlayerError> =>
  Effect.gen(function* () {
    // Calculate damage based on armor
    const finalDamage = yield* pipe(
      player.stats.armor,
      Match.value,
      Match.when(armor => armor >= 20, () => Effect.succeed(Math.floor(damage * 0.2))),
      Match.when(armor => armor >= 15, () => Effect.succeed(Math.floor(damage * 0.4))),
      Match.when(armor => armor >= 10, () => Effect.succeed(Math.floor(damage * 0.6))),
      Match.when(armor => armor >= 5, () => Effect.succeed(Math.floor(damage * 0.8))),
      Match.orElse(() => Effect.succeed(damage))
    )

    // Apply damage
    const newHealth = Math.max(0, player.stats.health - finalDamage)

    // Check for death
    yield* pipe(
      newHealth,
      Match.value,
      Match.when(
        h => h <= 0,
        () =>
          Effect.logInfo(`Player ${player.name} died from ${source._tag}`)
      ),
      Match.orElse(() => Effect.succeed(undefined))
    )

    return {
      ...player,
      stats: {
        ...player.stats,
        health: Types.makeHealth(newHealth)
      }
    }
  })

// ============================================
// 9. Stream processing patterns
// ============================================

export const monitorPlayerHealth = (
  player: Types.Player
): Stream.Stream<Types.PlayerEvent, Types.PlayerError> =>
  Stream.iterate(player, (currentPlayer) => ({
    ...currentPlayer,
    stats: {
      ...currentPlayer.stats,
      health: Types.makeHealth(Math.max(0, currentPlayer.stats.health - 1))
    }
  })).pipe(
    Stream.map((player): Types.PlayerEvent =>
      pipe(
        player.stats.health,
        Match.value,
        Match.when(
          h => h <= 0,
          () => ({
            _tag: 'PlayerDied' as const,
            playerId: player.id,
            cause: { _tag: 'Hunger' as const },
            position: player.position,
            timestamp: Date.now()
          })
        ),
        Match.when(
          h => h <= 5,
          () => ({
            _tag: 'PlayerDamaged' as const,
            playerId: player.id,
            damage: 1,
            source: { _tag: 'Hunger' as const },
            newHealth: player.stats.health,
            timestamp: Date.now()
          })
        ),
        Match.orElse(() => ({
          _tag: 'PlayerDamaged' as const,
          playerId: player.id,
          damage: 1,
          source: { _tag: 'Hunger' as const },
          newHealth: player.stats.health,
          timestamp: Date.now()
        }))
      )
    ),
    Stream.takeUntil(event => event._tag === 'PlayerDied')
  )