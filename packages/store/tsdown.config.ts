import { libraryConfig, type UserConfig } from "@goodstate/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/store.ts",
});

export default config;
