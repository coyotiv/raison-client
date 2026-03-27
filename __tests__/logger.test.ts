import { describe, expect, it, vi } from 'vitest'
import { type Logger, createLogger, resolveLogger } from '../src/logger'

describe('createLogger', () => {
  it('creates a logger with default options', () => {
    const logger = createLogger()
    expect(logger).toHaveProperty('debug')
    expect(logger).toHaveProperty('info')
    expect(logger).toHaveProperty('warn')
    expect(logger).toHaveProperty('error')
  })

  it('filters messages below configured level', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const logger = createLogger({ level: 'info' })
    logger.debug('should not appear')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('allows messages at configured level', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = createLogger({ level: 'info' })
    logger.info('should appear')
    expect(spy).toHaveBeenCalledWith('[Raison]', 'should appear')
    spy.mockRestore()
  })

  it('allows messages above configured level', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger({ level: 'info' })
    logger.error('should appear')
    expect(spy).toHaveBeenCalledWith('[Raison]', 'should appear')
    spy.mockRestore()
  })

  it('defaults to warn level', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = createLogger()
    logger.info('no')
    logger.warn('yes')
    expect(infoSpy).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[Raison]', 'yes')
    infoSpy.mockRestore()
    warnSpy.mockRestore()
  })

  it('uses custom prefix', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = createLogger({ prefix: '[Custom]' })
    logger.warn('test')
    expect(spy).toHaveBeenCalledWith('[Custom]', 'test')
    spy.mockRestore()
  })

  it('passes extra arguments through', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger()
    logger.error('msg', { detail: 1 })
    expect(spy).toHaveBeenCalledWith('[Raison]', 'msg', { detail: 1 })
    spy.mockRestore()
  })
})

describe('resolveLogger', () => {
  it('creates default logger when input is undefined', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = resolveLogger(undefined)
    logger.warn('test')
    expect(spy).toHaveBeenCalledWith('[Raison]', 'test')
    spy.mockRestore()
  })

  it('returns custom logger as-is when all methods present', () => {
    const custom: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
    const logger = resolveLogger(custom)
    expect(logger).toBe(custom)
  })

  it('creates logger from LoggingOptions', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const logger = resolveLogger({ level: 'debug' })
    logger.debug('test')
    expect(spy).toHaveBeenCalledWith('[Raison]', 'test')
    spy.mockRestore()
  })

  it('creates logger from LoggingOptions with custom prefix', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const logger = resolveLogger({ prefix: '[MyApp]' })
    logger.warn('test')
    expect(spy).toHaveBeenCalledWith('[MyApp]', 'test')
    spy.mockRestore()
  })
})
