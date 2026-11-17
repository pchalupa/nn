import { libraryConfig, type UserConfig } from "@nn/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/delegatable.ts",
	observable: "src/observable.ts",
});

export default config;
