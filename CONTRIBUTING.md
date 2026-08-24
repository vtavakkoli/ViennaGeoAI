# Contributing to ViennaGeoAI

Thank you for considering a contribution. ViennaGeoAI is intentionally split into two layers:

- **ViennaGeoAI** contains Vienna-specific configuration, UI, deployment, and integration behavior.
- **PoGeo** contains reusable geospatial providers, WFS logic, MCP/REST tooling, and Ollama agent behavior.

Please place changes in the repository where they are most reusable.

## Before opening a change

1. Search existing issues and pull requests to avoid duplicate work.
2. Keep external WFS endpoints and feature types allowlisted in `config/collections.yaml`.
3. Do not expose arbitrary SQL, arbitrary remote URLs, credentials, or secrets to the model.
4. Prefer small, reviewable pull requests with one clear purpose.

## Local setup

Requirements:

- Docker with Docker Compose
- Ollama on the host if you want to test AI chat
- access to the configured Ollama model

Start the stack:

```bash
cp .env.example .env
docker compose build app
docker compose up -d --wait postgis app
```

Run basic checks:

```bash
docker compose config --quiet
curl http://localhost:8080/health
curl http://localhost:8080/collections
```

For Windows PowerShell:

```powershell
Invoke-RestMethod http://localhost:8080/health
Invoke-RestMethod http://localhost:8080/collections
```

## Branch and pull-request workflow

Create a branch from `main` using a descriptive name, for example:

```text
feat/add-parks-layer
fix/wfs-layer-metadata
chore/update-documentation
```

A pull request should include:

- a concise explanation of the problem and solution
- screenshots for visible UI changes
- tests or CI changes when behavior changes
- any new external-data attribution or licensing considerations
- confirmation that secrets and local `.env` files are not included

## Vienna data changes

When adding or changing a Vienna WFS collection:

1. Verify the feature type against the current City of Vienna WFS capabilities.
2. Use the supported WFS version/output format already established by the application unless there is a tested reason to change it.
3. Allowlist only properties required by the application.
4. Keep reasonable `default_limit` and `max_limit` values.
5. Add or update a live CI smoke test when the change affects a critical integration path.

## PoGeo changes

If a change is generic to WFS, spatial querying, MCP, REST, Ollama tool calling, or provider behavior, implement it in PoGeo first and then update ViennaGeoAI's pinned `POGEO_REF` only after PoGeo CI is green.

## UI changes

The frontend is intentionally lightweight and dependency-minimal. Preserve:

- accessibility labels and keyboard behavior
- responsive desktop/mobile layouts
- explicit separation between AI status and Vienna geodata status
- source attribution on the map
- clear distinction between selected location, manually enabled layers, and AI result layers

## Commit quality

Use clear imperative commit messages, for example:

```text
Add district boundary layer
Fix Vienna WFS feature labels
Document Ollama host setup
```

## Code of Conduct and Security

By participating, you agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Do not report security vulnerabilities in a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## License

Unless explicitly stated otherwise, contributions submitted to ViennaGeoAI are accepted under the repository's [Apache License 2.0](LICENSE).
