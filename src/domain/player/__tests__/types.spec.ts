import { Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect, it } from 'vitest'
import { PlayerAggregateSchema, PlayerCommandSchema, PlayerSnapshotSchema } from '../types'
import { aggregateArb, commandArb, snapshotArb } from './generators'

describe('Player schema validation', () => {
  it('PlayerAggregateはJSON経由でも再構成できる', () =>
    fc.assert(
      fc.property(aggregateArb, (aggregate) => {
        const json = JSON.parse(JSON.stringify(aggregate))
        const decoded = Schema.decodeUnknownSync(PlayerAggregateSchema)(json)
        expect(decoded).toStrictEqual(aggregate)
      })
    ))

  it('PlayerCommandは無損失にデコードできる', () =>
    fc.assert(
      fc.property(commandArb, (command) => {
        const json = JSON.parse(JSON.stringify(command))
        const decoded = Schema.decodeUnknownSync(PlayerCommandSchema)(json)
        expect(decoded).toStrictEqual(command)
      })
    ))

  it('PlayerSnapshotも保持できる', () =>
    fc.assert(
      fc.property(snapshotArb, (snapshot) => {
        const json = JSON.parse(JSON.stringify(snapshot))
        const decoded = Schema.decodeUnknownSync(PlayerSnapshotSchema)(json)
        expect(decoded).toStrictEqual(snapshot)
      })
    ))
})
