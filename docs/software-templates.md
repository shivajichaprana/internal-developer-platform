# Software templates

Software templates turn a new-service request into a fully wired repository. A
developer fills in a short form, and the platform creates a repository from a
skeleton, registers the new component in the catalog, and hands back links to
the code and its catalog entry.

## The golden-path microservice

The platform ships a golden-path template for a TypeScript HTTP service. The
generated repository includes:

- A minimal HTTP service with a health endpoint and a test suite.
- A continuous integration workflow that type-checks, tests, and builds the
  code, and verifies the container image builds cleanly.
- A multi-stage container build that runs as a non-root user.
- A catalog entity (`catalog-info.yaml`) with the chosen owner and a
  documentation-reference annotation, so the service appears in the catalog and
  its docs render immediately.
- A documentation scaffold (`mkdocs.yml` and `docs/`) ready for TechDocs.

## Parameters

The template collects only what it needs:

- **Name** — a DNS-friendly identifier for the service and its repository.
- **Description** — an optional one-line summary.
- **Owner** — a group or user from the organizational model.
- **System** — an optional system to group the service under.
- **Repository location** — where to create the new repository.

## What happens on submit

1. The skeleton is fetched and rendered with the values from the form.
2. A new repository is published with branch protection and code-owner review
   enabled.
3. The new component is registered in the catalog from its `catalog-info.yaml`.
4. The developer receives links to the repository and the catalog entry.

## Adding a template

New templates live under `templates/` and are registered by adding their
location to the catalog index. Each template pairs a `template.yaml` definition
with a `skeleton/` directory whose files are rendered with the submitted values.
