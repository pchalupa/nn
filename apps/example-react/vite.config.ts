import Babel from "@rolldown/plugin-babel";
import TailwindCSS from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { withRelatedProject } from "@vercel/related-projects";
import React, { reactCompilerPreset } from "@vitejs/plugin-react";
/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const serverHost = withRelatedProject({ projectName: "nn-example-server", defaultHost: "" });

if (serverHost) {
	process.env.VITE_REMOTE_URL = new URL("/sync", serverHost).href;
}

export default defineConfig(({ mode }) => ({
	plugins: [
		VitePWA({ registerType: "autoUpdate", devOptions: { enabled: true } }),
		tanstackRouter(),
		React(),
		Babel({ presets: [reactCompilerPreset({ target: "19" })] }),
		TailwindCSS(),
	],
	oxc: {
		target: "es2022",
	},
	test: {
		globals: true,
		environment: "jsdom",
		exclude: ["**/node_modules/**", "e2e/**"],
		setupFiles: ["fake-indexeddb/auto"],
		env: loadEnv(mode, process.cwd(), ""),
	},
}));
