# API overview

Base URL: `/api` (same origin behind nginx, or Vite proxy in development).

Auth header: `Authorization: Bearer <accessToken>`  
Refresh cookie: `refreshToken` (HttpOnly, path `/api/auth`)

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{ email, password, name }` |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/refresh` | cookie or body refresh token |
| POST | `/api/auth/logout` | revoke refresh token |
| GET | `/api/auth/me` | current user |

## Teams and projects

| Method | Path |
|---|---|
| GET/POST | `/api/teams` |
| POST | `/api/teams/:teamId/members` |
| GET/POST | `/api/projects` |
| GET/PATCH | `/api/projects/:projectId` | PATCH may include `llmResponseLanguage` (`zh` \| `en`), `pubmedApiKey` (NCBI E-utilities key; encrypted), or `clearPubmedApiKey: true` |
| POST | `/api/projects/:projectId/members` |
| POST | `/api/projects/:projectId/seed-demo` |

## Protocol, library, screening, audit

| Method | Path |
|---|---|
| GET/POST | `/api/projects/:projectId/protocols` | POST may include `question`, `picoP/I/C/O`, and `criteria[]` |
| GET | `/api/projects/:projectId/citations` | `take` max 5000; page with `skip`/`take` (web loads all via paging) |
| POST | `/api/projects/:projectId/citations/:citationId/fulltext` | multipart `file` (PDF and/or Markdown). PDF is kept for display; uploading PDF also auto-extracts text into Markdown (`fullTextMarkdown` + stored `.auto.md`). Scanned PDFs with no text layer stay `PDF` until MD is uploaded. Response includes `conversion: { attempted, ok, note }`. |
| GET | `/api/projects/:projectId/citations/:citationId/fulltext/pdf` | inline PDF stream |
| POST | `/api/projects/:projectId/imports` | multipart `file`, `format`, `sourceLabel` |
| GET | `/api/projects/:projectId/imports` |
| POST | `/api/projects/:projectId/mesh/resolve` | `{ queries: string[] }` — resolve terms against NCBI MeSH vocabulary (uses project PubMed API key when set) |
| GET/PUT | `/api/projects/:projectId/search-strategy` | GET returns `{ strategy: { concepts[], notes, updatedAt } }`. PUT body `{ concepts: [{ id, index?, title, controlled[], free[] }], notes? }` upserts the project search strategy draft. |
| GET | `/api/projects/:projectId/screening/queue` | `take` max 5000; returns `{ citations, total, skip, take }` |
| GET | `/api/projects/:projectId/meta/analyses` | List outcome analyses |
| POST | `/api/projects/:projectId/meta/analyses` | Create analysis |
| GET | `/api/projects/:projectId/meta/analyses/:analysisId` | Analysis + rows + runs |
| PUT | `/api/projects/:projectId/meta/analyses/:analysisId/rows` | Replace effect rows |
| POST | `/api/projects/:projectId/meta/analyses/:analysisId/map-extraction` | Map extraction fields → rows |
| POST | `/api/projects/:projectId/meta/analyses/:analysisId/run` | Allowlisted `fixed_random` recipe in sandbox workspace |
| GET | `/api/projects/:projectId/meta/runs/:runId` | Fetch one run |
| GET | `/api/projects/:projectId/synthesis/knowledge` | `?queries=protocol,meta,...` recall stage knowledge |
| GET | `/api/projects/:projectId/synthesis/composes` | Recent synthesis drafts |
| POST | `/api/projects/:projectId/synthesis/compose` | Recall + template (+ optional LLM narrative) |

| POST | `/api/projects/:projectId/screening/:citationId/human` |
| POST | `/api/projects/:projectId/screening/:citationId/ai` |
| POST | `/api/projects/:projectId/screening/:citationId/final` |
| POST | `/api/projects/:projectId/screening/:citationId/fulltext-ai` |
| POST | `/api/projects/:projectId/screening/:citationId/adjudication-suggest` |
| POST | `/api/projects/:projectId/screening/batch-ai` | `{ citationIds }` max 5000 |
| GET | `/api/projects/:projectId/audit` |
| GET | `/api/jobs/:jobId` |

## Credentials and LLM

| Method | Path |
|---|---|
| GET | `/api/llm/presets` |
| GET/POST | `/api/credentials` |
| DELETE | `/api/credentials/:id` |
| POST | `/api/credentials/:id/test` |
| POST | `/api/llm/chat` |

`POST /api/llm/chat` body may include `projectId` and `context: { module, citationId }`. The server injects task context into a system prompt and records a `ModelRun`.

Credential create body:

```json
{
  "name": "NVIDIA main",
  "provider": "nvidia",
  "apiKey": "nvapi-...",
  "defaultModel": "meta/llama-3.1-70b-instruct",
  "baseUrl": "https://integrate.api.nvidia.com/v1"
}
```

Credential create body may include `thinkingEnabled` (boolean). For models that support reasoning (Qwen3 / Nemotron / DeepSeek-R1, etc.), the gateway sends `chat_template_kwargs.enable_thinking` on chat completions.

| Method | Path | Notes |
|---|---|---|
| PATCH | `/api/credentials/:id` | Update `name`, `defaultModel`, and/or `thinkingEnabled` without rotating the API key |

Response never includes the raw key.

## Data extraction

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/projects/:projectId/extraction/fields` | List or create project fields |
| PATCH/DELETE | `/api/projects/:projectId/extraction/fields/:fieldId` | Update or archive a field; archived values are retained |
| GET | `/api/projects/:projectId/extraction/values` | List saved extraction cells |
| PUT | `/api/projects/:projectId/extraction/values/:citationId/:fieldId` | Save value, evidence, source location, confidence, and verification state |
| POST | `/api/projects/:projectId/extraction/:citationId/ai` | AI prefill; evidence must match abstract/fulltext substring; `verified=false` |
| POST | `/api/projects/:projectId/extraction/batch-ai` | `{ citationIds, credentialId?, model?, fieldIds? }` — queue batch extraction job; poll `GET /api/jobs/:jobId` |

Field keys are stable project-local identifiers. Supported field types are `text`, `number`, `boolean`, `select`, and `date`; fields are grouped under `characteristics`, `outcomes`, or `collaboration`.

## Risk of bias

| Method | Path | Notes |
|---|---|---|
| GET | `/api/projects/:projectId/risk-of-bias` | Domains, signaling questions, studies, and saved judgements |
| POST | `/api/projects/:projectId/risk-of-bias/:citationId/human` | Save a human answer, domain judgement, rationale, and exact source quote |
| POST | `/api/projects/:projectId/risk-of-bias/:citationId/ai` | Generate and persist an evidence-grounded AI suggestion; optionally uses project embedding config to pre-rank source spans |
| POST | `/api/projects/:projectId/citations/:citationId/evidence-rank` | `{ query, topK? }` — rank source sentences/spans by embedding similarity for evidence selection UI |

Project `PATCH` may include `embeddingCredentialId` and `embeddingModel`. Embedding may use a **separate** credential (own provider, base URL, and API key). If `embeddingCredentialId` is empty, the chat credential is reused. Empty `embeddingModel` uses the embedding credential provider default (`text-embedding-3-small` / `nvidia/nv-embedqa-e5-v5`).

## AI assistant (dual entry)

Main workspace buttons and the right-hand assistant call the same endpoints above. Structured AI writes (`ScreeningDecision`, `ExtractionValue`, `RiskOfBiasJudgement`) require evidence that matches source text. Soft assists (dashboard priorities, protocol/search suggestions, report draft, audit explain) use `POST /api/llm/chat` with `context.module`; they never auto-write protocol versions or final adjudication. Adjudication suggestions from `/adjudication-suggest` are adopted only via `POST .../final`.

## Health

| Method | Path |
|---|---|
| GET | `/health` |
| GET | `/ready` | checks Postgres + Redis |
