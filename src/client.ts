import Handlebars from 'handlebars'
import { createDatabase } from 'memgoose'
import { io, type Socket } from 'socket.io-client'
import { type Logger, type LoggingOptions, resolveLogger } from './logger'
import { type Prompt, promptSchema } from './prompt'

export interface ReconnectionConfig {
  maxRetries?: number
  delay?: number
  delayMax?: number
}

export interface RaisonConfig {
  apiKey: string
  baseUrl?: string
  logger?: Logger | LoggingOptions
  reconnection?: ReconnectionConfig | false
}

export class Raison {
  static readonly BASE_URL = 'https://api.raison.ist'

  static registerHelper(name: string, fn: Handlebars.HelperDelegate): void {
    Handlebars.registerHelper(name, fn)
  }

  private socket: Socket
  private Prompt
  private readyPromise: Promise<void>
  private logger: Logger

  constructor(config: RaisonConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required')
    }
    if (!config.apiKey.startsWith('rsn_')) {
      throw new Error('Invalid API key format')
    }

    this.logger = resolveLogger(config.logger)

    const db = createDatabase({ storage: 'memory' })
    this.Prompt = db.model<Prompt>('Prompt', promptSchema)

    let resolveReady: () => void
    this.readyPromise = new Promise((resolve) => {
      resolveReady = resolve
    })

    const baseUrl = (config.baseUrl ?? Raison.BASE_URL).replace(/\/$/, '')

    const reconnection = config.reconnection !== false
    const reconnectionOpts = typeof config.reconnection === 'object' ? config.reconnection : {}

    this.socket = io(`${baseUrl}/sdk`, {
      path: '/socket/',
      auth: { apiKey: config.apiKey },
      transports: ['websocket', 'polling'],
      reconnection,
      reconnectionAttempts: reconnectionOpts.maxRetries ?? 10,
      reconnectionDelay: reconnectionOpts.delay ?? 1000,
      reconnectionDelayMax: reconnectionOpts.delayMax ?? 30000,
    })

    this.socket.on('connect', () => {
      this.logger.info(`Connected to ${baseUrl}`)
    })

    this.socket.on('disconnect', () => {
      this.logger.info('Disconnected')
    })

    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.logger.info(`Reconnection attempt ${attempt}/${reconnectionOpts.maxRetries ?? 10}`)
    })

    this.socket.io.on('reconnect', () => {
      this.logger.info('Reconnected successfully')
    })

    this.socket.io.on('reconnect_failed', () => {
      this.logger.error('Reconnection failed after maximum attempts')
    })

    this.socket.on('connect_error', (err: Error) => {
      this.logger.error(`Connection error: ${err.message}`)
    })

    this.socket.on('sync', async (data: { prompts: Prompt[] }) => {
      const incomingIds = data.prompts.map((p) => p.id)

      for (const prompt of data.prompts) {
        await this.Prompt.findOneAndUpdate({ id: prompt.id }, prompt, { upsert: true })
        this.logger.debug(`Synced prompt "${prompt.name}" (id=${prompt.id}, v${prompt.version})`)
      }

      await this.Prompt.deleteMany({ id: { $nin: incomingIds } })

      resolveReady()
      this.logger.debug(`Sync complete: ${data.prompts.length} prompt(s)`)
    })

    this.socket.on('prompt:deployed', async (prompt: Prompt) => {
      await this.Prompt.findOneAndUpdate({ id: prompt.id }, prompt, { upsert: true })
      this.logger.debug(`Prompt deployed: "${prompt.name}" (id=${prompt.id}, v${prompt.version})`)
    })
  }

  async render(promptId: string, variables?: Record<string, unknown>): Promise<string> {
    await this.readyPromise

    const prompt = await this.Prompt.findOne({ id: promptId })
    if (!prompt?.content) {
      this.logger.warn(`Prompt not found: ${promptId}`)
      return ''
    }

    this.logger.debug(`Rendering prompt "${prompt.name}" (id=${promptId}, v${prompt.version})`)

    if (!variables) return prompt.content

    try {
      const template = Handlebars.compile(prompt.content, { noEscape: true })
      return template(variables)
    } catch {
      this.logger.warn(`Template compile failed for prompt: ${promptId}`)
      return prompt.content
    }
  }

  async find(params?: Partial<Prompt>): Promise<Prompt[]> {
    await this.readyPromise

    return this.Prompt.find(params ?? {})
  }

  async findOne(params: Partial<Prompt>): Promise<Prompt | null> {
    await this.readyPromise

    return this.Prompt.findOne(params)
  }

  disconnect(): void {
    this.socket.disconnect()
  }
}
