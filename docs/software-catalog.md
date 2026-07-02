# Software catalog

The software catalog is the platform's source of truth for the services, APIs,
resources, and teams that make up the estate. Every entity is described in YAML,
version-controlled, and validated before it reaches the live catalog.

## Entity model

The platform uses the standard catalog entity kinds:

- **Domain** — a bounded area of the business. The platform's shared
  capabilities live in the `platform` domain.
- **System** — a collection of entities that cooperate to provide a capability.
  The platform itself is modelled as the `developer-platform` system.
- **Component** — a piece of software, such as a service or library.
- **API** — an interface a component exposes or consumes.
- **Resource** — infrastructure a component depends on, such as a database.
- **Group** and **User** — the organizational model that ownership references.

## Ownership

Ownership flows from the organizational model in `catalog/org.yaml`:

- `engineering` (department)
    - `platform-engineering` — owns the platform and its golden paths
    - `application-development` — builds product-facing services
    - `site-reliability` — owns availability and incident response

Every component declares an owner that resolves to a group or user in this
model. Unowned entities are rejected in review.

## Location index

The catalog ingests a single entry point, `catalog/all.yaml`, which registers
the organizational model, the platform's core domain and system, and the
golden-path templates. New systems, APIs, and templates are onboarded by adding
their location targets to that index rather than by reconfiguring the backend.

## Validation

Because entities are plain YAML, they are validated without a running
application. Schema and referential checks catch broken ownership references or
malformed entities in review, before they reach the live catalog.
