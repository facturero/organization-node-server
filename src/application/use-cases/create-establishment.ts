import { OrganizationNotFoundError } from '../../domain/errors';
import { Establishment } from '../../domain/entities';
import { UnitOfWork } from '../ports';
import { CreateEstablishmentInput, EstablishmentDTO } from '../dtos';

export class CreateEstablishmentUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: CreateEstablishmentInput): Promise<EstablishmentDTO> {
    return this.uow.execute(async (repos) => {
      const org = await repos.organizations.findById(input.organizationId);
      if (!org) throw new OrganizationNotFoundError();

      const countryCode = input.countryCode ?? org.countryCode ?? 'EC';
      const code = await repos.establishments.nextCode(input.organizationId);

      const est = Establishment.create({
        organizationId: input.organizationId,
        code,
        name: input.name,
        countryCode,
        address: input.address ?? null,
      });
      await repos.establishments.save(est);

      await repos.outbox.add({
        type: 'organization.establishment.created',
        aggregateType: 'establishment',
        aggregateId: est.id,
        payload: {
          organizationId: input.organizationId,
          establishmentId: est.id,
          code: est.code,
          countryCode: est.countryCode,
        },
        occurredAt: new Date(),
      });

      return {
        id: est.id,
        organizationId: est.organizationId,
        code: est.code,
        name: est.name,
        countryCode: est.countryCode,
        address: est.address,
        isMain: est.isMain,
        status: est.status,
      };
    });
  }
}
