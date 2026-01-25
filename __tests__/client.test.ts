import { io } from 'socket.io-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Raison } from '../src/client'
import type { Prompt } from '../src/prompt'

type SocketHandler = (...args: unknown[]) => unknown
let socketHandlers: Record<string, SocketHandler> = {}
const mockDisconnect = vi.fn()

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn((event: string, handler: SocketHandler) => {
      socketHandlers[event] = handler
    }),
    disconnect: mockDisconnect,
  })),
}))

async function simulateSync(prompts: Prompt[]) {
  await socketHandlers.sync?.({ prompts })
}

describe('Raison', () => {
  const mockPrompt: Prompt = {
    id: 'test-prompt-id',
    name: 'Test Prompt',
    agentId: 'test-agent-id',
    version: 1,
    content: 'Hello {{name}}!',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    socketHandlers = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('static properties', () => {
    it('has BASE_URL', () => {
      expect(Raison.BASE_URL).toBe('https://api.raison.ist')
    })
  })

  describe('registerHelper', () => {
    it('registers a helper that can be used in templates', async () => {
      Raison.registerHelper('uppercase', (str: string) => str.toUpperCase())

      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([{ ...mockPrompt, content: 'Hello {{uppercase name}}!' }])

      const result = await client.render('test-prompt-id', { name: 'world' })
      expect(result).toBe('Hello WORLD!')
    })

    it('registers a helper with multiple arguments', async () => {
      Raison.registerHelper('concat', (a: string, b: string) => `${a}-${b}`)

      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([{ ...mockPrompt, content: '{{concat first second}}' }])

      const result = await client.render('test-prompt-id', { first: 'hello', second: 'world' })
      expect(result).toBe('hello-world')
    })

    it('registers a json helper', async () => {
      Raison.registerHelper('json', (value: unknown) => JSON.stringify(value, null, 2))

      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([{ ...mockPrompt, content: '{{json data}}' }])

      const result = await client.render('test-prompt-id', { data: { foo: 1 } })
      expect(result).toBe('{\n  "foo": 1\n}')
    })
  })

  describe('constructor', () => {
    it('throws when API key is missing', () => {
      expect(() => new Raison({ apiKey: '' })).toThrow('API key is required')
    })

    it('throws when API key format is invalid', () => {
      expect(() => new Raison({ apiKey: 'invalid' })).toThrow('Invalid API key format')
    })

    it('creates instance with valid API key', () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      expect(client).toBeInstanceOf(Raison)
    })

    it('uses default BASE_URL', () => {
      new Raison({ apiKey: 'rsn_test123' })
      expect(io).toHaveBeenCalledWith('https://api.raison.ist/sdk', expect.any(Object))
    })

    it('uses custom baseUrl', () => {
      new Raison({ apiKey: 'rsn_test123', baseUrl: 'https://custom.api.com' })
      expect(io).toHaveBeenCalledWith('https://custom.api.com/sdk', expect.any(Object))
    })

    it('removes trailing slash from baseUrl', () => {
      new Raison({ apiKey: 'rsn_test123', baseUrl: 'https://custom.api.com/' })
      expect(io).toHaveBeenCalledWith('https://custom.api.com/sdk', expect.any(Object))
    })
  })

  describe('sync', () => {
    it('handles empty sync', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([])

      const result = await client.find()
      expect(result).toHaveLength(0)
    })

    it('removes stale prompts on sync', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })

      // Initial sync with two prompts
      await simulateSync([mockPrompt, { ...mockPrompt, id: 'stale-id', name: 'Stale' }])
      let result = await client.find()
      expect(result).toHaveLength(2)

      // Second sync without the stale prompt
      await socketHandlers.sync?.({ prompts: [mockPrompt] })
      result = await client.find()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('test-prompt-id')
    })
  })

  describe('render', () => {
    it('returns compiled string with variables', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      const promise = client.render('test-prompt-id', { name: 'World' })
      await simulateSync([mockPrompt])

      const result = await promise
      expect(result).toBe('Hello World!')
    })

    it('returns raw content when no variables', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt])

      const result = await client.render('test-prompt-id')
      expect(result).toBe('Hello {{name}}!')
    })

    it('returns empty string for non-existent prompt', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt])

      const result = await client.render('nonexistent')
      expect(result).toBe('')
    })

    it('returns empty string for prompt with empty content', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([{ ...mockPrompt, content: '' }])

      const result = await client.render('test-prompt-id', { name: 'World' })
      expect(result).toBe('')
    })

    it('returns raw content when compile fails', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([{ ...mockPrompt, content: 'Hello {{#if}}!' }])

      const result = await client.render('test-prompt-id', { name: 'World' })
      expect(result).toBe('Hello {{#if}}!')
    })
  })

  describe('find', () => {
    it('returns all prompts', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt, { ...mockPrompt, id: 'other-id' }])

      const result = await client.find()
      expect(result).toHaveLength(2)
    })

    it('filters by agentId', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt, { ...mockPrompt, id: 'other-id', agentId: 'other-agent' }])

      const result = await client.find({ agentId: 'test-agent-id' })
      expect(result).toHaveLength(1)
      expect(result[0].agentId).toBe('test-agent-id')
    })

    it('filters by name', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt, { ...mockPrompt, id: 'other-id', name: 'Other Prompt' }])

      const result = await client.find({ name: 'Test Prompt' })
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test Prompt')
    })

    it('filters by version', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt, { ...mockPrompt, id: 'other-id', version: 2 }])

      const result = await client.find({ version: 1 })
      expect(result).toHaveLength(1)
      expect(result[0].version).toBe(1)
    })
  })

  describe('findOne', () => {
    it('returns prompt by agentId and name', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt])

      const result = await client.findOne({ agentId: 'test-agent-id', name: 'Test Prompt' })
      expect(result?.id).toBe('test-prompt-id')
    })

    it('returns prompt by id', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt])

      const result = await client.findOne({ id: 'test-prompt-id' })
      expect(result?.name).toBe('Test Prompt')
    })

    it('returns null for non-existent prompt', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt])

      const result = await client.findOne({ agentId: 'test-agent-id', name: 'Nonexistent' })
      expect(result).toBeNull()
    })
  })

  describe('disconnect', () => {
    it('disconnects socket', () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      client.disconnect()
      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe('realtime updates', () => {
    it('updates prompt on prompt:deployed', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt])

      await client.render('test-prompt-id')

      await socketHandlers['prompt:deployed']?.({ ...mockPrompt, content: 'Updated!' })

      const result = await client.render('test-prompt-id')
      expect(result).toBe('Updated!')
    })

    it('inserts new prompt on prompt:deployed', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt])

      await socketHandlers['prompt:deployed']?.({ ...mockPrompt, id: 'new-id', content: 'New!' })

      const result = await client.render('new-id')
      expect(result).toBe('New!')
    })

    it('removes prompt on prompt:undeployed', async () => {
      const client = new Raison({ apiKey: 'rsn_test123' })
      await simulateSync([mockPrompt])

      await client.render('test-prompt-id')

      await socketHandlers['prompt:undeployed']?.({ id: 'test-prompt-id' })

      const result = await client.render('test-prompt-id')
      expect(result).toBe('')
    })
  })

  describe('isolation', () => {
    it('multiple clients have separate storage', async () => {
      const client1 = new Raison({ apiKey: 'rsn_test1' })
      const handlers1 = { ...socketHandlers }

      const client2 = new Raison({ apiKey: 'rsn_test2' })
      const handlers2 = { ...socketHandlers }

      handlers1.sync?.({ prompts: [{ ...mockPrompt, content: 'Client 1' }] })
      handlers2.sync?.({ prompts: [{ ...mockPrompt, content: 'Client 2' }] })

      const result1 = await client1.render('test-prompt-id')
      const result2 = await client2.render('test-prompt-id')

      expect(result1).toBe('Client 1')
      expect(result2).toBe('Client 2')
    })
  })
})
