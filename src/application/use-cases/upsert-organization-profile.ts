import { Organization } from '../../domain/entities';
import { CountryCode, TaxId } from '../../domain/value-objects';
import {
  CountryNotEnabledError,
  TaxIdAlreadyExistsError,
} from '../../domain/errors';
import { UnitOfWork } from '../ports';
import {
  OrganizationDTO,
  UpsertOrganizationInput,
} from '../dtos';
import { Establishment } from '../../domain/entities';
import { EmissionPoint } from '../../domain/entities';

export class UpsertOrganizationProfileUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: UpsertOrganizationInput): Promise<OrganizationDTO> {
    const countryCode = CountryCode.create(input.countryCode);
    const taxId = TaxId.create(countryCode, input.taxId);

    return this.uow.execute(async (repos) => {
      const enabled = await repos.countries.isEnabled(countryCode.value);
      if (!enabled) throw new CountryNotEnabledError();

      const existing = await repos.organizations.findByTaxId(taxId.value, countryCode.value);
      if (existing && existing.id !== input.organizationId) {
        throw new TaxIdAlreadyExistsError();
      }

      let org = await repos.organizations.findById(input.organizationId);
      if (org) {
        org.updateProfile({
          legalName: input.legalName,
          tradeName: input.tradeName ?? null,
          taxId: taxId.value,
          countryCode: countryCode.value,
        });
      } else {
        org = Organization.create({
          id: input.organizationId,
          legalName: input.legalName,
          tradeName: input.tradeName ?? null,
          taxId: taxId.value,
          countryCode: countryCode.value,
        });
      }
      await repos.organizations.save(org);

      const existingEsts = await repos.establishments.listByOrganization(input.organizationId);
      if (existingEsts.length === 0) {
        const est = Establishment.create({
          organizationId: input.organizationId,
          code: '001',
          name: 'Matriz',
          countryCode: countryCode.value,
          isMain: true,
        });
        await repos.establishments.save(est);

        const ep = EmissionPoint.create({
          establishmentId: est.id,
          organizationId: input.organizationId,
          code: '001',
          name: 'Principal',
        });
        await repos.emissionPoints.save(ep);

        await repos.outbox.add({
          type: 'organization.establishment.created',
          aggregateType: 'establishment',
          aggregateId: est.id,
          payload: {
            organizationId: input.organizationId,
            establishmentId: est.id,
            code: est.code,
            countryCode: countryCode.value,
          },
          occurredAt: new Date(),
        });

        await repos.outbox.add({
          type: 'organization.billing_point.created',
          aggregateType: 'emission_point',
          aggregateId: ep.id,
          payload: {
            organizationId: input.organizationId,
            establishmentId: est.id,
            emissionPointId: ep.id,
            code: ep.code,
            countryCode: countryCode.value,
          },
          occurredAt: new Date(),
        });
      }

      await repos.outbox.add({
        type: 'organization.org.updated',
        aggregateType: 'organization',
        aggregateId: input.organizationId,
        payload: {
          organizationId: input.organizationId,
          legalName: org.legalName,
          tradeName: org.tradeName,
          countryCode: org.countryCode,
        },
        occurredAt: new Date(),
      });

      return {
        id: org.id,
        legalName: org.legalName,
        tradeName: org.tradeName,
        taxId: org.taxId,
        countryCode: org.countryCode,
        status: org.status,
        completed: org.isProfileComplete(),
        settings: org.settings,
      };
    });
  }
}
