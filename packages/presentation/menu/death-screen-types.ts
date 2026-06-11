import { Option } from 'effect'

export type DeathScreenDom = {
  readonly backdropEl: Option.Option<HTMLDivElement>
  readonly respawnBtn: Option.Option<HTMLButtonElement>
  readonly quitBtn: Option.Option<HTMLButtonElement>
}
