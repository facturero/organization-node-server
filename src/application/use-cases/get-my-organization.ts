import { OrganizationRepository } from '../../domain/repositories';
import { OrganizationDTO } from '../dtos';

export class GetMyOrganizationUseCase {
  constructor(private readonly orgRepo: OrganizationRepository) {}

  async execute(organizationId: string): Promise<OrganizationDTO> {
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      return {
        id: organizationId,
        legalName: null,
        tradeName: null,
        taxId: null,
        countryCode: null,
        status: 'active',
        completed: false,
        settings: null,
      };
    }
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
  }
}
