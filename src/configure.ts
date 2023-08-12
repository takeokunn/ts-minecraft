import { CAMERA, CONSTANT } from '@src/constant'

type RenderParams = {
  handleClickPerspective: (far: number) => void
  handleClickLineSegment: (isShow: boolean) => void
}

interface ConfigureInterface {
  autoJump: boolean
  render: (params: RenderParams) => void
}

class Configure implements ConfigureInterface {
  public autoJump = CONSTANT.INITIAL_AUTO_JUMP
  private isShowLineSegment = CAMERA.INITIALIZE.IS_SHOW_LINESEGMENT
  private cameraPerspectiveDistance = CAMERA.PERSPECTIVE.NEAR

  public render(params: RenderParams): void {
    this.renderToggleAutoJump()
    this.renderChangeCameraDistance(params.handleClickPerspective)
    this.renderLineSegment(params.handleClickLineSegment)
  }

  private renderToggleAutoJump(): void {
    const button = document.getElementById('auto-jump')
    button?.addEventListener('click', () => {
      this.autoJump = !this.autoJump
      button.innerHTML = `AutoJump: ${this.autoJump ? 'On' : 'Off'}`
    })
  }

  private renderChangeCameraDistance(handleClickPerspective: RenderParams['handleClickPerspective']): void {
    const button = document.getElementById('camera-perspective')
    button?.addEventListener('click', () => {
      switch (this.cameraPerspectiveDistance) {
        case CAMERA.PERSPECTIVE.NEAR:
          this.cameraPerspectiveDistance = CAMERA.PERSPECTIVE.MIDDLE
          button.innerHTML = `Perspective: Middle`
          break
        case CAMERA.PERSPECTIVE.MIDDLE:
          this.cameraPerspectiveDistance = CAMERA.PERSPECTIVE.FAR
          button.innerHTML = `Perspective: Far`
          break
        case CAMERA.PERSPECTIVE.FAR:
          this.cameraPerspectiveDistance = CAMERA.PERSPECTIVE.NEAR
          button.innerHTML = `Perspective: Near`
          break
      }
      handleClickPerspective(this.cameraPerspectiveDistance)
    })
  }

  private renderLineSegment(handleClickLineSegment: RenderParams['handleClickLineSegment']): void {
    const button = document.getElementById('line-segment')
    button?.addEventListener('click', () => {
      this.isShowLineSegment = !this.isShowLineSegment
      handleClickLineSegment(this.isShowLineSegment)
      button.innerHTML = `LineSegment: ${this.isShowLineSegment ? 'Show' : 'Hide'}`
    })
  }
}

export { Configure, ConfigureInterface }
