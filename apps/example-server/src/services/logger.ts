import pino from "pino";

const log = pino({
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
			translateTime: "SYS:standard",
			ignore: "pid,hostname",
		},
	},
});

const logger = {
	info: log.info.bind(log),
	warn: log.warn.bind(log),
	error: log.error.bind(log),
	debug: log.debug.bind(log),
	fatal: log.fatal.bind(log),
	trace: log.trace.bind(log),
};

export default logger;
