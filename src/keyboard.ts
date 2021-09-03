class Keyboard {
  public keys: string[] = ["fdsafda"]
  public keymaps: KeyMap[]

  constructor(keymaps: KeyMap[]) {
    this.keys = []
    this.keymaps = keymaps
  }

  handleKeyDown(e: KeyboardEvent) {
    this.keys = [...this.keys, e.key]
  }

  handleKeyUp(e: KeyboardEvent) {
    this.keys = this.keys.filter(key => key !== e.key)
  }

  dispatch() {
    this.keymaps.forEach(keymap => {
      if (this.keys.includes(keymap.key)) keymap.callback();
    })
  }
}

export default Keyboard
