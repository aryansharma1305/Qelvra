import { test as base, expect } from "@playwright/test";

interface Fixtures {
  /** Console errors a test expects (e.g. a deliberately failed request). */
  allowedConsoleErrors: RegExp[];
  consoleErrors: string[];
}

/** Fails any test whose page logs an unexpected console error or throws. */
export const test = base.extend<Fixtures>({
  allowedConsoleErrors: [[], { option: true }],
  consoleErrors: [
    async ({ page, allowedConsoleErrors }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        const text = message.text();
        if (message.type() === "error" && !allowedConsoleErrors.some((re) => re.test(text))) {
          errors.push(text);
        }
      });
      await use(errors);
      expect(errors, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
