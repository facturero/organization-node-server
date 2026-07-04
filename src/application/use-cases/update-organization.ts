import { OrganizationNotFoundError } from '../../domain/errors';
import { UnitOfWork } from '../ports';
import { OrganizationDTO, UpdateOrganizationInput } from '../dtos';

export class UpdateOrganizationUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: UpdateOrganizationInput): Promise<OrganizationDTO> {
    return this.uow.execute(async (repos) => {
      const org = await repos.organizations.findById(input.organizationId);
      if (!org) throw new OrganizationNotFoundError();

      org.updateSettings({
        legalName: input.legalName,
        tradeName: input.tradeName,
        settings: input.settings,
      });
      await repos.organizations.save(org);

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
