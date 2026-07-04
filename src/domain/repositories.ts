import {
  Organization,
  Establishment,
  EmissionPoint,
  OrganizationCountry,
} from './entities';

export interface DomainEvent {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findByTaxId(taxId: string, countryCode: string): Promise<Organization | null>;
  save(org: Organization): Promise<void>;
}

export interface EstablishmentRepository {
  findById(id: string): Promise<Establishment | null>;
  listByOrganization(organizationId: string): Promise<Establishment[]>;
  nextCode(organizationId: string): Promise<string>;
  save(est: Establishment): Promise<void>;
}

export interface EmissionPointRepository {
  findById(id: string): Promise<EmissionPoint | null>;
  listByEstablishment(establishmentId: string): Promise<EmissionPoint[]>;
  nextCode(establishmentId: string): Promise<string>;
  save(ep: EmissionPoint): Promise<void>;
}

export interface OrganizationCountryRepository {
  listByOrganization(organizationId: string): Promise<OrganizationCountry[]>;
  find(organizationId: string, countryCode: string): Promise<OrganizationCountry | null>;
  save(oc: OrganizationCountry): Promise<void>;
}

export interface CountryReadModelRepository {
  isEnabled(countryCode: string): Promise<boolean>;
  upsert(params: { code: string; name?: string | null; currencyCode?: string | null; enabled: boolean }): Promise<void>;
}

export interface OutboxRepository {
  add(event: DomainEvent): Promise<void>;
}

export interface Repositories {
  organizations: OrganizationRepository;
  establishments: EstablishmentRepository;
  emissionPoints: EmissionPointRepository;
  organizationCountries: OrganizationCountryRepository;
  countries: CountryReadModelRepository;
  outbox: OutboxRepository;
}
