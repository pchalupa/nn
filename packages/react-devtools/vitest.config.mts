import { defineConfig, type ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		restoreMocks: true,
		unstubEnvs: true,
		unstubGlobals: true,
	},
});

export default config;
