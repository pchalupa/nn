import pino from "pino";
import pretty from "pino-pretty";

const log = pino(
	{ level: process.env.LOG_LEVEL ?? "info" },
	pretty({
		translateTime: "SYS:standard",
		ignore: "pid,hostname",
	}),
);

const logger = {
	info: log.info.bind(log),
	warn: log.warn.bind(log),
	error: log.error.bind(log),
	debug: log.debug.bind(log),
	fatal: log.fatal.bind(log),
	trace: log.trace.bind(log),
};

export default logger;
