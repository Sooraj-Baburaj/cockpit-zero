---
'@cockpitzero/shared': minor
---

Universal BYOP provider layer (production phase 3). Expand `AiProviderIdSchema` to the real
Vercel AI SDK set (anthropic, openai, google, xai, mistral, groq, cohere, deepseek,
openai-compatible) plus a reserved `managed` slot and the kept `mock`; add `ai.model` and
`ai.baseUrl` to `AiSettingsSchema` (the BYOP user picks a concrete model, so `modelTier` is now
managed-only). New pure modules: `ai-models` (`PROVIDER_CATALOG`, `MODEL_CATALOG`,
`OPENAI_COMPATIBLE_PRESETS`, `defaultModelFor`, `providerInfo`/`providerLabel`) and
`ai-generation` (generateObject-friendly `AiWorkflowPlanSchema`/`AiDigestSummarySchema` plus the
`planToWorkflowDraft`/`coerceDigestRankings` mappers).
