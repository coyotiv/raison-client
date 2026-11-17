# /v1/manage REST API

For scripts and CI. Same operations as the MCP tools, scoped to one project.

## Keys

You can't create a key yourself. Ask the user to:

1. Open the project in the Raison dashboard > **API keys** > **Management keys** > **New**.
2. Pick **Read and write** to publish and deploy, or **Read only** for GET routes.
3. Copy the key (shown once) into the CI secret store, for example as `RAISON_MANAGEMENT_KEY`.

A key works only in its own project and keeps working after the person who made it leaves. Delete it in the same place.

Send it as `Authorization: Bearer rsnm_...` (or `x-api-key: rsnm_...`). Send bodies as JSON with `Content-Type: application/json`.

## Routes

Base URL: `https://api.raison.ist/v1/manage`

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/project` | | Project, environments, the key's name and scopes |
| GET | `/prompts?include=content` | | Agents with prompts, latest version, version per environment. `include=content` adds each prompt's latest text and attributes |
| GET | `/prompts/:id?version=N` | | Content and attributes of the latest or given version, deployments, drafts |
| GET | `/prompts/:id/versions` | | Versions newest first, with `createdAt` and environments |
| GET | `/prompts/:id/activity?limit=N` | | Publishes, deployments, renames and moves, newest first |
| POST | `/prompts` | `{agentId, name, content}` | `201 {id, name, agentId, draftId}` |
| POST | `/prompts/:id/drafts` | `{content?, attributes?, fromVersion?, name?}` | `201 {draftId, name, revision, created: true}` |
| PUT | `/prompts/:id/drafts/:draftId` | `{content?, attributes?, name?, baseRevision}` | `{draftId, name, revision, created: false}` |
| GET | `/prompts/:id/drafts/:draftId/revisions` | | `{draftId, currentRevision, revisions}` |
| POST | `/prompts/:id/drafts/:draftId/revisions/:revisionId/restore` | | `{draftId, revision, name, content, attributes}` |
| POST | `/prompts/:id/publish` | `{content?, attributes?, fromVersion?}` or `{draftId}`, plus `versionName?` | `{status: "published" \| "unchanged", version, deployedTo, redeployed}` |
| POST | `/prompts/:id/deploy` | `{version, environment}` | `{status: "deployed" \| "unchanged", version, environment}` |
| PATCH | `/prompts/:id` | `{name?, agentId?}` | `{id, name, agentId}` |
| POST | `/prompts/reorder` | `{agentId, promptIds}` | `{agentId, promptIds}` |
| POST | `/agents` | `{name?}` | `201 {id, name, projectId}` |
| PATCH | `/agents/:id` | `{name}` | `{id, name}` |
| POST | `/agents/reorder` | `{agentIds}` | `{projectId, agentIds}` |

- `environment` is a name (case-insensitive) or an id.
- `attributes` changes only the names you pass, for example `{"model": "gpt-5"}`. `GET /prompts/:id` lists the allowed names and values under `attributeSettings`.
- Publishing deploys to the project's first environment only. Publishing with nothing changed creates nothing and returns `unchanged`. It re-deploys the latest version to the first environment if something else is there, and then `redeployed` is `true`.
- `fromVersion` starts from that version's text and attributes instead of the latest. Publishing `{fromVersion: 3}` brings version 3 back as a new version.
- Content is limited to 1,000,000 characters, the body to 4 MB.

## Errors

```json
{ "error": { "code": "CONFLICT", "message": "...", "details": { } } }
```

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `BAD_REQUEST`, `INVALID_JSON` | Fix the request; `details.fields` names bad fields |
| 401 | `UNAUTHORIZED`, `INVALID_API_KEY`, `EXPIRED_API_KEY` | Missing, wrong, deleted or expired key |
| 403 | `READ_ONLY_KEY`, `FORBIDDEN`, `PLAN_LIMIT` | The key or plan doesn't allow it |
| 404 | `NOT_FOUND` | Unknown id, or outside the key's project |
| 409 | `CONFLICT` | Draft changed since `baseRevision`, or a concurrent write; read again and retry |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 4 MB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Missing `Content-Type: application/json` |

Use `curl -sS --fail-with-body` in scripts: it fails on 4xx/5xx and still prints the error body.

## Publish from a file

```bash
set -euo pipefail
jq -n --rawfile c prompts/support.hbs --arg n "$(git rev-parse --short HEAD)" '{content: $c, versionName: $n}' |
  curl -sS --fail-with-body -X POST "https://api.raison.ist/v1/manage/prompts/$PROMPT_ID/publish" \
    -H "Authorization: Bearer $RAISON_MANAGEMENT_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @-
```

Piping the body keeps large prompts out of the command line. The file content is sent byte for byte, so a trailing newline counts as a change.

## GitHub Actions

Keep each prompt in a file named after its prompt id, for example `prompts/6a1f...e2.hbs`. If the repo names files differently, add a mapping from file to id instead. This workflow publishes only the files changed by the push, so it never re-deploys untouched prompts:

```yaml
name: Publish prompts
on:
  push:
    branches: [main]
    paths: ["prompts/**"]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Publish changed prompts
        env:
          RAISON_MANAGEMENT_KEY: ${{ secrets.RAISON_MANAGEMENT_KEY }}
          BEFORE: ${{ github.event.before }}
        run: |
          set -euo pipefail
          if git cat-file -e "$BEFORE^{commit}" 2>/dev/null; then
            files=$(git diff --name-only --diff-filter=AMR "$BEFORE" HEAD -- 'prompts/*.hbs')
          else
            files=$(git ls-files 'prompts/*.hbs')
          fi
          for file in $files; do
            id=$(basename "$file" .hbs)
            echo "Publishing $file"
            jq -n --rawfile c "$file" --arg n "${GITHUB_SHA::7}" '{content: $c, versionName: $n}' |
              curl -sS --fail-with-body -X POST "https://api.raison.ist/v1/manage/prompts/$id/publish" \
                -H "Authorization: Bearer $RAISON_MANAGEMENT_KEY" \
                -H "Content-Type: application/json" \
                --data-binary @-
            echo
          done
```

Promote to Production in a separate, manually approved job (for example a `workflow_dispatch` with a version input):

```bash
curl -sS --fail-with-body -X POST "https://api.raison.ist/v1/manage/prompts/$PROMPT_ID/deploy" \
  -H "Authorization: Bearer $RAISON_MANAGEMENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version": 7, "environment": "Production"}'
```

## Pull the current prompts

```bash
set -euo pipefail
curl -sS --fail-with-body "https://api.raison.ist/v1/manage/prompts" -H "Authorization: Bearer $RAISON_MANAGEMENT_KEY" |
  jq -r '.agents[].prompts[] | "\(.id)\t\(.name)\t\(.latestVersion // "unpublished")"'

curl -sS --fail-with-body "https://api.raison.ist/v1/manage/prompts/$PROMPT_ID" -H "Authorization: Bearer $RAISON_MANAGEMENT_KEY" |
  jq -j '.version.content // empty' > "prompts/$PROMPT_ID.hbs"
```

`jq -j` writes the content without an extra newline, so publishing a pulled file unchanged returns `unchanged`.

Pull every published prompt in one call:

```bash
set -euo pipefail
mkdir -p prompts
curl -sS --fail-with-body "https://api.raison.ist/v1/manage/prompts?include=content" -H "Authorization: Bearer $RAISON_MANAGEMENT_KEY" > /tmp/raison.json
for id in $(jq -r '.agents[].prompts[] | select(.content != null) | .id' /tmp/raison.json); do
  jq -j --arg id "$id" '.agents[].prompts[] | select(.id == $id) | .content' /tmp/raison.json > "prompts/$id.hbs"
done
```
