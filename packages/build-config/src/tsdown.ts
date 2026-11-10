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
		exports: { devExports: "@nn/source" },
		publint: true,
		attw: { profile: "esm-only" },
	});
}
