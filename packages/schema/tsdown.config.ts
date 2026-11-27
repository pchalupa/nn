import { libraryConfig, type UserConfig } from "@goodstate/build-config/tsdown";

const config: UserConfig = libraryConfig({
	index: "src/index.ts",
	"array-schema": "src/array-schema.ts",
	"boolean-schema": "src/boolean-schema.ts",
	"enumeration-schema": "src/enumeration-schema.ts",
	"number-schema": "src/number-schema.ts",
	"object-schema": "src/object-schema.ts",
	"string-schema": "src/string-schema.ts",
});

export default config;
