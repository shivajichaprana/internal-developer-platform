# Internal Developer Platform

An internal developer platform built on [Backstage](https://backstage.io). It
gives product teams one place to discover services, scaffold new ones from
golden-path templates, and read living documentation — with ownership and access
control wired in from the start.

## Capabilities

- **Software catalog** — a single source of truth for services, APIs, resources,
  and the teams that own them.
- **Software templates** — golden-path scaffolding that creates a new service
  with CI, ownership, and documentation already in place.
- **TechDocs** — documentation that lives next to the code and is published
  alongside each catalog entity.
- **Kubernetes & ownership views** — workload health and ownership surfaced
  directly against catalog entities.
- **Permission policy** — role-based access control over catalog and scaffolder
  actions.

## Repository layout

| Path | Purpose |
| --- | --- |
| `app-config.yaml` | Core platform configuration: backend, integrations, catalog, auth, permissions. |
| `catalog/all.yaml` | Catalog location index plus the core domain and system. |
| `catalog/org.yaml` | Organizational model — groups and users. |
| `catalog/` | Source of truth for platform-managed catalog entities. |

## How it fits together

This repository holds the configuration and catalog content for the platform.
A Backstage application consumes it:

1. Create or check out a Backstage app (`npx @backstage/create-app`).
2. Point the app at this repository's `app-config.yaml`.
3. The catalog loads `catalog/all.yaml`, which registers the organizational
   model and the platform's core domain and system.

Catalog entity files are plain YAML and can be validated without a running app
using the validation tooling, so changes are checked in continuous integration
before they reach the live catalog.

## Configuration

All secrets and environment-specific endpoints are supplied through environment
variables — nothing sensitive is committed. Among others, the platform reads:

| Variable | Description |
| --- | --- |
| `APP_BASE_URL` | Public URL of the frontend app. |
| `BACKEND_BASE_URL` | Public URL of the backend. |
| `POSTGRES_HOST`, `POSTGRES_PORT` | Catalog database endpoint. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | Catalog database credentials. |
| `GITHUB_TOKEN` | Token used to ingest catalog entities and run templates. |
| `AUTH_GITHUB_CLIENT_ID`, `AUTH_GITHUB_CLIENT_SECRET` | OAuth credentials for sign-in. |

Provide them via a git-ignored `.env` file or your secret manager of choice.

## Catalog model

Ownership flows from the organizational model in `catalog/org.yaml`:

- `engineering` (department)
  - `platform-engineering` — owns the platform and golden paths
  - `application-development` — builds product services
  - `site-reliability` — owns availability and incident response

The platform itself is modelled as the `developer-platform` **System** inside the
`platform` **Domain**.

## Contributing

Contributions are welcome. Open a Discussion in the repository or comment on a
pull request to propose changes.

## License

Released under the MIT License. See [LICENSE](LICENSE).
