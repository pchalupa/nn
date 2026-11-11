import { libraryConfig } from "@nn/build-config/tsdown";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "tsdown";

export default defineConfig({
	...libraryConfig({
		index: "src/index.ts",
	}),
	plugins: [babel({ plugins: [["babel-plugin-react-compiler", { target: "19", panicThreshold: "all_errors" }]] })],
});
