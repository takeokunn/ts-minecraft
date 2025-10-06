module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '^src/main.ts$',
          '^src/index.ts$',
          '^src/app.ts$',
          '__tests__/',
          '\.[Ss]pec\.(ts|tsx)$',
          '\.[Tt]est\.(ts|tsx)$',
        ],
      },
      to: {},
    },
    {
      name: 'no-domain-to-outer',
      severity: 'error',
      from: {
        path: '^src/domain/',
        pathNot: ['__tests__/', '__mocks__/', 'spec\\.ts$', 'spec\\.tsx$', 'test\\.ts$', 'test\\.tsx$'],
      },
      to: {
        path: '^src/(application|infrastructure|presentation|bootstrap|testing)/',
      },
    },
    {
      name: 'no-application-to-infra',
      severity: 'error',
      from: {
        path: '^src/application/',
      },
      to: {
        path: '^src/(infrastructure|presentation|bootstrap)/',
      },
    },
    {
      name: 'presentation-through-application',
      severity: 'warn',
      from: {
        path: '^src/presentation/',
      },
      to: {
        path: '^src/domain/',
      },
    },
    {
      name: 'enforce-index-imports',
      severity: 'warn',
      comment: 'Import from index.ts instead of internal files (except in tests)',
      from: {
        path: '^src/(domain|application|infrastructure|presentation)/',
        pathNot: ['__tests__/', '\.[Ss]pec\.(ts|tsx)$', '\.[Tt]est\.(ts|tsx)$', 'index\.(ts|tsx)$'],
      },
      to: {
        path: '^src/(domain|application|infrastructure|presentation)/.+/.+\.(ts|tsx)$',
        pathNot: ['/index\.ts$', '__tests__/', '\.[Ss]pec\.(ts|tsx)$', '\.[Tt]est\.(ts|tsx)$'],
      },
    },
    {
      name: 'no-alias-within-domain',
      severity: 'error',
      comment: 'Use relative paths within the same domain layer',
      from: {
        path: '^src/domain/',
      },
      to: {
        path: '^@domain/',
      },
    },
    {
      name: 'no-alias-within-application',
      severity: 'error',
      comment: 'Use relative paths within the same application layer',
      from: {
        path: '^src/application/',
      },
      to: {
        path: '^@application/',
      },
    },
    {
      name: 'no-alias-within-infrastructure',
      severity: 'error',
      comment: 'Use relative paths within the same infrastructure layer',
      from: {
        path: '^src/infrastructure/',
      },
      to: {
        path: '^@infrastructure/',
      },
    },
    {
      name: 'no-alias-within-presentation',
      severity: 'error',
      comment: 'Use relative paths within the same presentation layer',
      from: {
        path: '^src/presentation/',
      },
      to: {
        path: '^@presentation/',
      },
    },
    {
      name: 'no-alias-within-bootstrap',
      severity: 'error',
      comment: 'Use relative paths within the same bootstrap layer',
      from: {
        path: '^src/bootstrap/',
      },
      to: {
        path: '^@bootstrap/',
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,
    doNotFollow: {
      path: '^node_modules',
    },
    includeOnly: '^src/',
  },
}
