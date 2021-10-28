import { Game } from '@src/game'
import { Terrian } from '@src/terrian'
import { Keyboard } from '@src/keyboard'
import { Configure } from '@src/configure'
import { Character } from '@src/character'

const terrian = new Terrian()
terrian.generate(0, 0)

const config = new Configure()
const game = new Game()
config.render({
  handleClickPerspective: (far: number) => game.setCameraFar(far),
  handleClickLineSegment: (isShow: boolean) =>
    isShow ? game.addLineSegmentBlock(terrian.chunks) : game.removeLineSegmentBlock(),
})
game.addChunksToScene(terrian.chunks)

const character = new Character(game, config, terrian)
const keyboard = new Keyboard(character.keymaps)

game.loop(() => {
  keyboard.dispatch()
  character.calcurateGravity()
})
