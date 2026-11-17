---
name: raison
description: "Manage agent prompts in Raison (raison.ist): read, edit, publish, deploy, roll back. Use whenever the user mentions Raison, prompt management, or prompt versions and deployments, and always before calling a Raison tool."
---

# Raison

Raison stores agent prompts and their versions. Apps load the version that is live in an environment through the Raison SDK. You manage prompts with the Raison MCP tools.

If you have no Raison tools, tell the user to connect the Raison MCP server: `https://api.raison.ist/mcp`. In Claude Code: `claude plugin install raison --marketplace coyotiv/raison-client`.

Scripts and CI jobs use the REST API instead. See [references/rest-api.md](references/rest-api.md).

## How it works

- A **project** has **agents**. An agent has **prompts**. A prompt has **versions**.
- A project has **environments** in a fixed order, like Development, Staging, Production. Each environment shows one version of each prompt.
- **Versions** never change. They are numbered 1, 2, 3 and have a `createdAt` date.
- **Publish** makes a new version and puts it in the **first** environment only.
- **Deploy** puts an existing version in any environment. Use it to promote or roll back.
- A **draft** is unfinished work. It has a `revision` number that stops two people from overwriting each other.
- **Attributes** are the prompt's settings, like the model. They belong to a version. The project decides which attributes exist and their allowed values. New versions keep the attributes of the latest version.
- Prompts use **Handlebars**: `{{name}}`, `{{#if x}}...{{/if}}`, `{{#each items}}...{{/each}}`. The app fills in the values.
- IDs are 24 characters of hex.

## Production: ask every time

**PRODUCTION SERVES LIVE APPS. A WRONG CHANGE HURTS REAL USERS RIGHT AWAY.**

Before **EVERY** change that reaches a production environment:

1. Show the user what will change: the prompt, the environment, the version there now, the new version, and the difference.
2. **WAIT FOR THEIR EXPLICIT APPROVAL**, like "yes, deploy it".
3. Only then make the change.

Ask again for each change, even if the user asked for it, approved an earlier one, or said to just do it. A production environment is one whose name says so, like Production, Prod or Live. If you're not sure, ask.

Tools marked **HARMFUL** in the table below can change production.

## Tools

| Tool | Use it to |
| --- | --- |
| `list_projects` | See projects and their environments |
| `list_prompts(projectId, includeContent?)` | See agents, prompts, the latest version, and which version is live in each environment. `includeContent` adds every prompt's text |
| `get_prompt(promptId, version?)` | Read the text and attributes of the latest or a given version, where it is live, any drafts, and the allowed attributes (`attributeSettings`) |
| `list_versions(promptId)` | See all versions, newest first, with dates and environments |
| `create_prompt(agentId, name, content)` | Make a new prompt. It starts as a draft. Nothing is published |
| `save_draft(promptId, content?, attributes?, fromVersion?, draftId?, baseRevision?, name?)` | Make a new draft, or update a draft with its `baseRevision` |
| `publish_prompt(promptId, content?, attributes?, fromVersion?, versionName?)` or `publish_prompt(promptId, draftId)` | Make a new version and put it in the first environment. **HARMFUL** if the first environment is production |
| `deploy_version(promptId, version, environment)` | Put a version in an environment, by name or id. **HARMFUL** for production |
| `update_prompt(promptId, name?, agentId?)` | Rename a prompt or move it to another agent |
| `create_agent(projectId, name?)` | Make a new agent |
| `rename_agent(agentId, name)` | Rename an agent |
| `reorder_agents(projectId, agentIds)` | Set the order of agents. List every agent |
| `reorder_prompts(agentId, promptIds)` | Set the order of an agent's prompts. List every prompt |
| `list_activity(promptId)` | See what happened to a prompt: publishes, deployments, renames, and who did them |
| `list_draft_revisions(promptId, draftId)` | See a draft's saved history |
| `restore_draft_revision(promptId, draftId, revisionId)` | Bring a draft back to an older revision |

## Tasks

### Find a prompt

1. `list_projects`, then `list_prompts(projectId)`.
2. If more than one project or prompt could match, ask the user which one.
3. Never guess an id. List again.

### See what is live

`get_prompt(promptId)`. Look at `deployments` to see which version each environment has. Tell the user if an environment is behind the latest version.

### Change a prompt

1. `get_prompt(promptId)` to read the latest version.
2. If the latest version is not live in the environment the user cares about, tell them. When they promote, those changes go out too.
3. If there are drafts, say so. Each draft has `createdBy` and `updatedBy`. Don't touch someone else's draft unless asked.
4. Edit the full text. Keep every `{{variable}}` and block unless the user asked to change it. Check that every `{{#if}}` and `{{#each}}` is closed.
5. Show the user a short diff or summary, unless they said to just do it.
6. `publish_prompt({ promptId, content, versionName })`. Send the full new text, not a diff. Make `versionName` a few words about the change.
7. Tell the user the new version number and the environment it went to.

### Change the model or other settings

1. `get_prompt(promptId)`. `version.attributes` has the current values. `attributeSettings` has the allowed ones.
2. `publish_prompt({ promptId, attributes: { model: "..." } })`. Pass only the attributes that change. The text stays the same.
3. To change text and settings together, pass both `content` and `attributes`.

Only use values from `attributeSettings`. If a setting doesn't exist there, tell the user to add it in the project settings.

To change a draft's settings, use `save_draft({ promptId, draftId, attributes, baseRevision })`, then publish the draft.

### Suggest a change without publishing

`save_draft({ promptId, content, name })`. Tell the user the draft is waiting in the dashboard. Use this for experiments and anything that needs review.

### Edit or publish a draft

1. `get_prompt` gives each draft's `id` and `revision`.
2. Update it: `save_draft({ promptId, draftId: id, content, baseRevision: revision })`.
3. Publish it: `publish_prompt({ promptId, draftId })`.

### Create a prompt

1. `list_prompts` to find the agent.
2. Write the content or ask the user for it.
3. `create_prompt({ agentId, name, content })`. Names must be unique in an agent.
4. `publish_prompt({ promptId: id, draftId })`.
5. **Give the user the prompt id.** The app has to use it before the prompt does anything.

### Rename or move a prompt

`update_prompt({ promptId, name })` or `update_prompt({ promptId, agentId })`. The id stays the same, so apps keep working.

### Manage agents

- Create: `create_agent({ projectId, name })`.
- Rename: `rename_agent({ agentId, name })`.
- Order: `reorder_agents` and `reorder_prompts`. Get the current order from `list_prompts` and send every id.

### Undo a draft change

1. `list_draft_revisions({ promptId, draftId })` shows the saved history, newest first.
2. `restore_draft_revision({ promptId, draftId, revisionId })`. The restore is a new revision, so nothing is lost.

A revision is saved only when the text changes. The draft's first text and name or settings changes are not in the history.

### Promote

Only when the user asks.

1. `get_prompt(promptId)` to see which version is live there now.
2. Show the user the change and get their approval (see "Production: ask every time").
3. `deploy_version({ promptId, version, environment: "Production" })`.
4. Tell them which version was there before.

### Roll back

1. `list_activity(promptId)` shows past deployments: which version went to which environment, and when.
2. Find the version that was live before. If it isn't clear, show the user the options with dates and ask which number.
3. For production, get the user's approval first (see "Production: ask every time").
4. `deploy_version({ promptId, version, environment })` for each environment they named.

A rollback makes no new version.

### Bring back an old version as a new one

`publish_prompt({ promptId, fromVersion: 3, versionName: "Back to v3" })`. It copies that version's text and settings into a new version. Use this when the user wants the old prompt as the newest version, not only in one environment.

### Compare versions

`get_prompt(promptId, version)` for each version, then show the user the difference.

### Export or search all prompts

`list_prompts({ projectId, includeContent: true })` returns every prompt's latest text and settings in one call.

### Things you can't do

Tell the user to do these in the Raison dashboard:

- Delete anything: agents, prompts, versions or drafts
- Run evaluations or Refinery
- Change projects, environments or which attributes exist
- Manage keys, members or billing

## Rules

- **NEVER CHANGE PRODUCTION WITHOUT THE USER'S EXPLICIT APPROVAL FOR THAT CHANGE.**
- Only deploy to an environment other than the first when the user names it.
- Don't publish experiments. Save a draft.
- Don't remove or rename variables to tidy up. The app sends them, and it breaks if they are gone.
- Never print, commit or log a key.

## Retries

- Publishing the same text and settings again makes no version and returns `status: "unchanged"`. It is safe to retry.
- If the first environment had another version, an unchanged publish puts the latest back there and returns `redeployed: true`. Tell the user, because that can undo a rollback. If the first environment is production, get approval before you retry.
- A draft is deleted when it is published. If a draft publish seems to fail, check `list_versions` before you retry.

## Errors

| Error | What to do |
| --- | --- |
| "This connection is read-only" | The user gave read access only. Ask them to sign in to the Raison server again with write access, then retry |
| "You don't have access to do this" | Their role doesn't allow it. Tell the user. Don't retry |
| "... not found" | Wrong id or no access. List again |
| Draft "changed since revision N" | Someone else edited it. Save your text as a new draft and tell the user. The error has their latest text if the user wants you to merge |
| "happened at the same time" | Two changes clashed. Read again and retry once |
| `PLAN_LIMIT` | The plan allows no more agents, or no more prompts in that agent. Tell the user |
| "already exists" | Pick another name, or ask the user |
| Environment not found | The message lists the right names. Use one of them |

## How apps load prompts

Apps use the SDK with a delivery key (`rsn_dev_...`, `rsn_prd_...`). A delivery key reads one environment and can't change anything.

```ts
import { Raison } from "raison";
const raison = new Raison({ apiKey: process.env.RAISON_API_KEY });
const text = await raison.render("PROMPT_ID", { userName: "Alice" });
```

After you publish or deploy, apps get the new version right away. No app deploy is needed.
