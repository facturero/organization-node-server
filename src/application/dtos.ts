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
}

export interface AddOrganizationCountryInput {
  organizationId: string;
  countryCode: string;
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
}): EmissionPointDTO {
  return { ...ep };
}

export function toOrganizationCountryDTO(oc: {
  id: string;
  organizationId: string;
  countryCode: string;
  enabled: boolean;
}): OrganizationCountryDTO {
  return { ...oc };
}
