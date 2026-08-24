<p align="center">
  <img src="web/assets/viennageoai-logo.svg" width="92" alt="ViennaGeoAI logo">
</p>

<h1 align="center">ViennaGeoAI</h1>

<p align="center"><strong>Ask Vienna's map. Get grounded, mapped answers.</strong></p>

<p align="center">
  Interactive Vienna map · official City of Vienna WFS/OGD · PoGeo tool calling · Ollama <code>gemma4:31b-cloud</code>
</p>

<p align="center">
  <img src="docs/viennageoai-screenshot.svg" alt="ViennaGeoAI application interface" width="100%">
</p>

ViennaGeoAI is a Dockerized geospatial AI application built on [PoGeo](https://github.com/vtavakkoli/PoGeo). It combines official Vienna Open Government Data, an interactive Leaflet map, explicit map context, and an Ollama tool-calling model. The model is not asked to guess spatial facts from pixels: it selects validated geospatial tools and receives GeoJSON-backed results from configured City of Vienna sources.

## Highlights

- **Professional map workspace** with dedicated official-data, map, and AI panels.
- **Multi-layer exploration**: display several official Vienna datasets at the same time.
- **Map-aware AI context**: viewport, zoom, selected point, and visible collections are sent with every question.
- **Grounded tool calling** through PoGeo instead of arbitrary SQL or arbitrary remote URLs.
- **Official Vienna WFS 1.1 / GeoJSON** with CRS-qualified `EPSG:4326` BBOX requests.
- **Ollama host integration** with `gemma4:31b-cloud` as the default model.
- **SVG visual identity** including application logo and browser favicon.
- **Responsive UI** for desktop, tablet, and mobile layouts.
- **Docker Compose** health checks, non-root app container, read-only filesystem, and bounded requests.
- **Live CI verification** against the configured Vienna playground layer.

## Architecture

```text
Browser
  │
  ├── ViennaGeoAI UI
  │     ├── official layer explorer
  │     ├── Leaflet map + selected point
  │     └── grounded AI chat
  │
  ▼
PoGeo API
  │
  ├── validated geospatial tools
  │      └── City of Vienna WFS 1.1
  │             data.wien.gv.at
  │
  └── Ollama /api/chat
         │
         ▼
host.docker.internal:11434
         │
         ▼
 gemma4:31b-cloud
```

The Vienna-specific catalog remains in this repository. Generic WFS, MCP, REST, spatial-query, and Ollama tool logic stays in PoGeo.

## Verified Vienna layers

ViennaGeoAI currently exposes these allowlisted feature types:

| Layer | Vienna WFS feature type |
|---|---|
| Playgrounds | `ogdwien:SPIELPLATZPUNKTOGD` |
| Schools | `ogdwien:SCHULEOGD` |
| Bicycle parking | `ogdwien:FAHRRADABSTELLANLAGEOGD` |
| Drinking fountains | `ogdwien:TRINKBRUNNENOGD` |
| Swimming pools | `ogdwien:SCHWIMMBADOGD` |

The application uses WFS **1.1.0**, `EPSG:4326`, and `application/json`. PoGeo sends map windows in the verified CRS-qualified form:

```text
16.30,48.17,16.44,48.27,EPSG:4326
```

That final CRS value is important for the current Vienna GeoServer behavior.

## PoGeo revision policy

ViennaGeoAI deliberately pins the PoGeo core instead of installing a floating `master` branch inside a cacheable Docker layer.

Current verified revision:

```text
f3d4e02f2415182b9a85f9cf6a00be1209d047b1
```

This revision contains the WFS 1.1 CRS-qualified BBOX handling and structured upstream WFS errors. When adopting a newer PoGeo build, update `POGEO_REF` intentionally and let CI re-run the live Vienna WFS check.

## Quick start

### 1. Requirements

- Docker + Docker Compose
- Ollama installed and running on the host
- an Ollama account with access to cloud models

Verify Ollama first:

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

ViennaGeoAI itself uses Ollama's `/api/chat` endpoint because the application needs conversation history and function/tool calling.

> `gemma4:31b-cloud` is an Ollama Cloud model. The Ollama daemon/API is local on your computer, while model inference is cloud-backed.

### 2. Configure

```bash
cp .env.example .env
```

Important defaults:

```dotenv
APP_PORT=8080
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=gemma4:31b-cloud
POGEO_REF=f3d4e02f2415182b9a85f9cf6a00be1209d047b1
```

### 3. Build and start

```bash
docker compose up --build -d
```

Open:

```text
http://localhost:8080
```

For the first build after upgrading from an older floating-PoGeo version, a clean rebuild is recommended:

```bash
docker compose down
docker compose build --no-cache app
docker compose up -d
```

## How to use it

1. Toggle one or more official Vienna layers in the left data panel.
2. Move the map to the area you want to investigate.
3. Click the map when the question is relative to a specific point.
4. Ask ViennaGeoAI in natural language.
5. Inspect the returned GeoJSON features directly on the map.

Example questions:

```text
Show playgrounds and drinking fountains visible in this area.
```

```text
Which schools are closest to the selected point?
```

```text
Compare bicycle parking with playground availability in the current viewport.
```

```text
Find the nearest drinking fountains to this point and map the results.
```

## Health and troubleshooting

Check each path independently:

```powershell
Invoke-RestMethod http://localhost:8080/health
Invoke-RestMethod http://localhost:8080/api/ai/status
Invoke-RestMethod http://localhost:8080/collections
```

Test Vienna WFS through the application:

```powershell
Invoke-RestMethod "http://localhost:8080/collections/playgrounds/items?bbox=16.30,48.17,16.44,48.27&limit=3"
```

A healthy Ollama call does **not** imply the Vienna WFS path is healthy, and vice versa. The frontend keeps those failures separate instead of reporting every backend error as malformed Ollama JSON.

### If logs still show the old four-value BBOX

Old behavior looks like this:

```text
bbox=16.30,48.17,16.44,48.27
```

The verified build should internally send:

```text
bbox=16.30,48.17,16.44,48.27,EPSG:4326
```

If you still see the old form, rebuild the `app` image without cache and confirm the pinned PoGeo revision:

```bash
docker compose build --no-cache app
docker compose run --rm --no-deps app cat /usr/local/share/viennageoai-pogeo-ref
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `APP_PORT` | `8080` | published web port |
| `OLLAMA_MODEL` | `gemma4:31b-cloud` | tool-calling model |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | host Ollama daemon from Docker |
| `OLLAMA_TIMEOUT_SECONDS` | `300` | AI request timeout |
| `WFS_TIMEOUT_SECONDS` | `30` | Vienna WFS timeout |
| `MAX_FEATURES` | `5000` | global WFS feature cap |
| `MAX_TOOL_ITERATIONS` | `6` | maximum agent tool-loop iterations |
| `POGEO_REF` | pinned commit | verified PoGeo revision used by the image |

## Repository layout

```text
config/collections.yaml        Vienna WFS allowlist
web/index.html                 application shell
web/styles.css                 responsive visual system
web/app.js                     map, layers, status, and chat client
web/assets/*.svg               ViennaGeoAI logo + favicon
docs/viennageoai-screenshot.svg README application screenshot
compose.yaml                   runtime stack
Dockerfile                     pinned PoGeo application image
.github/workflows/ci.yml       live integration smoke test
```

## Security model

- remote WFS endpoints are catalog-controlled
- feature properties are allowlisted
- arbitrary SQL is not exposed to the model
- arbitrary WFS URLs are not exposed to the model
- request sizes, result counts, and tool iterations are bounded
- WFS and Ollama calls have explicit timeouts
- the app container runs as a non-root user
- the application filesystem is read-only at runtime
- `no-new-privileges` is enabled
- PostGIS remains internal to the Compose network

For a public deployment, add TLS, user authentication/authorization, rate limiting, persistent audit logs, and explicit egress policy.

## Data and attribution

Feature data is retrieved from the City of Vienna Open Government Data WFS at `data.wien.gv.at`. The default background map uses basemap.at / City of Vienna services. Review the applicable Vienna OGD and basemap.at terms before redistribution or production deployment.
