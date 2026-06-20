
/**
 * Monitors browser failures that should fail E2E.
 * The game intentionally uses console.error for non-fatal Effect pipeline errors —
 * do NOT use this to assert "no console.error" broadly.
 * Only page errors and browser-runtime console errors are considered fatal here.
 */
const FATAL_CONSOLE_PATTERNS = [
  'Failed to start application',
  'ReferenceError:',
  'TypeError:',
  'SyntaxError:',
  'RangeError:',
  'Unhandled Promise Rejection',
  'Uncaught',
] as const

const isFatalConsoleMessage = (message: string): boolean =>
  FATAL_CONSOLE_PATTERNS.some((pattern) => message.includes(pattern))

export function attachFatalErrorMonitor(page: Page): () => string[] {
  const fatalErrors: string[] = []

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error' && isFatalConsoleMessage(msg.text())) {
      fatalErrors.push(msg.text())
    }
  })

  page.on('pageerror', (error: Error) => {
    fatalErrors.push(error.stack ?? error.message)
  })

  return () => [...fatalErrors]
}
