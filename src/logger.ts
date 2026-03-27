export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface LoggingOptions {
  level?: LogLevel
  prefix?: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export function createLogger(options?: LoggingOptions, base?: Logger): Logger {
  const level = options?.level ?? 'warn'
  const prefix = options?.prefix ?? '[Raison]'
  const threshold = LOG_LEVELS[level]

  function log(method: LogLevel, message: string, ...args: unknown[]): void {
    if (LOG_LEVELS[method] >= threshold) {
      if (base) {
        base[method](message, ...args)
      } else {
        console[method](prefix, message, ...args)
      }
    }
  }

  return {
    debug: (message, ...args) => log('debug', message, ...args),
    info: (message, ...args) => log('info', message, ...args),
    warn: (message, ...args) => log('warn', message, ...args),
    error: (message, ...args) => log('error', message, ...args),
  }
}

export function resolveLogger(logger?: Logger, options?: LoggingOptions): Logger {
  if (logger) return createLogger(options, logger)
  return createLogger(options)
}
