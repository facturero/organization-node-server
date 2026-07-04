import {
  DomainEvent,
  OrganizationRepository,
  EstablishmentRepository,
  EmissionPointRepository,
  OrganizationCountryRepository,
  CountryReadModelRepository,
  OutboxRepository,
  Repositories,
} from '../domain/repositories';
import {
  Organization,
  Establishment,
  EmissionPoint,
  OrganizationCountry,
} from '../domain/entities';
import { UnitOfWork } from '../application/ports';

export function createInMemoryRepositories(): Repositories & { events: DomainEvent[] } {
  const orgs = new Map<string, Organization>();
  const ests = new Map<string, Establishment>();
  const eps = new Map<string, EmissionPoint>();
  const orgCountries = new Map<string, OrganizationCountry>();
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
      async nextCode(establishmentId) {
        const list = Array.from(eps.values()).filter((e) => e.establishmentId === establishmentId);
        const max = list.reduce((m, e) => Math.max(m, parseInt(e.code, 10) || 0), 0);
        return String(max + 1).padStart(3, '0');
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
