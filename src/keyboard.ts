class Keyboard {
  public keys: string[] = []
  public keymaps: KeyMap[]

  constructor(keymaps: KeyMap[]) {
    this.keys = []
    this.keymaps = keymaps
  }

  handleKeyDown(e: KeyboardEvent): void {
    this.keys = [...this.keys, e.key]
  }

  handleKeyUp(e: KeyboardEvent): void {
    this.keys = this.keys.filter((key) => key !== e.key)
  }

  dispatch(): void {
    this.keymaps.forEach((keymap) => {
      if (this.keys.includes(keymap.key)) keymap.callback()
    })
  }
}

export default Keyboard
