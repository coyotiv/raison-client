import { Schema } from 'memgoose'

export interface Prompt {
  id: string
  name: string
  agentId: string
  version: number
  content: string
  attributes: Record<string, string>
}

export const promptSchema = new Schema<Prompt>({
  id: { type: String, unique: true },
  name: String,
  agentId: String,
  version: Number,
  content: String,
  attributes: Object,
})

promptSchema.index('id')
promptSchema.index(['agentId', 'name'])
