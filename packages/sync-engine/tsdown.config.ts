import { libraryConfig, type UserConfig } from "@nn/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/sync-engine.ts",
});

export default config;
