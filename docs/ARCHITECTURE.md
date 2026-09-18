# Architecture

## Runtime topology

- `apps/web`: Vite SPA, authenticates via `/api/auth/*`, stores only UI prefs and access token locally.
- `apps/api`: Fastify HTTP API. Owns auth, RBAC, domain writes, credential encryption, and LLM proxying.
- `worker`: Same image as API, runs BullMQ processors for import parsing and batch screening.
- `postgres`: System of record for users, projects, citations, decisions, extraction schemas and values, risk-of-bias evidence judgements, audits, credentials, and jobs.
- `redis`: BullMQ broker and readiness dependency.
- `minio`: S3-compatible object store for imported bibliography files and future PDFs.

## Trust boundaries

1. Browser never receives provider API keys. Only `credentialId`, provider, baseUrl, defaultModel, and `apiKeyLast4` are exposed.
2. Project-scoped routes always resolve `ProjectMember` before reads/writes.
3. Refresh tokens are hashed at rest; reuse of a revoked token revokes the user's active refresh set.
4. Write operations emit `AuditEvent` rows for reconstructability.

## LLM gateway

All providers are treated as OpenAI Chat Completions compatible:

`POST {baseUrl}/chat/completions`

Presets:

- `openai` -> `https://api.openai.com/v1`
- `nvidia` -> `https://integrate.api.nvidia.com/v1`
- `deepseek` -> `https://api.deepseek.com/v1`
- `azure` / `custom` -> user-supplied base URL

Screening responses must be JSON with `decision`, `criterionIds`, `evidenceSpans`, `uncertainty`, `rationale`, `confidence`. Each call persists a `ModelRun`.

Risk-of-bias assistance uses the same encrypted credential gateway. Its response is constrained to a signaling-question answer, overall judgement, rationale, confidence, and an exact quote from the stored source. The API verifies the quote before persisting both the `ModelRun` and `RiskOfBiasJudgement`.

## Extraction and evidence provenance

- `ExtractionField` is a project-owned, user-created schema item with a stable key, type, group, options, required flag, and ordering.
- `ExtractionValue` links one field to one citation and stores its value together with evidence text, source location, confidence, and human verification state.
- `RiskOfBiasJudgement` is keyed by citation, domain, signaling question, actor, and reviewer. Human and AI judgements remain separate so disagreement can be surfaced without overwriting either result.

## Phase-1 scope

In scope: auth, teams/projects, protocol versions, citation import, human+AI screening, persistent extraction-field management, evidence-linked risk-of-bias assessment, audits, encrypted credentials, and native Windows / compose deployment.

Out of scope for phase 1: real PDF layout parsing and OCR coordinates, SSO, and Kubernetes.
