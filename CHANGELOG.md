# Changelog

## [0.1.0] - 2026-08-15

### Added
- Initial release of dsh-draw-router
- Unlocks image generation for DeepSeek Harness (DSH)
- Agent tools: `draw_image`, `draw_list_sources`
- Auto model discovery from any OpenAI-compatible endpoint (`GET /v1/models`)
- 30+ model name patterns for draw-model detection (never hardcodes model names)
- Multi-provider support: SenseNova, StepFun, Agnes, Qwen/DashScope, GPT Image, Flux, Stable Diffusion, Hunyuan, Seedream, Imagen
- Per-provider API handling:
  - StepFun: `steps`, `cfg_scale`, `negative_prompt`
  - Agnes: `size` tiers `1K-4K`, `ratio`, `extra_body.response_format`
  - DashScope: async task + task_id polling
- Manual model addition for providers not exposing image models via `/v1/models`
- REST API: `GET/POST /dsh-draw-router/sources`, `POST /dsh-draw-router/draw`
- Runtime source management (add/remove/probe/manual models)
- Source persistence via `draw-config.json`
- Key masking in all API responses