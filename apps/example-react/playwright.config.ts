import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3100";

process.env.LOG_LEVEL ??= "silent";

export default defineConfig({
	testDir: "./e2e",
	testMatch: "**/*.spec.ts",
	fullyParallel: true,
	reporter: "list",
	use: {
		baseURL,
		trace: "on-first-retry",
	},
	projects: [
		{ name: "chromium", use: devices["Desktop Chrome"] },
	],
	webServer: {
		reuseExistingServer: true,
		command: "pnpm exec vite --mode test --port 3100",
		url: baseURL,
	},
});
