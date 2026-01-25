import { Schema } from 'memgoose'

export interface Prompt {
  id: string
  name: string
  agentId: string
  version: number
  content: string
}

export const promptSchema = new Schema<Prompt>({
  id: { type: String, unique: true },
  name: String,
  agentId: String,
  version: Number,
  content: String,
})

promptSchema.index('id')
promptSchema.index(['agentId', 'name'])
