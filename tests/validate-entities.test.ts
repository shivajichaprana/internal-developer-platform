// Schema and referential-integrity checks for the software catalog.
//
// The suite parses every source the platform ingests at runtime — the catalog
// entities, the golden-path template, the RBAC policy files, and the core
// configuration — and fails when any of them drifts out of shape: unknown
// kinds, malformed entity names, dangling ownership references, broken
// location targets, template steps calling unregistered actions, RBAC grants
// pointing at roles or groups that do not exist, or secrets that stopped
// being environment-substituted.

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, loadAll } from 'js-yaml';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Helpers and shared fixtures
// ---------------------------------------------------------------------------

type Entity = {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    title?: string;
    description?: string;
    annotations?: Record<string, string>;
    tags?: string[];
  };
  spec: Record<string, unknown>;
};

function readYamlDocs(relPath: string): Entity[] {
  const raw = readFileSync(join(repoRoot, relPath), 'utf8');
  return loadAll(raw).filter((doc): doc is Entity => doc !== null && doc !== undefined) as Entity[];
}

function readYaml<T>(relPath: string): T {
  return load(readFileSync(join(repoRoot, relPath), 'utf8')) as T;
}

const catalogFiles = ['catalog/all.yaml', 'catalog/org.yaml', 'catalog/components.yaml'];
const catalogEntities = catalogFiles.flatMap((f) => readYamlDocs(f));
const templateDocs = readYamlDocs('templates/microservice/template.yaml');
const appConfig = readYaml<Record<string, any>>('app-config.yaml');
const mkdocsConfig = readYaml<Record<string, any>>('mkdocs.yml');
const conditionalPolicies = readYamlDocs('permissions/policy.yaml') as unknown as Array<
  Record<string, any>
>;
const rbacCsv = readFileSync(join(repoRoot, 'permissions/rbac-policy.csv'), 'utf8');

const groups = catalogEntities.filter((e) => e.kind === 'Group');
const users = catalogEntities.filter((e) => e.kind === 'User');
const components = catalogEntities.filter((e) => e.kind === 'Component');
const systems = catalogEntities.filter((e) => e.kind === 'System');
const domains = catalogEntities.filter((e) => e.kind === 'Domain');
const locations = catalogEntities.filter((e) => e.kind === 'Location');

const groupNames = new Set(groups.map((g) => g.metadata.name));
const userNames = new Set(users.map((u) => u.metadata.name));
const ownerNames = new Set([...groupNames, ...userNames]);

// Backstage entity names: alphanumeric segments joined by [-_.], max 63 chars.
// The platform standardizes on lower-case kebab-case, so enforce that subset.
const ENTITY_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// CSV policy lines, comments and blanks stripped.
const csvLines = rbacCsv
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('#'));
const pLines = csvLines.filter((l) => l.startsWith('p,')).map((l) => l.split(',').map((c) => c.trim()));
const gLines = csvLines.filter((l) => l.startsWith('g,')).map((l) => l.split(',').map((c) => c.trim()));
const csvRoles = new Set(pLines.map((p) => p[1]));

// ---------------------------------------------------------------------------
// Catalog entity schema
// ---------------------------------------------------------------------------

describe('catalog entity schema', () => {
  it('parses every catalog file into at least one document', () => {
    for (const file of catalogFiles) {
      expect(readYamlDocs(file).length, `${file} should contain entities`).toBeGreaterThan(0);
    }
  });

  it('gives every entity an apiVersion, kind, metadata.name, and spec', () => {
    for (const entity of catalogEntities) {
      expect(entity.apiVersion, JSON.stringify(entity.metadata)).toBeTruthy();
      expect(entity.kind).toBeTruthy();
      expect(entity.metadata?.name).toBeTruthy();
      expect(entity.spec, `${entity.kind}/${entity.metadata?.name} needs a spec`).toBeTruthy();
    }
  });

  it('uses the backstage.io/v1alpha1 apiVersion for every catalog entity', () => {
    for (const entity of catalogEntities) {
      expect(entity.apiVersion, `${entity.kind}/${entity.metadata.name}`).toBe(
        'backstage.io/v1alpha1',
      );
    }
  });

  it('uses valid kebab-case entity names of at most 63 characters', () => {
    for (const entity of catalogEntities) {
      expect(entity.metadata.name, `${entity.kind}/${entity.metadata.name}`).toMatch(ENTITY_NAME);
      expect(entity.metadata.name.length).toBeLessThanOrEqual(63);
    }
  });

  it('has no duplicate names within a kind', () => {
    const seen = new Set<string>();
    for (const entity of catalogEntities) {
      const key = `${entity.kind}:${entity.metadata.name}`;
      expect(seen.has(key), `duplicate entity ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('only declares kinds the catalog ingestion rules allow', () => {
    const allowed = new Set<string>(appConfig.catalog.rules.flatMap((r: any) => r.allow ?? []));
    for (const entity of catalogEntities) {
      expect(allowed.has(entity.kind), `${entity.kind} must be allowed by catalog.rules`).toBe(
        true,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Organizational model
// ---------------------------------------------------------------------------

describe('organizational model', () => {
  it('declares at least one department and one team group', () => {
    const types = groups.map((g) => g.spec.type);
    expect(types).toContain('department');
    expect(types).toContain('team');
  });

  it('resolves every group parent to a declared group', () => {
    for (const group of groups) {
      const parent = group.spec.parent as string | undefined;
      if (parent !== undefined) {
        expect(groupNames.has(parent), `${group.metadata.name} parent ${parent}`).toBe(true);
      }
    }
  });

  it('keeps parent and children references symmetric', () => {
    const byName = new Map(groups.map((g) => [g.metadata.name, g]));
    for (const group of groups) {
      for (const child of (group.spec.children as string[] | undefined) ?? []) {
        const childGroup = byName.get(child);
        expect(childGroup, `${group.metadata.name} child ${child} must exist`).toBeTruthy();
        expect(childGroup!.spec.parent, `${child} must point back at its parent`).toBe(
          group.metadata.name,
        );
      }
    }
  });

  it('resolves every user membership to a declared group', () => {
    for (const user of users) {
      const memberOf = (user.spec.memberOf as string[] | undefined) ?? [];
      expect(memberOf.length, `${user.metadata.name} needs a group`).toBeGreaterThan(0);
      for (const group of memberOf) {
        expect(groupNames.has(group), `${user.metadata.name} memberOf ${group}`).toBe(true);
      }
    }
  });

  it('uses only reserved placeholder addresses in profiles', () => {
    for (const entity of [...groups, ...users]) {
      const email = (entity.spec.profile as Record<string, string> | undefined)?.email;
      if (email !== undefined) {
        expect(email, `${entity.metadata.name} email must stay a placeholder`).toMatch(
          /@example\.invalid$/,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Ownership and system references
// ---------------------------------------------------------------------------

describe('ownership and system references', () => {
  it('resolves every owner reference to a declared group or user', () => {
    for (const entity of [...components, ...systems, ...domains]) {
      const owner = entity.spec.owner as string;
      expect(owner, `${entity.kind}/${entity.metadata.name} needs an owner`).toBeTruthy();
      expect(ownerNames.has(owner), `${entity.metadata.name} owner ${owner}`).toBe(true);
    }
  });

  it('resolves component system and system domain references', () => {
    const systemNames = new Set(systems.map((s) => s.metadata.name));
    const domainNames = new Set(domains.map((d) => d.metadata.name));
    for (const component of components) {
      const system = component.spec.system as string | undefined;
      if (system !== undefined) {
        expect(systemNames.has(system), `${component.metadata.name} system ${system}`).toBe(true);
      }
    }
    for (const system of systems) {
      const domain = system.spec.domain as string | undefined;
      if (domain !== undefined) {
        expect(domainNames.has(domain), `${system.metadata.name} domain ${domain}`).toBe(true);
      }
    }
  });

  it('gives every component a type, lifecycle, and workload annotation', () => {
    const lifecycles = new Set(['experimental', 'production', 'deprecated']);
    for (const component of components) {
      expect(component.spec.type, `${component.metadata.name} needs spec.type`).toBeTruthy();
      expect(
        lifecycles.has(component.spec.lifecycle as string),
        `${component.metadata.name} lifecycle`,
      ).toBe(true);
      const annotations = component.metadata.annotations ?? {};
      expect(
        annotations['backstage.io/kubernetes-id'],
        `${component.metadata.name} must carry the workload annotation`,
      ).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Location index
// ---------------------------------------------------------------------------

describe('location index', () => {
  it('declares exactly one bootstrap location as the ingestion entry point', () => {
    expect(locations.length).toBe(1);
    expect(locations[0]!.spec.type).toBe('file');
  });

  it('points every location target at an existing file', () => {
    for (const location of locations) {
      for (const target of location.spec.targets as string[]) {
        const targetPath = join(repoRoot, 'catalog', target);
        expect(existsSync(targetPath), `missing location target ${target}`).toBe(true);
        expect(statSync(targetPath).isFile()).toBe(true);
      }
    }
  });

  it('registers the org model, platform components, and the template', () => {
    const targets = locations[0]!.spec.targets as string[];
    expect(targets).toContain('./org.yaml');
    expect(targets).toContain('./components.yaml');
    expect(targets.some((t) => t.endsWith('template.yaml'))).toBe(true);
  });

  it('matches the entry point registered in the core configuration', () => {
    const configured = appConfig.catalog.locations.map((l: any) => l.target);
    expect(configured).toContain('./catalog/all.yaml');
  });
});

// ---------------------------------------------------------------------------
// Software template (golden path)
// ---------------------------------------------------------------------------

describe('software template', () => {
  const template = templateDocs[0]!;
  const steps = template.spec.steps as Array<Record<string, any>>;
  const parameterPages = template.spec.parameters as Array<Record<string, any>>;

  it('declares the scaffolder apiVersion and Template kind', () => {
    expect(template.apiVersion).toBe('scaffolder.backstage.io/v1beta3');
    expect(template.kind).toBe('Template');
    expect(template.spec.type).toBeTruthy();
  });

  it('is owned by a group declared in the org model', () => {
    expect(groupNames.has(template.spec.owner as string)).toBe(true);
  });

  it('backs every required parameter with a property definition', () => {
    for (const page of parameterPages) {
      const properties = Object.keys(page.properties ?? {});
      for (const required of (page.required as string[] | undefined) ?? []) {
        expect(properties, `required parameter ${required} must be defined`).toContain(required);
      }
    }
  });

  it('constrains the service name to catalog-safe values', () => {
    const nameProperty = parameterPages
      .map((page) => page.properties?.name)
      .find((p) => p !== undefined);
    expect(nameProperty?.pattern).toBeTruthy();
    expect(nameProperty?.maxLength).toBeLessThanOrEqual(63);
    // The declared pattern must itself accept kebab-case and reject the rest.
    const pattern = new RegExp(nameProperty!.pattern as string);
    expect(pattern.test('order-service')).toBe(true);
    expect(pattern.test('Order_Service')).toBe(false);
    expect(pattern.test('-leading-hyphen')).toBe(false);
  });

  it('uses unique step ids and only registered scaffolder actions', () => {
    const allowedActions = new Set(['fetch:template', 'publish:github', 'catalog:register']);
    const ids = steps.map((s) => s.id as string);
    expect(new Set(ids).size).toBe(ids.length);
    for (const step of steps) {
      expect(allowedActions.has(step.action as string), `action ${step.action}`).toBe(true);
    }
  });

  it('renders from a skeleton that exists and registers itself in the catalog', () => {
    const fetchStep = steps.find((s) => s.action === 'fetch:template');
    expect(fetchStep).toBeTruthy();
    const skeletonDir = join(repoRoot, 'templates/microservice', fetchStep!.input.url as string);
    expect(existsSync(skeletonDir), 'skeleton directory must exist').toBe(true);
    expect(existsSync(join(skeletonDir, 'catalog-info.yaml.njk'))).toBe(true);
    expect(existsSync(join(skeletonDir, 'mkdocs.yml.njk')), 'skeleton ships TechDocs').toBe(true);
  });

  it('only references declared steps from outputs and step inputs', () => {
    const ids = new Set(steps.map((s) => s.id as string));
    const serialized = JSON.stringify({ steps, output: template.spec.output });
    for (const match of serialized.matchAll(/steps\.([a-zA-Z0-9_-]+)\./g)) {
      expect(ids.has(match[1]!), `unknown step reference ${match[1]}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// RBAC policy files
// ---------------------------------------------------------------------------

describe('rbac policy files', () => {
  it('parses every CSV policy line into the expected arity', () => {
    expect(pLines.length).toBeGreaterThan(0);
    expect(gLines.length).toBeGreaterThan(0);
    for (const p of pLines) {
      expect(p.length, p.join(',')).toBe(5);
      expect(['allow', 'deny']).toContain(p[4]);
    }
    for (const g of gLines) {
      expect(g.length, g.join(',')).toBe(3);
    }
  });

  it('assigns only roles that are defined by at least one policy line', () => {
    for (const g of gLines) {
      expect(csvRoles.has(g[2]!), `undefined role ${g[2]}`).toBe(true);
    }
  });

  it('grants roles only to groups declared in the org model', () => {
    for (const g of gLines) {
      const principal = g[1]!;
      const match = principal.match(/^group:default\/(.+)$/);
      expect(match, `${principal} must be a group reference`).toBeTruthy();
      expect(groupNames.has(match![1]!), `unknown group ${principal}`).toBe(true);
    }
  });

  it('defines conditional policies only for roles that exist in the CSV', () => {
    expect(conditionalPolicies.length).toBeGreaterThan(0);
    const validActions = new Set(['create', 'read', 'update', 'delete', 'use']);
    for (const policy of conditionalPolicies) {
      expect(policy.result).toBe('CONDITIONAL');
      expect(csvRoles.has(policy.roleEntityRef), `role ${policy.roleEntityRef}`).toBe(true);
      expect(policy.pluginId).toBeTruthy();
      expect(policy.resourceType).toBeTruthy();
      expect((policy.permissionMapping as string[]).length).toBeGreaterThan(0);
      for (const action of policy.permissionMapping as string[]) {
        expect(validActions.has(action), `action ${action}`).toBe(true);
      }
      expect(policy.conditions?.rule).toBeTruthy();
    }
  });

  it('keeps the RBAC file paths referenced by the configuration on disk', () => {
    const rbac = appConfig.permission.rbac;
    expect(appConfig.permission.enabled).toBe(true);
    for (const relPath of [rbac['policies-csv-file'], rbac.conditionalPoliciesFile]) {
      expect(existsSync(join(repoRoot, relPath)), `${relPath} must exist`).toBe(true);
    }
  });

  it('grants admin only to users declared in the org model', () => {
    const adminRefs: Array<{ name: string }> = [
      ...appConfig.permission.rbac.admin.users,
      ...appConfig.permission.rbac.admin.superUsers,
    ];
    for (const ref of adminRefs) {
      const match = ref.name.match(/^user:default\/(.+)$/);
      expect(match, `${ref.name} must be a user reference`).toBeTruthy();
      expect(userNames.has(match![1]!), `unknown admin user ${ref.name}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Core configuration hygiene
// ---------------------------------------------------------------------------

describe('core configuration hygiene', () => {
  const ENV_SUBSTITUTION = /^\$\{[A-Z0-9_]+\}$/;

  it('keeps every sensitive value environment-substituted', () => {
    const sensitive: Array<[string, unknown]> = [
      ['integrations.github[0].token', appConfig.integrations.github[0].token],
      ['backend.database password', appConfig.backend.database.connection.password],
      ['auth github clientSecret', appConfig.auth.providers.github.development.clientSecret],
      [
        'kubernetes serviceAccountToken',
        appConfig.kubernetes.clusterLocatorMethods[0].clusters[0].serviceAccountToken,
      ],
    ];
    for (const [label, value] of sensitive) {
      expect(String(value), `${label} must be an env substitution`).toMatch(ENV_SUBSTITUTION);
    }
  });

  it('never disables TLS verification for configured clusters', () => {
    for (const locator of appConfig.kubernetes.clusterLocatorMethods) {
      for (const cluster of locator.clusters ?? []) {
        expect(cluster.skipTLSVerify, `${cluster.name} must verify TLS`).toBe(false);
      }
    }
  });

  it('publishes TechDocs for the platform system entity', () => {
    const system = systems.find((s) => s.metadata.name === 'developer-platform');
    expect(system?.metadata.annotations?.['backstage.io/techdocs-ref']).toBe('dir:.');
    expect(appConfig.techdocs.builder).toBeTruthy();
  });

  it('keeps every documentation page in the site navigation on disk', () => {
    const navEntries: Array<Record<string, string>> = mkdocsConfig.nav;
    for (const entry of navEntries) {
      for (const target of Object.values(entry)) {
        expect(existsSync(join(repoRoot, 'docs', target)), `docs/${target}`).toBe(true);
      }
    }
  });
});
