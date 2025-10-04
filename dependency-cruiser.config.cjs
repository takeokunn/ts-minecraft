/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    includeOnly: ['^src'],
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules',
      },
    },
  },
  forbidden: [
    {
      name: 'domain-to-infrastructure',
      comment: 'Domain 層から Infrastructure 層への依存は禁止',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(infrastructure|bounded-contexts/.*/infrastructure)' },
    },
    {
      name: 'presentation-to-domain',
      comment: 'Presentation 層は Domain 型に直接依存しない',
      severity: 'error',
      from: { path: '^src/presentation' },
      to: { path: '^src/domain' },
    },
    {
      name: 'bounded-context-to-legacy-root',
      comment: 'Bounded Context は旧階層を直接参照しない',
      severity: 'error',
      from: { path: '^src/bounded-contexts' },
      to: { path: '^src/(domain|application|infrastructure|presentation)' },
    },
    {
      name: 'bounded-context-to-legacy-alias',
      comment: 'Bounded Context は旧パスエイリアスを利用しない',
      severity: 'error',
      from: { path: '^src/bounded-contexts' },
      to: { path: '^@(?:domain|application|infrastructure|presentation)(/|$)' },
    },
    {
      name: 'cross-context-infrastructure',
      comment: 'Bounded Context 間での infrastructure 直接参照を禁止',
      severity: 'error',
      from: { path: '^src/bounded-contexts/([^/]+)/infrastructure' },
      to: {
        path: '^src/bounded-contexts/([^/]+)/',
        pathNot: '^src/bounded-contexts/$1/',
      },
    },
  ],
}
