import {
  DomainEvent,
  OrganizationRepository,
  EstablishmentRepository,
  EmissionPointRepository,
  OrganizationCountryRepository,
  CountryReadModelRepository,
  OutboxRepository,
  PosThemeRepository,
  Repositories,
} from '../domain/repositories';
import {
  Organization,
  Establishment,
  EmissionPoint,
  OrganizationCountry,
  PosTheme,
} from '../domain/entities';
import { UnitOfWork, ServiceAccountProvisioner } from '../application/ports';
import { Hono } from 'hono';
import { createApp } from '../interface/http/app';
import { UpsertOrganizationProfileUseCase } from '../application/use-cases/upsert-organization-profile';
import { GetMyOrganizationUseCase } from '../application/use-cases/get-my-organization';
import { UpdateOrganizationUseCase } from '../application/use-cases/update-organization';
import { ListEstablishmentsUseCase } from '../application/use-cases/list-establishments';
import { CreateEstablishmentUseCase } from '../application/use-cases/create-establishment';
import { UpdateEstablishmentUseCase } from '../application/use-cases/update-establishment';
import { ListEmissionPointsUseCase } from '../application/use-cases/list-emission-points';
import { CreateEmissionPointUseCase } from '../application/use-cases/create-emission-point';
import { GetPairingCodeUseCase } from '../application/use-cases/get-pairing-code';
import { PairPosTerminalUseCase } from '../application/use-cases/pair-pos-terminal';
import { UnlinkEmissionPointUseCase } from '../application/use-cases/unlink-emission-point';
import { ListOrganizationCountriesUseCase } from '../application/use-cases/list-organization-countries';
import { AddOrganizationCountryUseCase } from '../application/use-cases/add-organization-country';
import { ListPosThemesUseCase } from '../application/use-cases/list-pos-themes';
import { CreatePosThemeUseCase } from '../application/use-cases/create-pos-theme';
import { GetPosThemeUseCase } from '../application/use-cases/get-pos-theme';
import { UpdatePosThemeUseCase } from '../application/use-cases/update-pos-theme';
import { DeletePosThemeUseCase } from '../application/use-cases/delete-pos-theme';
import { MakeDefaultPosThemeUseCase } from '../application/use-cases/make-default-pos-theme';
import { AssignPosThemeToPointUseCase } from '../application/use-cases/assign-pos-theme-to-point';
import { ResolvePosThemeUseCase } from '../application/use-cases/resolve-pos-theme';

export function createInMemoryRepositories(): Repositories & { events: DomainEvent[] } {
  const orgs = new Map<string, Organization>();
  const ests = new Map<string, Establishment>();
  const eps = new Map<string, EmissionPoint>();
  const orgCountries = new Map<string, OrganizationCountry>();
  const themes = new Map<string, PosTheme>();
  const countries = new Map<string, { enabled: boolean }>([['EC', { enabled: true }]]);
  const events: DomainEvent[] = [];

  return {
    events,
    organizations: {
      async findById(id) { return orgs.get(id) ?? null; },
      async findByTaxId(taxId, countryCode) {
        return Array.from(orgs.values()).find(
          (o) => o.taxId === taxId && o.countryCode === countryCode,
        ) ?? null;
      },
      async save(org) {
        orgs.set(org.id, Organization.fromPersistence({ ...org.toPersistence() }));
      },
    } satisfies OrganizationRepository,
    establishments: {
      async findById(id) { return ests.get(id) ?? null; },
      async listByOrganization(organizationId) {
        return Array.from(ests.values()).filter((e) => e.organizationId === organizationId);
      },
      async nextCode(organizationId) {
        const list = Array.from(ests.values()).filter((e) => e.organizationId === organizationId);
        const max = list.reduce((m, e) => Math.max(m, parseInt(e.code, 10) || 0), 0);
        return String(max + 1).padStart(3, '0');
      },
      async save(est) {
        ests.set(est.id, Establishment.fromPersistence({ ...est.toPersistence() }));
      },
    } satisfies EstablishmentRepository,
    emissionPoints: {
      async findById(id) { return eps.get(id) ?? null; },
      async listByEstablishment(establishmentId) {
        return Array.from(eps.values()).filter((e) => e.establishmentId === establishmentId);
      },
      async listByOrganization(organizationId) {
        return Array.from(eps.values()).filter((e) => e.organizationId === organizationId);
      },
      async nextCode(establishmentId) {
        const list = Array.from(eps.values()).filter((e) => e.establishmentId === establishmentId);
        const max = list.reduce((m, e) => Math.max(m, parseInt(e.code, 10) || 0), 0);
        return String(max + 1).padStart(3, '0');
      },
      async listUnpairedPosPoints() {
        return Array.from(eps.values()).filter(
          (e) => e.type === 'pos' && e.status === 'active' && e.pairedAt === null,
        );
      },
      async save(ep) {
        eps.set(ep.id, EmissionPoint.fromPersistence({ ...ep.toPersistence() }));
      },
    } satisfies EmissionPointRepository,
    organizationCountries: {
      async listByOrganization(organizationId) {
        return Array.from(orgCountries.values()).filter((c) => c.organizationId === organizationId);
      },
      async find(organizationId, countryCode) {
        return Array.from(orgCountries.values()).find(
          (c) => c.organizationId === organizationId && c.countryCode === countryCode,
        ) ?? null;
      },
      async save(oc) {
        orgCountries.set(oc.id, OrganizationCountry.fromPersistence({ ...oc.toPersistence() }));
      },
    } satisfies OrganizationCountryRepository,
    countries: {
      async isEnabled(countryCode) {
        return countries.get(countryCode)?.enabled ?? false;
      },
      async upsert(params) {
        countries.set(params.code, { enabled: params.enabled });
      },
    } satisfies CountryReadModelRepository,
    posThemes: {
      async findById(id) { return themes.get(id) ?? null; },
      async listByOrganization(organizationId) {
        return Array.from(themes.values())
          .filter((t) => t.organizationId === organizationId)
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      },
      async findByName(organizationId, name) {
        return Array.from(themes.values()).find(
          (t) => t.organizationId === organizationId && t.name === name,
        ) ?? null;
      },
      async findDefault(organizationId) {
        return Array.from(themes.values()).find(
          (t) => t.organizationId === organizationId && t.isDefault,
        ) ?? null;
      },
      async save(theme) {
        themes.set(theme.id, PosTheme.fromPersistence({ ...theme.toPersistence() }));
      },
      async remove(id) {
        themes.delete(id);
      },
      async clearDefaultExcept(organizationId, keepThemeId) {
        for (const theme of themes.values()) {
          if (theme.organizationId === organizationId && theme.id !== keepThemeId && theme.isDefault) {
            theme.removeDefault();
          }
        }
      },
    } satisfies PosThemeRepository,
    outbox: {
      async add(event) {
        events.push({ ...event });
      },
    } satisfies OutboxRepository,
  };
}

export function createInMemoryUow(): UnitOfWork & { repos: Repositories & { events: DomainEvent[] } } {
  const repos = createInMemoryRepositories();
  return {
    repos,
    execute<T>(work: (r: Repositories) => Promise<T>): Promise<T> {
      return work(repos);
    },
  };
}

/**
 * App de Hono completa sobre repos en memoria. Los tests de casos de uso no la
 * necesitan, pero los de HTTP sí: el ETag/304, los permisos y el aislamiento
 * entre organizaciones están en el `app.ts`, en los middlewares y en los
 * controladores, y probarlos es la única forma de saber que el `404` de un tema
 * ajeno sale de verdad como `404` y no como un `200`.
 */
export function createTestApp(): {
  app: Hono;
  repos: Repositories & { events: DomainEvent[] };
} {
  const repos = createInMemoryRepositories();
  const uow: UnitOfWork = {
    execute<T>(work: (r: Repositories) => Promise<T>): Promise<T> {
      return work(repos);
    },
  };

  const app = createApp({
    useCases: {
      upsertOrganization: new UpsertOrganizationProfileUseCase(uow),
      getMyOrganization: new GetMyOrganizationUseCase(repos.organizations),
      updateOrganization: new UpdateOrganizationUseCase(uow),
      listEstablishments: new ListEstablishmentsUseCase(repos.establishments),
      createEstablishment: new CreateEstablishmentUseCase(uow),
      updateEstablishment: new UpdateEstablishmentUseCase(uow),
      listEmissionPoints: new ListEmissionPointsUseCase(
        repos.establishments,
        repos.emissionPoints,
        repos.posThemes,
      ),
      createEmissionPoint: new CreateEmissionPointUseCase(uow),
      getPairingCode: new GetPairingCodeUseCase(repos.establishments, repos.emissionPoints),
      // El aprovisionamiento va a auth-service; aquí no hay red, y ningún test
      // de esta app necesita emparejar.
      pairPosTerminal: new PairPosTerminalUseCase(uow, {
        provisionForOrganization: async () => {
          throw new Error('aprovisionamiento no disponible en tests');
        },
        revokeForOrganization: async () => undefined,
      } as unknown as ServiceAccountProvisioner),
      unlinkEmissionPoint: new UnlinkEmissionPointUseCase(uow),
      listOrganizationCountries: new ListOrganizationCountriesUseCase(repos.organizationCountries),
      addOrganizationCountry: new AddOrganizationCountryUseCase(uow),
      listPosThemes: new ListPosThemesUseCase(repos.posThemes, repos.emissionPoints),
      createPosTheme: new CreatePosThemeUseCase(uow),
      getPosTheme: new GetPosThemeUseCase(repos.posThemes),
      updatePosTheme: new UpdatePosThemeUseCase(uow),
      deletePosTheme: new DeletePosThemeUseCase(uow),
      makeDefaultPosTheme: new MakeDefaultPosThemeUseCase(uow),
      assignPosThemeToPoint: new AssignPosThemeToPointUseCase(uow),
      resolvePosTheme: new ResolvePosThemeUseCase(
        repos.establishments,
        repos.emissionPoints,
        repos.posThemes,
      ),
    },
    corsOrigin: '*',
  });

  return { app, repos };
}

/** Cabeceras que inyecta el gateway. Los tests las ponen a mano porque en
 * producción las pone `api-gateway-node` tras validar el JWT. */
/**
 * `Response.json()` devuelve `unknown` porque en runtime no se sabe. Los tests sí
 * saben qué esperan, así que el cast se concentra aquí en vez de repetido en cada
 * aserción.
 */
export async function jsonOf<T = Record<string, any>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function asOrganization(
  organizationId: string,
  permissions: string[],
): Record<string, string> {
  return {
    'X-Organization-Id': organizationId,
    'X-User-Id': 'user-1',
    'X-Country-Code': 'EC',
    'X-Permissions': permissions.join(','),
  };
}

export const ADMIN_PERMISSIONS = ['organization:read', 'organization:admin', 'establishment:read', 'establishment:update'];
export const READ_PERMISSIONS = ['organization:read', 'establishment:read'];
