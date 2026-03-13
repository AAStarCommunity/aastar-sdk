import { ConsoleLogger, SilentLogger } from "../interfaces/logger";

describe("ConsoleLogger", () => {
  let logger: ConsoleLogger;
  const spies: Record<string, jest.SpyInstance> = {};

  beforeEach(() => {
    logger = new ConsoleLogger("[TEST]");
    spies.debug = jest.spyOn(console, "debug").mockImplementation();
    spies.log = jest.spyOn(console, "log").mockImplementation();
    spies.warn = jest.spyOn(console, "warn").mockImplementation();
    spies.error = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    Object.values(spies).forEach(s => s.mockRestore());
  });

  it("should prefix debug messages", () => {
    logger.debug("hello");
    expect(spies.debug).toHaveBeenCalledWith("[TEST] hello");
  });

  it("should prefix log messages", () => {
    logger.log("info message");
    expect(spies.log).toHaveBeenCalledWith("[TEST] info message");
  });

  it("should prefix warn messages", () => {
    logger.warn("warning");
    expect(spies.warn).toHaveBeenCalledWith("[TEST] warning");
  });

  it("should prefix error messages", () => {
    logger.error("failure");
    expect(spies.error).toHaveBeenCalledWith("[TEST] failure");
  });

  it("should pass extra args through", () => {
    logger.log("count", 42, { key: "val" });
    expect(spies.log).toHaveBeenCalledWith("[TEST] count", 42, { key: "val" });
  });

  it("should use default prefix when none provided", () => {
    const defaultLogger = new ConsoleLogger();
    defaultLogger.log("msg");
    expect(spies.log).toHaveBeenCalledWith("[YAAA] msg");
  });
});

describe("SilentLogger", () => {
  let logger: SilentLogger;

  beforeEach(() => {
    logger = new SilentLogger();
  });

  it("should not throw on any method call", () => {
    expect(() => logger.debug("a")).not.toThrow();
    expect(() => logger.log("b")).not.toThrow();
    expect(() => logger.warn("c")).not.toThrow();
    expect(() => logger.error("d")).not.toThrow();
  });

  it("should not output to console", () => {
    const spy = jest.spyOn(console, "log").mockImplementation();
    logger.log("silent");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
