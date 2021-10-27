import { Game } from '@src/game'
import { Terrian } from '@src/terrian'
import { Keyboard } from '@src/keyboard'
import { Configure } from '@src/configure'
import { Character } from '@src/character'
// import { adjustBlockFaces } from '@src/utils'

const config = new Configure()
config.renderToggleAutoJump()

const terrian = new Terrian()
terrian.generate(0, 0)

const game = new Game()
game.addChunksToScene(terrian.chunks, config.isDisplayLineSegment)

const character = new Character(game, config, terrian)
const keyboard = new Keyboard(character.keymaps)

game.loop(() => {
  keyboard.dispatch()
  character.calcurateGravity()
})
