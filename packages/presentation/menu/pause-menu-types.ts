import { Option } from 'effect'

export type PauseMenuDom = {
  readonly backdropEl: Option.Option<HTMLDivElement>
  readonly panelEl: Option.Option<HTMLDivElement>
  readonly resumeBtn: Option.Option<HTMLButtonElement>
  readonly settingsBtn: Option.Option<HTMLButtonElement>
  readonly howToPlayBtn: Option.Option<HTMLButtonElement>
  readonly howToPlayPanel: Option.Option<HTMLDivElement>
  readonly howToPlayCloseBtn: Option.Option<HTMLButtonElement>
  readonly saveQuitBtn: Option.Option<HTMLButtonElement>
}
