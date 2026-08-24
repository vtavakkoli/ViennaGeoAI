# ViennaGeoAI

**Ask Vienna's map in natural language.** ViennaGeoAI is a Dockerized geospatial AI application built on [PoGeo](https://github.com/vtavakkoli/PoGeo). It combines an interactive Vienna map, official City of Vienna Open Government Data WFS layers, and an Ollama tool-calling model.

The default model is **`gemma4:31b-cloud`** through the Ollama daemon running on the host machine.

## What it does

- interactive Leaflet map centered on Vienna
- current map bounding box passed to the AI as spatial context
- click-to-select a WGS84 point for nearest-place questions
- browser geolocation support
- direct loading of official Vienna WFS layers in the current view
- natural-language questions grounded through PoGeo tools
- GeoJSON result overlays and feature popups
- visible tool-execution summaries
- responsive desktop/mobile UI
- Docker Compose deployment with health checks and security hardening
- CI smoke test that builds and boots the complete application stack

## Architecture

```text
Browser
  │
  ├── Leaflet + Vienna basemap
  │
  └── ViennaGeoAI UI
          │
          ▼
       PoGeo API
          │
          ├── validated geospatial tool registry
          │       │
          │       └── City of Vienna WFS
          │             data.wien.gv.at
          │
          └── Ollama API
                  │
                  ▼
       host.docker.internal:11434
                  │
                  ▼
          gemma4:31b-cloud
```

The model never receives arbitrary SQL or arbitrary WFS URLs. Sources, feature types, properties, timeouts, and result limits are defined in the application catalog.

## Included Vienna data layers

ViennaGeoAI uses Vienna WFS **1.1.0** with GeoJSON (`application/json`). The City of Vienna GetCapabilities document advertises both WFS 1.0.0 and 1.1.0, identifies 1.1.0 as the service version, and explicitly advertises `application/json` and `json` for `GetFeature`. For spatial queries PoGeo sends a CRS-qualified WFS 1.1 BBOX such as `16.30,48.17,16.44,48.27,EPSG:4326`; this is the form verified to return the expected Vienna features.

The layer identifiers below were verified against the current Vienna WFS capabilities in August 2026.

| Layer | Vienna WFS feature type |
|---|---|
| Playgrounds | `ogdwien:SPIELPLATZPUNKTOGD` |
| Schools | `ogdwien:SCHULEOGD` |
| Bicycle parking | `ogdwien:FAHRRADABSTELLANLAGEOGD` |
| Drinking fountains | `ogdwien:TRINKBRUNNENOGD` |
| Swimming pools | `ogdwien:SCHWIMMBADOGD` |

Additional Vienna OGD layers can be added in `config/collections.yaml` without changing the AI tool surface.

## Quick start

### 1. Prerequisites

- Docker with Docker Compose
- Ollama installed and running on the host
- an Ollama account with access to Ollama Cloud models

Verify the requested model from the host:

```bash
ollama run gemma4:31b-cloud
```

On Windows PowerShell you can also verify the local Ollama API directly:

```powershell
Invoke-RestMethod -Uri "http://localhost:11434/api/generate" `
  -Method Post `
  -ContentType "application/json" `
  -Body (@{
    model="gemma4:31b-cloud"
    prompt="Why is the sky blue? Return only JSON with short_answer and explanation."
    format="json"
    stream=$false
  } | ConvertTo-Json)
```

This `/api/generate` request is useful as a connectivity/model test. ViennaGeoAI itself uses Ollama's `/api/chat` endpoint because the application needs chat history and tool/function calling for geospatial queries.

You can stop the interactive prompt after the model is confirmed. The ViennaGeoAI container talks to the host Ollama daemon at port `11434`.

> `gemma4:31b-cloud` is an Ollama **Cloud** model. The Ollama API endpoint remains local on your computer, but inference for this model is cloud-backed rather than running the 31B weights entirely on your GPU.

### 2. Configure

```bash
cp .env.example .env
```

The important defaults are:

```dotenv
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=gemma4:31b-cloud
APP_PORT=8080
POGEO_REF=master
```

### 3. Start

```bash
docker compose up --build -d
```

Open:

```text
http://localhost:8080
```

Check the services:

```bash
docker compose ps
curl http://localhost:8080/health
curl http://localhost:8080/api/ai/status
```

Stop everything:

```bash
docker compose down
```

Remove the development PostGIS volume as well:

```bash
docker compose down -v
```

## Using the application

1. Move the map to the area you are interested in.
2. Click a point if the question is about something *near this location*.
3. Optionally click one of the official layer chips to inspect raw mapped features.
4. Ask a natural-language question.

Examples:

```text
Show playgrounds in the current map area and summarize them.
```

```text
Find the nearest drinking fountains to the selected point.
```

```text
Which schools are near this point?
```

```text
Show bicycle parking visible on the map.
```

The UI sends the current bounding box, zoom level, visible collections, and selected point to PoGeo. The LLM then chooses from the allowlisted geospatial tools and the resulting GeoJSON is drawn back on the map.

## Troubleshooting

### Ollama works but a map query fails

Check the two paths separately:

```powershell
Invoke-RestMethod http://localhost:8080/api/ai/status
Invoke-RestMethod http://localhost:8080/collections
```

Then test a live Vienna layer through ViennaGeoAI:

```powershell
Invoke-RestMethod "http://localhost:8080/collections/playgrounds/items?bbox=16.30,48.17,16.44,48.27&limit=3"
```

If `/api/ai/status` is healthy but a collection request fails, the problem is the geodata/WFS path rather than Ollama. The web UI handles non-JSON backend errors without reporting them as malformed Ollama JSON.

## Configuration

Application configuration is intentionally small:

```text
config/collections.yaml   Vienna WFS allowlist
web/index.html            application shell
web/styles.css            responsive UI
web/app.js                map and chat client
compose.yaml              runtime services
Dockerfile                PoGeo-based application image
```

Useful environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `APP_PORT` | `8080` | host web port |
| `OLLAMA_MODEL` | `gemma4:31b-cloud` | Ollama model |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | local Ollama daemon from the container |
| `OLLAMA_TIMEOUT_SECONDS` | `300` | AI request timeout |
| `WFS_TIMEOUT_SECONDS` | `30` | Vienna WFS timeout |
| `MAX_FEATURES` | `5000` | global feature cap |
| `MAX_TOOL_ITERATIONS` | `6` | maximum tool loop iterations per question |
| `POGEO_REF` | `master` | PoGeo revision used to build the application |

The Compose configuration adds `host.docker.internal:host-gateway`, so the same host-Ollama configuration works on Docker Desktop and modern Linux Docker installations.

## Security model

ViennaGeoAI inherits PoGeo's read-only tool model and adds deployment-level restrictions:

- remote WFS endpoints are catalog-controlled
- remote properties are allowlisted
- arbitrary SQL is not exposed
- arbitrary remote URLs are not exposed to the model
- result counts and tool iterations are bounded
- WFS and Ollama requests have explicit timeouts
- the application container runs as a non-root user
- the application filesystem is read-only at runtime
- `no-new-privileges` is enabled
- only the application port is published; PostGIS remains internal to Compose

For public production deployment, add TLS, authentication/authorization, rate limiting, persistent audit logs, and network egress controls.

## Development and CI

Validate Compose locally:

```bash
docker compose config --quiet
```

Build and run the same smoke path as CI:

```bash
docker compose build app
docker compose up -d --wait postgis app
curl http://localhost:8080/health
curl http://localhost:8080/collections
```

The GitHub Actions workflow validates Compose, builds the application image from PoGeo `master`, waits for the stack health checks, verifies the configured Vienna collections, performs a live Vienna WFS 1.1 query through PoGeo, and checks that the UI is served.

## PoGeo relationship

Vienna-specific behavior stays in this repository. Generic WFS access, validation, AI tool calling, MCP, REST endpoints, and spatial provider logic belong in PoGeo. This keeps ViennaGeoAI a clean real-world smart-city application while PoGeo remains reusable for other cities and geospatial services.

## Data and attribution

Geospatial feature data is retrieved from the City of Vienna Open Government Data WFS (`data.wien.gv.at`). The default background map uses basemap.at / City of Vienna services. Review the applicable City of Vienna and basemap.at data terms before redistribution or production use.
