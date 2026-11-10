import { libraryConfig } from "@nn/build-config/tsdown";

export default libraryConfig({
	index: "src/index.ts",
	"array-schema": "src/array-schema.ts",
	"boolean-schema": "src/boolean-schema.ts",
	"enumeration-schema": "src/enumeration-schema.ts",
	"number-schema": "src/number-schema.ts",
	"object-schema": "src/object-schema.ts",
	"string-schema": "src/string-schema.ts",
});
