# Authoring documentation

Documentation on the platform is written in Markdown, stored next to the code,
and published alongside the owning catalog entity. This "docs like code"
approach keeps documentation versioned with the software it describes and
reviewed through the same pull-request workflow.

## Anatomy of a documentation site

A documented repository contains two things:

- An `mkdocs.yml` at the repository root that names the site and lists its
  navigation.
- A `docs/` directory whose `index.md` is the home page.

A minimal `mkdocs.yml` looks like this:

```yaml
site_name: My Service
theme:
  name: material
nav:
  - Home: index.md
plugins:
  - techdocs-core
```

The `techdocs-core` plugin supplies the theme integration and the Markdown
extensions the platform expects, so individual sites do not configure them.

## Wiring docs to a catalog entity

For rendered docs to appear on an entity's page, the entity declares a
documentation-reference annotation:

```yaml
metadata:
  annotations:
    backstage.io/techdocs-ref: dir:.
```

The `dir:.` value tells the platform the documentation source lives in the same
repository as the entity definition. Services created from the golden-path
template have this annotation set for you.

## Previewing locally

With the TechDocs CLI and MkDocs available, preview a site from the repository
root:

```bash
npx @techdocs/cli serve
```

The preview reloads as you edit, so you can check navigation and formatting
before opening a pull request.

## Writing guidance

- Lead with what the reader needs to do, then explain why.
- Keep the navigation shallow; prefer a few well-organized pages over many
  thin ones.
- Use fenced code blocks with a language hint so examples are highlighted.
- Treat documentation changes like code changes: small, reviewed, and merged
  with the feature they describe.
