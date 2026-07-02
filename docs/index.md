# Internal Developer Platform

One place for product teams to discover services, scaffold new ones from
golden paths, and read living documentation — with ownership and access control
wired in from the start.

## What the platform provides

- **Software catalog** — a single source of truth for services, APIs, resources,
  and the teams that own them. See [Software catalog](software-catalog.md).
- **Software templates** — golden-path scaffolding that creates a new service
  with continuous integration, ownership, and documentation already in place.
  See [Software templates](software-templates.md).
- **Living documentation** — technical docs written in Markdown next to the code
  and published alongside each catalog entity. See
  [Authoring documentation](authoring-docs.md).

## How this documentation is built

This site is rendered by TechDocs from the Markdown files under `docs/` and the
`mkdocs.yml` at the repository root. The platform's catalog entity carries a
documentation-reference annotation, so the rendered site appears on the entity's
page in the catalog. The same mechanism applies to every service created from a
golden-path template.

## Getting oriented

New to the platform? Start with the [Software catalog](software-catalog.md) to
understand how services and ownership are modelled, then read
[Software templates](software-templates.md) to create your first service.
