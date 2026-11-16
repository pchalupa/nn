import { libraryConfig } from "@nn/build-config/tsdown";
import babel from "@rolldown/plugin-babel";
import reactCompiler from "babel-plugin-react-compiler";
import { defineConfig, type UserConfig } from "tsdown";

export function reactLibraryConfig(entry: UserConfig["entry"]): UserConfig {
	return defineConfig({
		...libraryConfig(entry),
		plugins: [babel({ plugins: [[reactCompiler, { target: "19", panicThreshold: "all_errors" }]] })],
	});
}
