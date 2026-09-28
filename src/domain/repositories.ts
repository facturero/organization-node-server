import {
  Organization,
  Establishment,
  EmissionPoint,
  OrganizationCountry,
  PosTheme,
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
  /** Puntos de emisión de toda la organización, para resolver/countar cuántos
   * usan un tema. Se usa solo dentro de la organización del contexto. */
  listByOrganization(organizationId: string): Promise<EmissionPoint[]>;
  nextCode(establishmentId: string): Promise<string>;
  /** Todos los puntos de emisión tipo 'pos' activos y sin emparejar (paired_at IS NULL),
   * de CUALQUIER organización — el POS todavía no sabe a qué org pertenece antes de emparejar. */
  listUnpairedPosPoints(): Promise<EmissionPoint[]>;
  save(ep: EmissionPoint): Promise<void>;
}

export interface PosThemeRepository {
  findById(id: string): Promise<PosTheme | null>;
  listByOrganization(organizationId: string): Promise<PosTheme[]>;
  findByName(organizationId: string, name: string): Promise<PosTheme | null>;
  findDefault(organizationId: string): Promise<PosTheme | null>;
  save(theme: PosTheme): Promise<void>;
  remove(id: string): Promise<void>;
  /** Quita el flag `is_default` de todos los temas de la organización menos el
   * indicado. MySQL no tiene índice único parcial, así que "un solo default"
   * se aplica aquí, dentro de la transacción del caso de uso. */
  clearDefaultExcept(organizationId: string, keepThemeId: string): Promise<void>;
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
  posThemes: PosThemeRepository;
  outbox: OutboxRepository;
}
