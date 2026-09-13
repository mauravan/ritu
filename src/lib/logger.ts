import pino from "pino";

const level = (process.env.LOG_LEVEL as string) || "info";
const pretty = process.env.LOG_PRETTY === "1" || process.env.LOG_PRETTY === "true";

const baseConfig = {
  level,
  base: { tag: "RITU" },
};

const pinoInstance = pretty
  ? pino({ ...baseConfig, transport: { target: "pino-pretty" } })
  : pino(baseConfig);

export const logger = {
  debug: pinoInstance.debug.bind(pinoInstance),
  info: pinoInstance.info.bind(pinoInstance),
  warn: pinoInstance.warn.bind(pinoInstance),
  error: pinoInstance.error.bind(pinoInstance),
};

export default pinoInstance;
