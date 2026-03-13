/**
 * Optional logger interface for server SDK.
 * Implement this to integrate with your application's logging framework.
 */
export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Default console logger used when no custom logger is provided.
 */
export class ConsoleLogger implements ILogger {
  constructor(private readonly prefix: string = "[YAAA]") {}

  debug(message: string, ...args: unknown[]): void {
    console.debug(`${this.prefix} ${message}`, ...args);
  }

  log(message: string, ...args: unknown[]): void {
    console.log(`${this.prefix} ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`${this.prefix} ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`${this.prefix} ${message}`, ...args);
  }
}

/**
 * Silent logger that suppresses all output.
 */
export class SilentLogger implements ILogger {
  debug(): void {}
  log(): void {}
  warn(): void {}
  error(): void {}
}
