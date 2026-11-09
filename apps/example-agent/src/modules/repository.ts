import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const options = { cwd: import.meta.dirname };

export async function getRepositoryRoot() {
	const { stdout } = await run("git", ["rev-parse", "--show-toplevel"], options);

	return stdout.trim();
}

export async function getRepositoryFiles() {
	const { stdout } = await run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--full-name", ":/"], options);

	return stdout.split("\n").filter(Boolean);
}
