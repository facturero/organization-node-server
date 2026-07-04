import { CountryCode } from '../../domain/value-objects';
import { CountryNotEnabledError } from '../../domain/errors';
import { OrganizationCountry } from '../../domain/entities';
import { UnitOfWork } from '../ports';
import { AddOrganizationCountryInput, OrganizationCountryDTO } from '../dtos';

export class AddOrganizationCountryUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: AddOrganizationCountryInput): Promise<OrganizationCountryDTO> {
    const countryCode = CountryCode.create(input.countryCode);

    return this.uow.execute(async (repos) => {
      const enabled = await repos.countries.isEnabled(countryCode.value);
      if (!enabled) throw new CountryNotEnabledError();

      const existing = await repos.organizationCountries.find(input.organizationId, countryCode.value);
      if (existing) {
        return {
          id: existing.id,
          organizationId: existing.organizationId,
          countryCode: existing.countryCode,
          enabled: existing.enabled,
        };
      }

      const oc = OrganizationCountry.create({
        organizationId: input.organizationId,
        countryCode: countryCode.value,
      });
      await repos.organizationCountries.save(oc);

      return {
        id: oc.id,
        organizationId: oc.organizationId,
        countryCode: oc.countryCode,
        enabled: oc.enabled,
      };
    });
  }
}
