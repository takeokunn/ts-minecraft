import { describe, it, expect } from 'vitest';
import { queries } from './queries';
import { componentNames } from './components';

describe('domain/queries', () => {
  it('should have unique query names', () => {
    const names = queries.map(q => q.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('should have at least one component in each query', () => {
    for (const query of queries) {
      expect(query.components.length).toBeGreaterThan(0);
    }
  });

  it('should only contain valid component names', () => {
    const allComponentNames = new Set(componentNames);
    for (const query of queries) {
      for (const component of query.components) {
        expect(allComponentNames.has(component)).toBe(true);
      }
    }
  });
});
