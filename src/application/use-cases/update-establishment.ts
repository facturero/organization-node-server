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

      // El alta ya emitía `organization.establishment.created`; la edición no
      // emitía nada, así que cambiar nombre, dirección o estado de un
      // establecimiento no dejaba rastro en la bitácora.
      await repos.outbox.add({
        type: 'organization.establishment.updated',
        aggregateType: 'establishment',
        aggregateId: est.id,
        payload: {
          organizationId: est.organizationId,
          establishmentId: est.id,
          code: est.code,
          countryCode: est.countryCode,
          status: est.status,
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
