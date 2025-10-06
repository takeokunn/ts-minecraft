import type { ParseError } from '@effect/schema/ParseResult'
import * as TreeFormatter from '@effect/schema/TreeFormatter'
import type { ActionId } from './index'

export type InputDomainError =
  | { readonly _tag: 'InvalidEvent'; readonly issues: ReadonlyArray<string> }
  | { readonly _tag: 'HandlerFailure'; readonly action: ActionId; readonly message: string }
  | { readonly _tag: 'QueueOverflow'; readonly pending: number }
  | { readonly _tag: 'ClockUnavailable'; readonly detail: string }

export const InputDomainErrorConstructors = {
  invalidEvent: (issues: ReadonlyArray<string>): InputDomainError => ({ _tag: 'InvalidEvent', issues }),
  handlerFailure: (action: ActionId, message: string): InputDomainError => ({
    _tag: 'HandlerFailure',
    action,
    message,
  }),
  queueOverflow: (pending: number): InputDomainError => ({ _tag: 'QueueOverflow', pending }),
  clockUnavailable: (detail: string): InputDomainError => ({ _tag: 'ClockUnavailable', detail }),
}

export const fromParseError = (error: ParseError): InputDomainError =>
  InputDomainErrorConstructors.invalidEvent([TreeFormatter.formatErrorSync(error)])

export const unexpectedHandlerFailure = (action: ActionId, issue: string): InputDomainError =>
  InputDomainErrorConstructors.handlerFailure(action, issue)

export const queueOverflow = (pending: number): InputDomainError => InputDomainErrorConstructors.queueOverflow(pending)

export const clockUnavailable = (detail: string): InputDomainError =>
  InputDomainErrorConstructors.clockUnavailable(detail)
