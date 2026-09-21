import type { Page, TestInfo } from '@playwright/test';

/**
 * Attaches listeners to capture real frontend execution problems against prod:
 *  - Uncaught JS errors (pageerror)
 *  - console.error messages
 *  - HTTP responses with status >= 500
 *
 * Returns an accessor with the collected problems so specs can assert on them.
 * Use at the start of each prod-smoke test.
 */
export interface PageProblems {
  consoleErrors: string[];
  pageErrors: string[];
  serverErrors: string[]; // "<status> <url>"
}

export function attachConsoleGuard(page: Page, testInfo?: TestInfo): PageProblems {
  const problems: PageProblems = { consoleErrors: [], pageErrors: [], serverErrors: [] };

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      problems.consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    problems.pageErrors.push(err.message);
  });

  page.on('response', (res) => {
    if (res.status() >= 500) {
      problems.serverErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  if (testInfo) {
    testInfo.annotations.push({ type: 'prod-smoke', description: 'console/5xx guard attached' });
  }

  return problems;
}

/** Convenience assertion message builder. */
export function describeProblems(p: PageProblems): string {
  return [
    p.pageErrors.length ? `JS errors: ${p.pageErrors.join(' | ')}` : '',
    p.consoleErrors.length ? `console.error: ${p.consoleErrors.join(' | ')}` : '',
    p.serverErrors.length ? `5xx: ${p.serverErrors.join(' | ')}` : '',
  ].filter(Boolean).join('\n');
}
