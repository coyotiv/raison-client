import Handlebars from 'handlebars'
import { createDatabase, type Model } from 'memgoose'
import { io, type Socket } from 'socket.io-client'
import { type Prompt, promptSchema } from './prompt'

export interface RaisonConfig {
  apiKey: string
  baseUrl?: string
}

export class Raison {
  static readonly BASE_URL = 'https://api.raison.ist'

  static registerHelper(name: string, fn: Handlebars.HelperDelegate): void {
    Handlebars.registerHelper(name, fn)
  }

  private socket: Socket
  private Prompt: Model<Prompt>
  private readyPromise: Promise<void>

  constructor(config: RaisonConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required')
    }
    if (!config.apiKey.startsWith('rsn_')) {
      throw new Error('Invalid API key format')
    }

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

    this.socket.on('sync', async (data: { prompts: Prompt[] }) => {
      const incomingIds = data.prompts.map((p) => p.id)

      for (const prompt of data.prompts) {
        await this.Prompt.findOneAndUpdate({ id: prompt.id }, prompt, { upsert: true })
      }

      await this.Prompt.deleteMany({ id: { $nin: incomingIds } })

      resolveReady()
    })

    this.socket.on('prompt:deployed', async (prompt: Prompt) => {
      await this.Prompt.findOneAndUpdate({ id: prompt.id }, prompt, { upsert: true })
    })
  }

  async render(promptId: string, variables?: Record<string, unknown>): Promise<string> {
    await this.readyPromise

    const prompt = await this.Prompt.findOne({ id: promptId })
    if (!prompt?.content) return ''

    if (!variables) return prompt.content

    try {
      const template = Handlebars.compile(prompt.content, { noEscape: true })
      return template(variables)
    } catch {
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
