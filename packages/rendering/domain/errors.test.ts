import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { TextureError, MeshError } from './errors'

describe('TextureError', () => {
  it('message contains the url', () => {
    const err = new TextureError({ url: 'https://example.com/texture.png' })
    expect(err.message).toContain('https://example.com/texture.png')
  })

  it('message appends cause string when cause is an Error', () => {
    const cause = new Error('network timeout')
    const err = new TextureError({ url: 'https://example.com/t.png', cause })
    expect(err.message).toContain('network timeout')
  })

  it('no trailing colon when cause is undefined', () => {
    const err = new TextureError({ url: 'https://example.com/t.png' })
    expect(err.message.endsWith(':')).toBe(false)
    expect(err.message).toBe('Failed to load texture from https://example.com/t.png')
  })
})

describe('MeshError', () => {
  it('message contains the reason', () => {
    const err = new MeshError({ reason: 'invalid geometry' })
    expect(err.message).toContain('invalid geometry')
  })

  it('message appends details in parentheses when provided', () => {
    const err = new MeshError({ reason: 'invalid geometry', details: 'chunk (3,5)' })
    expect(err.message).toContain('(chunk (3,5))')
  })

  it('message appends cause string when cause is an Error', () => {
    const cause = new Error('buffer overflow')
    const err = new MeshError({ reason: 'invalid geometry', cause })
    expect(err.message).toContain('buffer overflow')
  })

  it('message with no details and no cause is just "Mesh generation failed: {reason}"', () => {
    const err = new MeshError({ reason: 'missing normals' })
    expect(err.message).toBe('Mesh generation failed: missing normals')
  })
})
