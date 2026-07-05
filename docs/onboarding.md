# Onboarding guide

How a team gets from "we have access" to "our service is on the platform with
CI, docs, and workload views". Each step is a small pull request to this
repository or a run of the golden-path template.

## Prerequisites

- Membership in the GitHub organization the platform integrates with.
- Sign-in works via GitHub OAuth — if you can open the portal, you are
  authenticated; what you can *do* is governed by the roles below.

## Step 1 — Join the organizational model

Ownership starts in `catalog/org.yaml`. Add your team as a `Group` under the
`engineering` department (or add yourself as a `User` with `memberOf` pointing
at an existing team):

```yaml
apiVersion: backstage.io/v1alpha1
kind: User
metadata:
  name: new-engineer
spec:
  profile:
    email: new-engineer@example.invalid
  memberOf: [application-development]
```

Open a pull request; the validation suite checks that group parents, children,
and memberships stay symmetric and that every reference resolves.

## Step 2 — Scaffold your first service

From the portal choose **Create…** → **Microservice**, then supply:

| Parameter | Notes |
| --- | --- |
| Name | Kebab-case, ≤ 63 characters — validated at submit time. |
| Owner | Your group from the organizational model. |
| System | Optional; attach the service to an existing system. |
| Repository | Target GitHub location for the new repo. |

The scaffolder renders the skeleton, creates a private repository with a
protected default branch, and registers the component. You start with a
running TypeScript HTTP service, pinned CI, a non-root container image,
tests, and a TechDocs site — no copy-paste setup.

## Step 3 — Register an existing service

Already have a repository? Add a `catalog-info.yaml` at its root:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: my-existing-service
  annotations:
    backstage.io/techdocs-ref: dir:.
    backstage.io/kubernetes-id: my-existing-service
spec:
  type: service
  lifecycle: production
  owner: application-development
```

Then register it from the portal (**Create…** → **Register existing
component**) or, for platform-owned entities, add the file to the
`catalog/all.yaml` index via pull request.

## Step 4 — Wire up Kubernetes views

Workload views are annotation-driven:

1. Keep (or add) `backstage.io/kubernetes-id: <service-name>` on the entity —
   scaffolded services already have it.
2. Label the workloads in the cluster with the matching
   `backstage.io/kubernetes-id` label, and add the namespace annotation if the
   service does not run in the default namespace.

Deployments, pods, and Argo Rollouts for the service then appear on its
entity page, visible with the platform's read-only cluster credentials.

## Step 5 — Write your docs

Every scaffolded service ships `mkdocs.yml` and a `docs/` folder. Write
Markdown, push, and TechDocs publishes it on the entity page. Preview locally
with `npx @techdocs/cli serve` from the service repository. The
[authoring guide](authoring-docs.md) covers structure and conventions.

## What you can do (roles)

| If you are in… | You can… |
| --- | --- |
| `application-development` | Read everything, run templates, register entities, update or delete entities your team owns. |
| `site-reliability` | Read everything, use the Kubernetes proxy, update Kubernetes-annotated entities. |
| `platform-engineering` | Administer catalog, templates, policies, and Kubernetes access. |

Need more? Propose a role or policy change under `permissions/` via pull
request — policies are code-reviewed like everything else.

## Checklist

- [ ] Team/group exists in `catalog/org.yaml`; members have `memberOf`.
- [ ] Service scaffolded from the template, or `catalog-info.yaml` added and
      registered.
- [ ] Entity resolves to an owning group (CI enforces this).
- [ ] `backstage.io/kubernetes-id` annotation matches workload labels.
- [ ] Docs render on the entity page.
- [ ] `make validate` passes locally before every pull request here.
