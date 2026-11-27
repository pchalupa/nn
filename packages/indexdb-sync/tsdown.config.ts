import { libraryConfig, type UserConfig } from "@goodstate/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/index-db-sync.ts",
});

export default config;
