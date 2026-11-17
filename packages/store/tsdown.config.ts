import { libraryConfig, type UserConfig } from "@nn/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/store.ts",
});

export default config;
