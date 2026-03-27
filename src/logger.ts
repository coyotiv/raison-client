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

export function createLogger(options?: LoggingOptions): Logger {
  const level = options?.level ?? 'warn'
  const prefix = options?.prefix ?? '[Raison]'
  const threshold = LOG_LEVELS[level]

  function log(method: LogLevel, message: string, ...args: unknown[]): void {
    if (LOG_LEVELS[method] >= threshold) {
      console[method](prefix, message, ...args)
    }
  }

  return {
    debug: (message, ...args) => log('debug', message, ...args),
    info: (message, ...args) => log('info', message, ...args),
    warn: (message, ...args) => log('warn', message, ...args),
    error: (message, ...args) => log('error', message, ...args),
  }
}

function isLogger(value: unknown): value is Logger {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Logger).debug === 'function' &&
    typeof (value as Logger).info === 'function' &&
    typeof (value as Logger).warn === 'function' &&
    typeof (value as Logger).error === 'function'
  )
}

export function resolveLogger(input?: Logger | LoggingOptions): Logger {
  if (!input) return createLogger()
  if (isLogger(input)) return input
  return createLogger(input)
}
