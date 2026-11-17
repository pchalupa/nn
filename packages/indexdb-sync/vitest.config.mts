import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
	test: {
		setupFiles: ["fake-indexeddb/auto"],
	},
});

export default config;
