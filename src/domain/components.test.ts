import { describe, it, expect } from 'vitest';
import { componentNames } from './components';

describe('domain/components', () => {
  it('should have unique component names', () => {
    const uniqueNames = new Set(componentNames);
    expect(uniqueNames.size).toBe(componentNames.length);
  });
});
