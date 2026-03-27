import Handlebars from 'handlebars'
import { createDatabase, type Model } from 'memgoose'
import { io, type Socket } from 'socket.io-client'
import { type Logger, type LoggingOptions, resolveLogger } from './logger'
import { type Prompt, promptSchema } from './prompt'

export interface RaisonConfig {
  apiKey: string
  baseUrl?: string
  logger?: Logger | LoggingOptions
}

export class Raison {
  static readonly BASE_URL = 'https://api.raison.ist'

  static registerHelper(name: string, fn: Handlebars.HelperDelegate): void {
    Handlebars.registerHelper(name, fn)
  }

  private socket: Socket
  private Prompt: Model<Prompt>
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

    this.socket = io(`${baseUrl}/sdk`, {
      path: '/socket/',
      auth: { apiKey: config.apiKey },
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    this.socket.on('connect', () => {
      this.logger.info(`Connected to ${baseUrl}`)
    })

    this.socket.on('disconnect', () => {
      this.logger.info('Disconnected')
    })

    this.socket.io.on('reconnect_attempt', () => {
      this.logger.debug('Reconnecting...')
    })

    this.socket.on('connect_error', (err: Error) => {
      this.logger.error(`Connection error: ${err.message}`)
    })

    this.socket.on('sync', async (data: { prompts: Prompt[] }) => {
      const incomingIds = data.prompts.map((p) => p.id)

      for (const prompt of data.prompts) {
        await this.Prompt.findOneAndUpdate({ id: prompt.id }, prompt, { upsert: true })
      }

      await this.Prompt.deleteMany({ id: { $nin: incomingIds } })

      resolveReady()
      this.logger.debug(`Synced ${data.prompts.length} prompt(s)`)
    })

    this.socket.on('prompt:deployed', async (prompt: Prompt) => {
      await this.Prompt.findOneAndUpdate({ id: prompt.id }, prompt, { upsert: true })
      this.logger.debug(`Prompt updated: ${prompt.id}`)
    })
  }

  async render(promptId: string, variables?: Record<string, unknown>): Promise<string> {
    await this.readyPromise

    const prompt = await this.Prompt.findOne({ id: promptId })
    if (!prompt?.content) {
      this.logger.warn(`Prompt not found: ${promptId}`)
      return ''
    }

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
