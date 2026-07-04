import { EstablishmentNotFoundError } from '../../domain/errors';
import { EmissionPoint } from '../../domain/entities';
import { UnitOfWork } from '../ports';
import { CreateEmissionPointInput, EmissionPointDTO } from '../dtos';

export class CreateEmissionPointUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: CreateEmissionPointInput): Promise<EmissionPointDTO> {
    return this.uow.execute(async (repos) => {
      const est = await repos.establishments.findById(input.establishmentId);
      if (!est || !est.belongsToOrganization(input.organizationId)) {
        throw new EstablishmentNotFoundError();
      }

      const code = await repos.emissionPoints.nextCode(input.establishmentId);

      const ep = EmissionPoint.create({
        establishmentId: input.establishmentId,
        organizationId: input.organizationId,
        code,
        name: input.name ?? null,
      });
      await repos.emissionPoints.save(ep);

      await repos.outbox.add({
        type: 'organization.billing_point.created',
        aggregateType: 'emission_point',
        aggregateId: ep.id,
        payload: {
          organizationId: input.organizationId,
          establishmentId: input.establishmentId,
          emissionPointId: ep.id,
          code: ep.code,
          countryCode: est.countryCode,
        },
        occurredAt: new Date(),
      });

      return {
        id: ep.id,
        establishmentId: ep.establishmentId,
        organizationId: ep.organizationId,
        code: ep.code,
        name: ep.name,
        status: ep.status,
      };
    });
  }
}
