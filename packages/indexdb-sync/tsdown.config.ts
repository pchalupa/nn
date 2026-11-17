import { libraryConfig, type UserConfig } from "@nn/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/index-db-sync.ts",
});

export default config;
