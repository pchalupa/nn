import Babel from "@rolldown/plugin-babel";
import TailwindCSS from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import React, { reactCompilerPreset } from "@vitejs/plugin-react";
/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const reactCompilerConfig = {
	target: "19" as const,
};

export default defineConfig(({ mode }) => ({
	plugins: [
		VitePWA({ registerType: "autoUpdate", devOptions: { enabled: true } }),
		tanstackRouter(),
		React(),
		Babel({ presets: [reactCompilerPreset(reactCompilerConfig)] }),
		TailwindCSS(),
	],
	oxc: {
		target: "es2022",
	},
	test: {
		globals: true,
		environment: "jsdom",
		exclude: ["**/node_modules/**", "e2e/**"],
		setupFiles: ["vitest.setup.ts"],
		env: loadEnv(mode, process.cwd(), ""),
	},
}));
