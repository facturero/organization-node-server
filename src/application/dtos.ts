import { PosThemeAsset, PosThemeConfig } from '../domain/pos-theme';

export interface OrganizationDTO {
  id: string;
  legalName: string | null;
  tradeName: string | null;
  taxId: string | null;
  countryCode: string | null;
  status: 'active' | 'suspended';
  completed: boolean;
  settings: Record<string, unknown> | null;
}

export interface EstablishmentDTO {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  countryCode: string;
  address: string | null;
  isMain: boolean;
  status: 'active' | 'inactive';
}

export interface EmissionPointDTO {
  id: string;
  establishmentId: string;
  organizationId: string;
  code: string;
  name: string | null;
  status: 'active' | 'inactive';
  type: 'web' | 'pos';
  paired: boolean;
  /** Tema propio de esta caja. `null` = hereda el predeterminado de la org. */
  posThemeId?: string | null;
  /** Nombre del tema efectivo (el override, o el predeterminado de la org).
   * Va para que el CRM muestre "qué tema tiene esta caja" sin otra llamada. */
  posThemeName?: string | null;
}

export interface OrganizationCountryDTO {
  id: string;
  organizationId: string;
  countryCode: string;
  enabled: boolean;
}

export interface UpsertOrganizationInput {
  organizationId: string;
  legalName: string;
  tradeName?: string | null;
  taxId: string;
  countryCode: string;
}

export interface UpdateOrganizationInput {
  organizationId: string;
  legalName?: string;
  tradeName?: string;
  settings?: Record<string, unknown>;
}

export interface CreateEstablishmentInput {
  organizationId: string;
  name: string;
  address?: string | null;
  countryCode?: string;
}

export interface UpdateEstablishmentInput {
  id: string;
  organizationId: string;
  name?: string;
  address?: string;
  status?: 'active' | 'inactive';
}

export interface CreateEmissionPointInput {
  establishmentId: string;
  organizationId: string;
  name?: string | null;
  type?: 'web' | 'pos';
}

export interface PairingCodeDTO {
  code: string;
  secondsRemaining: number;
}

export interface PairPosTerminalInput {
  code: string;
  /** UUID estable del dispositivo POS (generado en el primer arranque). */
  deviceId: string;
}

export interface PairPosTerminalOutput {
  organizationId: string;
  establishmentId: string;
  emissionPointId: string;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
}

export interface AddOrganizationCountryInput {
  organizationId: string;
  countryCode: string;
}

/* ------------------------------------------------------------------ *
 * Temas del POS
 * ------------------------------------------------------------------ */

export interface PosThemeSummaryDTO {
  id: string;
  name: string;
  isDefault: boolean;
  version: number;
  updatedAt: string;
  /** Cuántos puntos de emisión tienen este tema asignado. El editor lo usa
   * para no ofrecer borrar lo que está en uso. */
  assignedPointsCount: number;
}

export interface PosThemeDTO {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  version: number;
  schemaVersion: number;
  config: PosThemeConfig;
  updatedAt: string;
}

export interface ResolvedPosThemeDTO {
  source: 'point' | 'default' | 'builtin';
  themeId: string | null;
  name: string;
  version: number;
  etag: string;
  schemaVersion: number;
  /** `null` cuando `source` es "builtin": el POS aplica su tema integrado, que
   * no necesita que nadie se lo mande. */
  config: PosThemeConfig | null;
  assets: PosThemeAsset[];
}

export function toOrganizationDTO(org: OrganizationDTO): OrganizationDTO {
  return org;
}

export function toEstablishmentDTO(est: {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  countryCode: string;
  address: string | null;
  isMain: boolean;
  status: 'active' | 'inactive';
}): EstablishmentDTO {
  return { ...est };
}

export function toEmissionPointDTO(ep: {
  id: string;
  establishmentId: string;
  organizationId: string;
  code: string;
  name: string | null;
  status: 'active' | 'inactive';
  type: 'web' | 'pos';
  paired: boolean;
}): EmissionPointDTO {
  return { ...ep };
}

export function toOrganizationCountryDTO(oc: {  id: string;
  organizationId: string;
  countryCode: string;
  enabled: boolean;
}): OrganizationCountryDTO {
  return { ...oc };
}
