import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		workspace: ["packages/*", "example"],
		coverage: {
			exclude: ["**/coverage", "**/dist", "**/*.config.*", "**/*.gen.*"],
		},
	},
});
