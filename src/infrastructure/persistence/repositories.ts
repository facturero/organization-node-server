import { randomUUID } from 'node:crypto';
import { Transaction } from 'sequelize';
import { sequelize } from './sequelize';
import {
  CountryModel,
  EmissionPointModel,
  EstablishmentModel,
  OrganizationCountryModel,
  OrganizationModel,
  OutboxModel,
} from './models';
import {
  Organization,
  Establishment,
  EmissionPoint,
  OrganizationCountry,
} from '../../domain/entities';
import {
  CountryReadModelRepository,
  DomainEvent,
  EmissionPointRepository,
  EstablishmentRepository,
  OrganizationCountryRepository,
  OrganizationRepository,
  OutboxRepository,
  Repositories,
} from '../../domain/repositories';
import { UnitOfWork } from '../../application/ports';

function toOrganization(m: OrganizationModel): Organization {
  return Organization.fromPersistence({
    id: m.id,
    legalName: m.legal_name,
    tradeName: m.trade_name,
    taxId: m.tax_id,
    countryCode: m.country_code,
    status: m.status,
    settings: m.settings as Record<string, unknown> | null,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  });
}

function toEstablishment(m: EstablishmentModel): Establishment {
  return Establishment.fromPersistence({
    id: m.id,
    organizationId: m.organization_id,
    code: m.code,
    name: m.name,
    countryCode: m.country_code,
    address: m.address,
    isMain: m.is_main,
    status: m.status,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  });
}

function toEmissionPoint(m: EmissionPointModel): EmissionPoint {
  return EmissionPoint.fromPersistence({
    id: m.id,
    establishmentId: m.establishment_id,
    organizationId: m.organization_id,
    code: m.code,
    name: m.name,
    status: m.status,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  });
}

function toOrganizationCountry(m: OrganizationCountryModel): OrganizationCountry {
  return OrganizationCountry.fromPersistence({
    id: m.id,
    organizationId: m.organization_id,
    countryCode: m.country_code,
    enabled: m.enabled,
  });
}

function organizationRepository(tx?: Transaction): OrganizationRepository {
  return {
    async findById(id) {
      const m = await OrganizationModel.findByPk(id, { transaction: tx });
      return m ? toOrganization(m) : null;
    },
    async findByTaxId(taxId, countryCode) {
      const m = await OrganizationModel.findOne({
        where: { tax_id: taxId, country_code: countryCode },
        transaction: tx,
      });
      return m ? toOrganization(m) : null;
    },
    async save(org) {
      const p = org.toPersistence();
      await OrganizationModel.upsert(
        {
          id: p.id,
          legal_name: p.legalName,
          trade_name: p.tradeName,
          tax_id: p.taxId,
          country_code: p.countryCode,
          status: p.status,
          settings: p.settings,
          created_at: p.createdAt,
          updated_at: new Date(),
        },
        { transaction: tx },
      );
    },
  };
}

function establishmentRepository(tx?: Transaction): EstablishmentRepository {
  return {
    async findById(id) {
      const m = await EstablishmentModel.findByPk(id, { transaction: tx });
      return m ? toEstablishment(m) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await EstablishmentModel.findAll({
        where: { organization_id: organizationId },
        transaction: tx,
      });
      return rows.map(toEstablishment);
    },
    async nextCode(organizationId) {
      const rows = await EstablishmentModel.findAll({
        where: { organization_id: organizationId },
        attributes: ['code'],
        transaction: tx,
        lock: tx ? tx.LOCK.UPDATE : undefined,
      });
      const max = rows.reduce((m, r) => Math.max(m, parseInt(r.code, 10) || 0), 0);
      return String(max + 1).padStart(3, '0');
    },
    async save(est) {
      const p = est.toPersistence();
      await EstablishmentModel.upsert(
        {
          id: p.id,
          organization_id: p.organizationId,
          code: p.code,
          name: p.name,
          country_code: p.countryCode,
          address: p.address,
          is_main: p.isMain,
          status: p.status,
          created_at: p.createdAt,
          updated_at: new Date(),
        },
        { transaction: tx },
      );
    },
  };
}

function emissionPointRepository(tx?: Transaction): EmissionPointRepository {
  return {
    async findById(id) {
      const m = await EmissionPointModel.findByPk(id, { transaction: tx });
      return m ? toEmissionPoint(m) : null;
    },
    async listByEstablishment(establishmentId) {
      const rows = await EmissionPointModel.findAll({
        where: { establishment_id: establishmentId },
        transaction: tx,
      });
      return rows.map(toEmissionPoint);
    },
    async nextCode(establishmentId) {
      const rows = await EmissionPointModel.findAll({
        where: { establishment_id: establishmentId },
        attributes: ['code'],
        transaction: tx,
        lock: tx ? tx.LOCK.UPDATE : undefined,
      });
      const max = rows.reduce((m, r) => Math.max(m, parseInt(r.code, 10) || 0), 0);
      return String(max + 1).padStart(3, '0');
    },
    async save(ep) {
      const p = ep.toPersistence();
      await EmissionPointModel.upsert(
        {
          id: p.id,
          establishment_id: p.establishmentId,
          organization_id: p.organizationId,
          code: p.code,
          name: p.name,
          status: p.status,
          created_at: p.createdAt,
          updated_at: new Date(),
        },
        { transaction: tx },
      );
    },
  };
}

function organizationCountryRepository(tx?: Transaction): OrganizationCountryRepository {
  return {
    async listByOrganization(organizationId) {
      const rows = await OrganizationCountryModel.findAll({
        where: { organization_id: organizationId },
        transaction: tx,
      });
      return rows.map(toOrganizationCountry);
    },
    async find(organizationId, countryCode) {
      const m = await OrganizationCountryModel.findOne({
        where: { organization_id: organizationId, country_code: countryCode },
        transaction: tx,
      });
      return m ? toOrganizationCountry(m) : null;
    },
    async save(oc) {
      const p = oc.toPersistence();
      await OrganizationCountryModel.upsert(
        {
          id: p.id,
          organization_id: p.organizationId,
          country_code: p.countryCode,
          enabled: p.enabled,
        },
        { transaction: tx },
      );
    },
  };
}

function countryReadModelRepository(tx?: Transaction): CountryReadModelRepository {
  return {
    async isEnabled(countryCode) {
      const m = await CountryModel.findByPk(countryCode, { transaction: tx });
      return m ? m.enabled : false;
    },
    async upsert(params) {
      await CountryModel.upsert(
        {
          code: params.code,
          name: params.name ?? null,
          currency_code: params.currencyCode ?? null,
          enabled: params.enabled,
          updated_at: new Date(),
        },
        { transaction: tx },
      );
    },
  };
}

function outboxRepository(tx?: Transaction): OutboxRepository {
  return {
    async add(event: DomainEvent) {
      await OutboxModel.create(
        {
          id: randomUUID(),
          aggregate_type: event.aggregateType,
          aggregate_id: event.aggregateId,
          type: event.type,
          payload: event.payload,
          occurred_at: event.occurredAt,
          processed_at: null,
        },
        { transaction: tx },
      );
    },
  };
}

export function buildRepositories(tx?: Transaction): Repositories {
  return {
    organizations: organizationRepository(tx),
    establishments: establishmentRepository(tx),
    emissionPoints: emissionPointRepository(tx),
    organizationCountries: organizationCountryRepository(tx),
    countries: countryReadModelRepository(tx),
    outbox: outboxRepository(tx),
  };
}

export class SequelizeUnitOfWork implements UnitOfWork {
  async execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return sequelize.transaction(async (tx) => work(buildRepositories(tx)));
  }
}
