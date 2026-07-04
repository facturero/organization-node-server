import { randomUUID } from 'node:crypto';

export type OrganizationStatus = 'active' | 'suspended';
export type EstablishmentsStatus = 'active' | 'inactive';

export interface OrganizationProps {
  id: string;
  legalName: string | null;
  tradeName: string | null;
  taxId: string | null;
  countryCode: string | null;
  status: OrganizationStatus;
  settings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Organization {
  private constructor(private props: OrganizationProps) {}

  static create(params: {
    id: string;
    legalName?: string | null;
    tradeName?: string | null;
    taxId?: string | null;
    countryCode?: string | null;
    status?: OrganizationStatus;
    settings?: Record<string, unknown> | null;
  }): Organization {
    const now = new Date();
    return new Organization({
      id: params.id,
      legalName: params.legalName ?? null,
      tradeName: params.tradeName ?? null,
      taxId: params.taxId ?? null,
      countryCode: params.countryCode ?? null,
      status: params.status ?? 'active',
      settings: params.settings ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: OrganizationProps): Organization {
    return new Organization({ ...props });
  }

  get id(): string { return this.props.id; }
  get legalName(): string | null { return this.props.legalName; }
  get tradeName(): string | null { return this.props.tradeName; }
  get taxId(): string | null { return this.props.taxId; }
  get countryCode(): string | null { return this.props.countryCode; }
  get status(): OrganizationStatus { return this.props.status; }
  get settings(): Record<string, unknown> | null { return this.props.settings; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  isProfileComplete(): boolean {
    return this.props.taxId !== null && this.props.countryCode !== null;
  }

  updateProfile(params: {
    legalName: string;
    tradeName?: string | null;
    taxId: string;
    countryCode: string;
  }): void {
    this.props.legalName = params.legalName;
    this.props.tradeName = params.tradeName ?? null;
    this.props.taxId = params.taxId;
    this.props.countryCode = params.countryCode;
    this.props.updatedAt = new Date();
  }

  updateSettings(params: { legalName?: string; tradeName?: string; settings?: Record<string, unknown> }): void {
    if (params.legalName !== undefined) this.props.legalName = params.legalName;
    if (params.tradeName !== undefined) this.props.tradeName = params.tradeName;
    if (params.settings !== undefined) this.props.settings = params.settings;
    this.props.updatedAt = new Date();
  }

  toPersistence(): OrganizationProps {
    return { ...this.props };
  }
}

export interface EstablishmentProps {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  countryCode: string;
  address: string | null;
  isMain: boolean;
  status: EstablishmentsStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Establishment {
  private constructor(private props: EstablishmentProps) {}

  static create(params: {
    organizationId: string;
    code: string;
    name: string;
    countryCode: string;
    address?: string | null;
    isMain?: boolean;
    status?: EstablishmentsStatus;
  }): Establishment {
    const now = new Date();
    return new Establishment({
      id: randomUUID(),
      organizationId: params.organizationId,
      code: params.code,
      name: params.name,
      countryCode: params.countryCode,
      address: params.address ?? null,
      isMain: params.isMain ?? false,
      status: params.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: EstablishmentProps): Establishment {
    return new Establishment({ ...props });
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get countryCode(): string { return this.props.countryCode; }
  get address(): string | null { return this.props.address; }
  get isMain(): boolean { return this.props.isMain; }
  get status(): EstablishmentsStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  update(params: { name?: string; address?: string; status?: EstablishmentsStatus }): void {
    if (params.name !== undefined) this.props.name = params.name;
    if (params.address !== undefined) this.props.address = params.address;
    if (params.status !== undefined) this.props.status = params.status;
    this.props.updatedAt = new Date();
  }

  belongsToOrganization(organizationId: string): boolean {
    return this.props.organizationId === organizationId;
  }

  toPersistence(): EstablishmentProps {
    return { ...this.props };
  }
}

export interface EmissionPointProps {
  id: string;
  establishmentId: string;
  organizationId: string;
  code: string;
  name: string | null;
  status: EstablishmentsStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class EmissionPoint {
  private constructor(private props: EmissionPointProps) {}

  static create(params: {
    establishmentId: string;
    organizationId: string;
    code: string;
    name?: string | null;
    status?: EstablishmentsStatus;
  }): EmissionPoint {
    const now = new Date();
    return new EmissionPoint({
      id: randomUUID(),
      establishmentId: params.establishmentId,
      organizationId: params.organizationId,
      code: params.code,
      name: params.name ?? null,
      status: params.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: EmissionPointProps): EmissionPoint {
    return new EmissionPoint({ ...props });
  }

  get id(): string { return this.props.id; }
  get establishmentId(): string { return this.props.establishmentId; }
  get organizationId(): string { return this.props.organizationId; }
  get code(): string { return this.props.code; }
  get name(): string | null { return this.props.name; }
  get status(): EstablishmentsStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }

  toPersistence(): EmissionPointProps {
    return { ...this.props };
  }
}

export interface OrganizationCountryProps {
  id: string;
  organizationId: string;
  countryCode: string;
  enabled: boolean;
}

export class OrganizationCountry {
  private constructor(private props: OrganizationCountryProps) {}

  static create(params: {
    organizationId: string;
    countryCode: string;
    enabled?: boolean;
  }): OrganizationCountry {
    return new OrganizationCountry({
      id: randomUUID(),
      organizationId: params.organizationId,
      countryCode: params.countryCode,
      enabled: params.enabled ?? true,
    });
  }

  static fromPersistence(props: OrganizationCountryProps): OrganizationCountry {
    return new OrganizationCountry({ ...props });
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get countryCode(): string { return this.props.countryCode; }
  get enabled(): boolean { return this.props.enabled; }

  toPersistence(): OrganizationCountryProps {
    return { ...this.props };
  }
}
