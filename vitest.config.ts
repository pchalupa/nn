import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		workspace: ["packages/*", "apps/*"],
		coverage: {
			exclude: ["**/coverage", "**/dist", "**/*.config.*", "**/*.gen.*"],
		},
	},
});
