import { Layer, Option } from 'effect'
import { vi } from 'vitest'
import { DomOperationsService, CrosshairService } from '@ts-minecraft/presentation/hud/crosshair'

type MockDomElement = {
  id: string
  style: { cssText: string }
  children: unknown[]
  parentNode: MockDomParent | null
  appendChild: (child: unknown) => unknown
}

type MockDomParent = {
  removeChild: (child: MockDomElement) => void
}

export const createMockDomLayer = () => {
  const createdElements: MockDomElement[] = []
  const mockBody: MockDomParent = {
    removeChild: vi.fn((element: MockDomElement) => {
      element.parentNode = null
    }),
  }
  const appendChildMock = vi.fn((element: MockDomElement) => {
    element.parentNode = mockBody
  })
  const removeChildMock = vi.fn((element: MockDomElement) => {
    element.parentNode = null
  })
  const createElementMock = vi.fn((_tagName: string) => {
    const element: MockDomElement = {
      id: '',
      style: { cssText: '' },
      children: [],
      parentNode: null,
      appendChild: vi.fn((child: unknown) => {
        element.children.push(child)
        return child
      }),
    }

    createdElements.push(element)

    return element
  })
  const getParentNodeMock = vi.fn((element: MockDomElement) => Option.fromNullable(element.parentNode))

  const MockDomLayer = Layer.succeed(
    DomOperationsService,
    DomOperationsService.of({
      _tag: '@minecraft/presentation/DomOperations' as const,
      createElement: createElementMock as DomOperationsService['createElement'],
      appendChild: appendChildMock as DomOperationsService['appendChild'],
      appendChildTo: vi.fn() as DomOperationsService['appendChildTo'],
      removeChild: removeChildMock as DomOperationsService['removeChild'],
      getParentNode: getParentNodeMock as DomOperationsService['getParentNode'],
      setInnerHTML: vi.fn() as DomOperationsService['setInnerHTML'],
      querySelector: vi.fn(() => Option.none()) as DomOperationsService['querySelector'],
    })
  )

  const TestLayer = CrosshairService.Default.pipe(Layer.provide(MockDomLayer))

  return {
    TestLayer,
    appendChildMock,
    removeChildMock,
    createElementMock,
    getParentNodeMock,
    getCreatedElements: () => createdElements,
  }
}
