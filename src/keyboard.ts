type KeyMap = {
  key: string
  callback: () => void
}

interface KeyboardInterface {
  dispatch: () => void
}

class Keyboard implements KeyboardInterface {
  private keys: string[] = []
  private keymaps: KeyMap[]

  constructor(keymaps: KeyMap[]) {
    this.keymaps = keymaps
    document.addEventListener('keyup', (e: KeyboardEvent) => this.handleKeyUp(e))
    document.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeyDown(e))
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.keys = [...this.keys, e.key]
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys = this.keys.filter((key) => key !== e.key)
  }

  public dispatch(): void {
    this.keymaps.forEach((keymap) => {
      if (this.keys.includes(keymap.key)) {
        keymap.callback()
      }
    })
  }
}

export { Keyboard, KeyMap }
