import TailwindCSS from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import React from "@vitejs/plugin-react";
/// <reference types="vitest" />
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const reactCompilerConfig = {
	target: "19",
};

export default defineConfig({
	plugins: [
		VitePWA({ registerType: "autoUpdate", devOptions: { enabled: true } }),
		tanstackRouter(),
		React({ babel: { plugins: [["babel-plugin-react-compiler", reactCompilerConfig]] } }),
		TailwindCSS(),
	],
	esbuild: {
		target: "es2022",
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["vitest.setup.ts"],
	},
});
