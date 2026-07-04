import { OrganizationCountryRepository } from '../../domain/repositories';
import { OrganizationCountryDTO } from '../dtos';

export class ListOrganizationCountriesUseCase {
  constructor(private readonly ocRepo: OrganizationCountryRepository) {}

  async execute(organizationId: string): Promise<OrganizationCountryDTO[]> {
    const countries = await this.ocRepo.listByOrganization(organizationId);
    return countries.map((c) => ({
      id: c.id,
      organizationId: c.organizationId,
      countryCode: c.countryCode,
      enabled: c.enabled,
    }));
  }
}
