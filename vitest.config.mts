import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: ["packages/*", "examples/*"],
		coverage: {
			exclude: ["**/coverage", "**/dist", "**/*.config.*", "**/*.gen.*"],
		},
	},
	cacheDir: "./node_modules/.cache/vitest",
});
