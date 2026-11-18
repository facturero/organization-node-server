import {
  Organization,
  Establishment,
  EmissionPoint,
  OrganizationCountry,
  PosTheme,
  AppTheme,
} from './entities';
import { ThemeSettings } from './app-theme';

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

export interface AppThemeRepository {
  findById(id: string): Promise<AppTheme | null>;
  listByOrganization(organizationId: string): Promise<AppTheme[]>;
  findByName(organizationId: string, name: string): Promise<AppTheme | null>;
  save(theme: AppTheme): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Qué tema ve la empresa por defecto (y si está fijado), y qué eligió cada usuario. */
export interface ThemePreferenceRepository {
  /** `null` = la organización nunca tocó sus ajustes de tema (se usan `DEFAULT_THEME_SETTINGS`). */
  getSettings(organizationId: string): Promise<ThemeSettings | null>;
  saveSettings(organizationId: string, settings: ThemeSettings): Promise<void>;
  /** `null` = el usuario nunca eligió (o volvió a «el de la empresa»). */
  getChoice(organizationId: string, userId: string): Promise<string | null>;
  saveChoice(organizationId: string, userId: string, theme: string | null): Promise<void>;
  /** Al borrar un tema: quien lo tenía elegido vuelve al de la empresa. */
  clearChoicesFor(organizationId: string, theme: string): Promise<void>;
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
  appThemes: AppThemeRepository;
  themePreferences: ThemePreferenceRepository;
  outbox: OutboxRepository;
}
