# Raison SDK

Official JavaScript/TypeScript SDK for [Raison](https://raison.ist) - prompt management for AI applications.

## Installation

```bash
npm install raison
```

## Quick Start

```typescript
import { Raison } from 'raison'

const raison = new Raison({
  apiKey: 'rsn_dev_your_api_key',
})

// Render a prompt with variables
const text = await raison.render('prompt-id', {
  company: 'Acme Inc',
  userName: 'Alice',
})

// Find prompts by agent
const prompts = await raison.find({ agentId: 'agent-id' })

// Get a specific prompt
const prompt = await raison.findOne({ agentId: 'agent-id', name: 'System Prompt' })
```

## API

### Constructor

```typescript
const raison = new Raison({
  apiKey: string,    // Required. Starts with 'rsn_'
  baseUrl?: string,  // Optional. Defaults to Raison.BASE_URL
})
```

### render(promptId, variables?)

Render a prompt by ID. Returns empty string if not found.

```typescript
const text = await raison.render('prompt-id', { userName: 'Alice' })

// Without variables returns raw template
const raw = await raison.render('prompt-id')
```

### find(query?): Promise\<Prompt[]\>

Search prompts by any field.

```typescript
const prompts = await raison.find({ agentId: 'agent-id' })
```

### findOne(query): Promise\<Prompt | null\>

Get a single prompt.

```typescript
const prompt = await raison.findOne({ agentId: 'agent-id', name: 'System Prompt' })

if (prompt) {
  const text = await raison.render(prompt.id, { userName: 'Alice' })
}
```

**Prompt fields:** `id`, `name`, `agentId`, `version`, `content`

### disconnect()

Close the WebSocket connection.

```typescript
raison.disconnect()
```

### Raison.registerHelper(name, fn)

Register a custom Handlebars helper for use in prompt templates.

```typescript
// Register helpers before rendering
Raison.registerHelper('uppercase', (str: string) => str.toUpperCase())
Raison.registerHelper('json', (value: unknown) => JSON.stringify(value, null, 2))

// Now usable in templates: {{uppercase userName}}, {{json data}}
const text = await raison.render('prompt-id', { userName: 'Alice', data: { foo: 1 } })
```

## Template Syntax

Prompts use [Handlebars](https://handlebarsjs.com/):

```handlebars
Hello {{userName}}!

{{#if isPremium}}Premium user.{{/if}}

{{#each features}}- {{this}}
{{/each}}
```

## License

MIT
