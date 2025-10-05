module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true }
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "^src/main.ts$",
          "^src/index.ts$",
          "^src/app.ts$"
        ]
      },
      to: {}
    },
    {
      name: "no-domain-to-outer",
      severity: "error",
      from: {
        path: "^src/domain/",
        pathNot: [
          "__tests__/",
          "__mocks__/",
          "spec\\.ts$",
          "spec\\.tsx$",
          "test\\.ts$",
          "test\\.tsx$"
        ]
      },
      to: {
        path: "^src/(application|infrastructure|presentation|bootstrap|testing)/"
      }
    },
    {
      name: "no-application-to-infra",
      severity: "error",
      from: {
        path: "^src/application/"
      },
      to: {
        path: "^src/(infrastructure|presentation|bootstrap)/"
      }
    },
    {
      name: "presentation-through-application",
      severity: "warn",
      from: {
        path: "^src/presentation/"
      },
      to: {
        path: "^src/domain/"
      }
    }
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json"
    },
    tsPreCompilationDeps: true,
    doNotFollow: {
      path: "^node_modules"
    },
    includeOnly: "^src/"
  }
};
