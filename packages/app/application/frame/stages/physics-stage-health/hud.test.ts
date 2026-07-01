import { describe, expect, it, vi } from 'vitest'
import { clamp, getHudContainer, updateIconMeter, updateXpBar, writeHudText } from './hud'

const makeEl = (textContent = '') => ({ textContent, style: { display: '' } } as unknown as HTMLElement)
const makeIcon = () => ({ setAttribute: vi.fn() } as unknown as HTMLElement)

describe('clamp', () => {
  it('returns value when within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('returns min when value is below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(-100, -10, 10)).toBe(-10)
  })

  it('returns max when value is above max', () => {
    expect(clamp(20, 0, 10)).toBe(10)
    expect(clamp(100, -10, 10)).toBe(10)
  })
})

describe('writeHudText', () => {
  it('writes string value to textContent', () => {
    const el = makeEl()
    writeHudText(el, 'hello')
    expect(el.textContent).toBe('hello')
  })

  it('converts number to string and writes it', () => {
    const el = makeEl()
    writeHudText(el, 42)
    expect(el.textContent).toBe('42')
  })

  it('does nothing when el is null', () => {
    // Should not throw
    expect(() => writeHudText(null, 'value')).not.toThrow()
  })
})

describe('getHudContainer', () => {
  it('returns null when el is null', () => {
    expect(getHudContainer(null, '#container')).toBeNull()
  })

  it('returns null when el lacks closest method', () => {
    const el = { textContent: '' } as unknown as HTMLElement
    expect(getHudContainer(el, '#container')).toBeNull()
  })

  it('calls el.closest with selector and returns result', () => {
    const mockContainer = makeEl()
    const el = {
      textContent: '',
      closest: vi.fn().mockReturnValue(mockContainer),
    } as unknown as HTMLElement
    const result = getHudContainer(el, '#health-display')
    expect((el as unknown as { closest: ReturnType<typeof vi.fn> }).closest).toHaveBeenCalledWith('#health-display')
    expect(result).toBe(mockContainer)
  })

  it('returns null when closest returns null', () => {
    const el = {
      textContent: '',
      closest: vi.fn().mockReturnValue(null),
    } as unknown as HTMLElement
    expect(getHudContainer(el, '#missing')).toBeNull()
  })
})

describe('updateIconMeter', () => {
  const makeContainer = (icons: HTMLElement[]) => ({
    querySelectorAll: vi.fn().mockReturnValue(
      Object.assign(icons, { length: icons.length }),
    ),
  })

  const makeElWithContainer = (container: ReturnType<typeof makeContainer>) => ({
    textContent: '',
    closest: vi.fn().mockReturnValue(container),
  } as unknown as HTMLElement)

  it('does nothing when valueElement is null', () => {
    // Should not throw
    expect(() => updateIconMeter(null, '#health-display', 5, 10)).not.toThrow()
  })

  it('does nothing when container is null', () => {
    const el = {
      textContent: '',
      closest: vi.fn().mockReturnValue(null),
    } as unknown as HTMLElement
    expect(() => updateIconMeter(el, '#health-display', 5, 10)).not.toThrow()
  })

  it('does nothing when max is 0', () => {
    const icon = makeIcon()
    const container = makeContainer([icon])
    const el = makeElWithContainer(container)
    updateIconMeter(el, '#health-display', 5, 0)
    expect((icon as unknown as { setAttribute: ReturnType<typeof vi.fn> }).setAttribute).not.toHaveBeenCalled()
  })

  it('sets full for icons that are fully covered', () => {
    const icons = [makeIcon(), makeIcon()]
    const container = makeContainer(icons)
    const el = makeElWithContainer(container)
    // max=4, 2 icons => 2 points per icon; value=4 => both full
    updateIconMeter(el, '#health-display', 4, 4)
    expect((icons[0] as unknown as { setAttribute: ReturnType<typeof vi.fn> }).setAttribute).toHaveBeenCalledWith(
      'data-fill',
      'full',
    )
    expect((icons[1] as unknown as { setAttribute: ReturnType<typeof vi.fn> }).setAttribute).toHaveBeenCalledWith(
      'data-fill',
      'full',
    )
  })

  it('sets half for icons that are partially covered', () => {
    const icons = [makeIcon(), makeIcon()]
    const container = makeContainer(icons)
    const el = makeElWithContainer(container)
    // max=4, 2 icons => 2 points per icon; value=1 => icon[0]=half, icon[1]=empty
    updateIconMeter(el, '#health-display', 1, 4)
    expect((icons[0] as unknown as { setAttribute: ReturnType<typeof vi.fn> }).setAttribute).toHaveBeenCalledWith(
      'data-fill',
      'half',
    )
    expect((icons[1] as unknown as { setAttribute: ReturnType<typeof vi.fn> }).setAttribute).toHaveBeenCalledWith(
      'data-fill',
      'empty',
    )
  })

  it('sets empty for icons beyond the value', () => {
    const icons = [makeIcon(), makeIcon(), makeIcon()]
    const container = makeContainer(icons)
    const el = makeElWithContainer(container)
    // max=6, 3 icons => 2 points per icon; value=0 => all empty
    updateIconMeter(el, '#health-display', 0, 6)
    for (const icon of icons) {
      expect((icon as unknown as { setAttribute: ReturnType<typeof vi.fn> }).setAttribute).toHaveBeenCalledWith(
        'data-fill',
        'empty',
      )
    }
  })

  it('clamps value above max to max', () => {
    const icons = [makeIcon()]
    const container = makeContainer(icons)
    const el = makeElWithContainer(container)
    // max=2, 1 icon => 2 points per icon; value=999 => clamped to 2 => full
    updateIconMeter(el, '#health-display', 999, 2)
    expect((icons[0] as unknown as { setAttribute: ReturnType<typeof vi.fn> }).setAttribute).toHaveBeenCalledWith(
      'data-fill',
      'full',
    )
  })
})

describe('updateXpBar', () => {
  const makeFillEl = () => ({ style: { width: '' } } as unknown as HTMLElement)

  const makeXpContainer = (fillEl: ReturnType<typeof makeFillEl>) => ({
    querySelector: vi.fn().mockReturnValue(fillEl),
  })

  const makeXpEl = (container: ReturnType<typeof makeXpContainer>) => ({
    textContent: '',
    closest: vi.fn().mockReturnValue(container),
  } as unknown as HTMLElement)

  it('does nothing when xpBarElement is null', () => {
    expect(() => updateXpBar(null, 50, 100)).not.toThrow()
  })

  it('does nothing when container is null', () => {
    const el = {
      textContent: '',
      closest: vi.fn().mockReturnValue(null),
    } as unknown as HTMLElement
    expect(() => updateXpBar(el, 50, 100)).not.toThrow()
  })

  it('does nothing when fill element is not found', () => {
    const container = { querySelector: vi.fn().mockReturnValue(null) }
    const el = {
      textContent: '',
      closest: vi.fn().mockReturnValue(container),
    } as unknown as HTMLElement
    expect(() => updateXpBar(el, 50, 100)).not.toThrow()
  })

  it('sets style.width to correct percentage', () => {
    const fillEl = makeFillEl()
    const container = makeXpContainer(fillEl)
    const el = makeXpEl(container)
    // 50 / 100 = 0.5 => 50%
    updateXpBar(el, 50, 100)
    expect(fillEl.style.width).toBe('50%')
  })

  it('sets style.width to 0% when xpRequiredForNext is 0', () => {
    const fillEl = makeFillEl()
    const container = makeXpContainer(fillEl)
    const el = makeXpEl(container)
    updateXpBar(el, 50, 0)
    expect(fillEl.style.width).toBe('0%')
  })

  it('clamps width to 100% when xpIntoLevel exceeds xpRequiredForNext', () => {
    const fillEl = makeFillEl()
    const container = makeXpContainer(fillEl)
    const el = makeXpEl(container)
    updateXpBar(el, 200, 100)
    expect(fillEl.style.width).toBe('100%')
  })

  it('rounds to one decimal place', () => {
    const fillEl = makeFillEl()
    const container = makeXpContainer(fillEl)
    const el = makeXpEl(container)
    // 1 / 3 = 0.3333... => Math.round(0.3333 * 1000) / 10 = 33.3%
    updateXpBar(el, 1, 3)
    expect(fillEl.style.width).toBe('33.3%')
  })
})
