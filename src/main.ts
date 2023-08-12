import { Game } from '@src/game'
import { Terrian } from '@src/terrian'
import { createStats } from '@src/utils'
import { Keyboard } from '@src/keyboard'
import { Configure } from '@src/configure'
import { Character } from '@src/character'

const terrian = new Terrian()
terrian.generate()

const config = new Configure()
const game = new Game()
config.render({
  handleClickPerspective: (far: number) => game.camera.setFar(far),
  handleClickLineSegment: (isShow: boolean) =>
    isShow ? game.addLineSegmentBlock(terrian.getChunkBlocks()) : game.removeLineSegmentBlock(),
})
game.addChunksToScene(terrian.getChunkBlocks())

const character = new Character(game, config, terrian)
const keyboard = new Keyboard(character.keymaps)

const stats = createStats()

game.loop(
  () => stats.begin(),
  () => {
    keyboard.dispatch()
    character.calcurateGravity()
  },
  () => stats.end(),
)
