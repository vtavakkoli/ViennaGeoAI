# Security Policy

## Supported version

ViennaGeoAI is currently maintained from the `main` branch. Until formal versioned releases are published, security fixes are applied to the latest `main` revision only.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for vulnerabilities that could expose credentials, enable unauthorized access, bypass the geospatial allowlist, cause arbitrary code/SQL execution, or otherwise create a meaningful security risk.

Preferred reporting path:

1. Use GitHub's private vulnerability reporting / Security Advisory feature for this repository if it is available.
2. If private reporting is not available, contact the repository maintainer privately through the maintainer's GitHub profile and provide only enough information to establish a secure follow-up channel.

Please include:

- affected component and revision
- impact and realistic attack scenario
- minimal reproduction steps or proof of concept
- suggested mitigation, if known

## Security boundaries

ViennaGeoAI is designed around several explicit boundaries:

- external WFS endpoints are catalog-controlled
- WFS properties are allowlisted
- arbitrary SQL is not exposed to the model
- arbitrary remote URLs are not exposed to the model
- Ollama and WFS requests use bounded timeouts and feature limits
- the application container runs as a non-root user with a read-only filesystem
- PostGIS is not published outside the Compose network by default

A report that demonstrates a bypass of one of these boundaries is especially valuable.

## Deployment note

The default Compose setup is intended for local development and demonstration. A public deployment should add TLS, authentication/authorization, rate limiting, persistent audit logging, secret management, and explicit network egress controls.

## Disclosure

Please allow reasonable time for investigation and remediation before public disclosure. Confirmed vulnerabilities will be acknowledged in the relevant fix or release notes when appropriate.
