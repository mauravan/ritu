import pino from "pino";

const level = (process.env.LOG_LEVEL as string) || "info";
const pretty = process.env.LOG_PRETTY === "1" || process.env.LOG_PRETTY === "true";

const baseConfig = {
  level,
  base: { tag: "RITU" },
};

/** Singleton — ensures single logger instance across modules.
 * Participants: Client (callers import `Logger.getInstance()`), Singleton (`Logger` class), Logger Instance (internal `pino` instance).
 */
export class Logger {
  private static instance: Logger;
  private pinoInstance: pino.Logger;

  private constructor() {
    this.pinoInstance = pretty
      ? pino({ ...baseConfig, transport: { target: "pino-pretty" } })
      : pino(baseConfig);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  debug(...args: Parameters<pino.Logger["debug"]>): void {
    this.pinoInstance.debug(...args);
  }

  info(...args: Parameters<pino.Logger["info"]>): void {
    this.pinoInstance.info(...args);
  }

  warn(...args: Parameters<pino.Logger["warn"]>): void {
    this.pinoInstance.warn(...args);
  }

  error(...args: Parameters<pino.Logger["error"]>): void {
    this.pinoInstance.error(...args);
  }
}

const instance = Logger.getInstance();
export const logger = {
  debug: instance.debug.bind(instance),
  info: instance.info.bind(instance),
  warn: instance.warn.bind(instance),
  error: instance.error.bind(instance),
};

export default Logger.getInstance();
