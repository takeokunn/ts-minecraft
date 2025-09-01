import { describe } from 'vitest';
import { test } from '@fast-check/vitest';
import * as fc from 'fast-check';
import { expect } from 'vitest';

import { EntityId } from './entity';

describe('domain/entity', () => {
  test.prop([fc.integer()])('should be a number', (id: EntityId) => {
    expect(typeof id).toBe('number');
  });
});
