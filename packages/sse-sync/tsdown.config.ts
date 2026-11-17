import { libraryConfig, type UserConfig } from "@nn/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/sse-sync.ts",
});

export default config;
