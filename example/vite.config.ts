import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
/// <reference types="vitest" />
import { defineConfig } from "vite";

const reactCompilerConfig = {
	target: "19",
};

export default defineConfig({
	plugins: [
		TanStackRouterVite(),
		react({ babel: { plugins: [["babel-plugin-react-compiler", reactCompilerConfig]] } }),
		tailwindcss(),
	],
	esbuild: {
		target: "es2022",
	},
	test: {
		globals: true,
		environment: "jsdom",
	},
});
