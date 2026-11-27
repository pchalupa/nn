import { libraryConfig, type UserConfig } from "@goodstate/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/time.ts",
});

export default config;
