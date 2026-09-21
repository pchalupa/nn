import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: ["packages/*", "apps/*"],
		coverage: {
			exclude: ["**/coverage", "**/dist", "**/*.config.*", "**/*.gen.*"],
		},
	},
});
