interface ConfigureInterface {
  autoJump: boolean
  renderToggleAutoJump: () => void
}

class Configure {
  public autoJump = true
  public isDisplayLineSegment = false

  public renderToggleAutoJump(): void {
    const autoJumpButton = document.getElementById('auto-jump')
    autoJumpButton?.addEventListener('click', () => {
      this.autoJump = !this.autoJump
      autoJumpButton.innerHTML = `AutoJump: ${this.autoJump ? 'On' : 'Off'}`
    })
  }
}

export { Configure, ConfigureInterface }
