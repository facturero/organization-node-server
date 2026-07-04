import { CannotDeactivateMainError, EstablishmentNotFoundError } from '../../domain/errors';
import { UnitOfWork } from '../ports';
import { EstablishmentDTO, UpdateEstablishmentInput } from '../dtos';

export class UpdateEstablishmentUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: UpdateEstablishmentInput): Promise<EstablishmentDTO> {
    return this.uow.execute(async (repos) => {
      const est = await repos.establishments.findById(input.id);
      if (!est || !est.belongsToOrganization(input.organizationId)) {
        throw new EstablishmentNotFoundError();
      }

      if (input.status === 'inactive' && est.isMain) {
        throw new CannotDeactivateMainError();
      }

      est.update({
        name: input.name,
        address: input.address,
        status: input.status,
      });
      await repos.establishments.save(est);

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
