import babel from "@rolldown/plugin-babel";
import { defineConfig, type UserConfig } from "tsdown";

export function libraryConfig(entry: UserConfig["entry"]): UserConfig {
	return defineConfig({
		entry,
		format: "esm",
		platform: "neutral",
		target: "es2022",
		unbundle: true,
		sourcemap: true,
		dts: true,
		clean: true,
		deps: { neverBundle: [/^@nn\//] },
		exports: { devExports: true },
		publint: true,
		attw: { profile: "esm-only" },
	});
}

export function reactLibraryConfig(entry: UserConfig["entry"]): UserConfig {
	return defineConfig({
		...libraryConfig(entry),
		plugins: [babel({ plugins: [["babel-plugin-react-compiler", { target: "19", panicThreshold: "all_errors" }]] })],
	});
}
