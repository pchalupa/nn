import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import codspeedPlugin from "@codspeed/vitest-plugin";
import { libraryConfig } from "@nn/build-config/tsdown";
import { build } from "tsdown";
import type { Plugin } from "vitest/config";

const bundledImport = /^import (?!type )[^;]*? from "((?:\.{1,2}\/|@nn\/)[^"]+)";$/gm;

/** CodSpeed plus {@link bundleForBenchmark}, so benchmarks measure built code. */
export function benchmarkPlugin(): Plugin[] {
	return [codspeedPlugin(), bundleForBenchmark()];
}

function bundleForBenchmark(): Plugin {
	const bundled = new Map<string, string>();

	return {
		name: "nn:bundle-for-benchmark",
		enforce: "pre",
		async configureVitest({ project }) {
			if (!project.config.benchmark.enabled) return;

			const root = project.config.root;
			const outDir = join(root, "node_modules/.cache/benchmark");
			const { testFiles } = await project.globTestFiles();
			const entry: Record<string, string> = {};

			for (const file of testFiles) {
				for (const [, specifier] of readFileSync(file, "utf8").matchAll(bundledImport)) {
					const resolution = await project.vite.environments.ssr.pluginContainer.resolveId(specifier, file);

					if (resolution) {
						let name = specifier;

						if (!specifier.startsWith("@nn/")) name = relative(root, resolution.id).replace(/\.[cm]?[jt]sx?$/, "");

						entry[name] = resolution.id;
						bundled.set(`${file}\0${specifier}`, join(outDir, `${name}.js`));
					}
				}
			}

			if (bundled.size) {
				await build({
					...libraryConfig(entry),
					unbundle: false,
					dts: false,
					deps: { alwaysBundle: [/^@nn\//] },
					exports: false,
					publint: false,
					attw: false,
					cwd: root,
					outDir,
					config: false,
					logLevel: "warn",
				});
			}
		},
		resolveId(source, importer) {
			if (importer) return bundled.get(`${importer}\0${source}`);
		},
	};
}
