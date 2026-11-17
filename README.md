# Raison SDK

Official JavaScript/TypeScript SDK for [Raison](https://raison.ist) - prompt management for AI applications.

This repo also has the Raison plugin for Claude Code and the Raison skill for other AI agents. See [Use with AI agents](#use-with-ai-agents).

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

## Use with AI agents

Let your coding agent read, edit, publish, deploy and roll back your Raison prompts. It signs in as you, with your permissions. It can't delete anything.

### Claude Code

```bash
claude plugin install raison --marketplace coyotiv/raison-client
```

This adds the Raison MCP server and the Raison skill. Then run `/mcp`, pick **raison** and sign in.

On Claude Code older than 2.1.275:

```bash
claude plugin marketplace add coyotiv/raison-client
claude plugin install raison@raison
```

### Other agents (Codex, Cursor and more)

1. Add the MCP server to your agent: `https://api.raison.ist/mcp`
2. Add the skill:

```bash
npx skills add coyotiv/raison-client
```

The skill teaches the agent how Raison works: drafts, versions, environments and rollbacks. It also tells the agent to ask you before every change to a production environment.

### Scripts and CI

Use a management key from your project settings with the REST API at `https://api.raison.ist/v1/manage`. See [the REST API guide](skills/raison/references/rest-api.md).

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
