import { authenticator } from 'otplib';
import { UnitOfWork } from '../ports';
import {
  EmissionPointNotFoundError,
  EmissionPointNotPosTypeError,
  EstablishmentNotFoundError,
} from '../../domain/errors';
import { EmissionPointDTO } from '../dtos';

export class UnlinkEmissionPointUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(params: {
    establishmentId: string;
    emissionPointId: string;
    organizationId: string;
  }): Promise<EmissionPointDTO> {
    return this.uow.execute(async (repos) => {
      const est = await repos.establishments.findById(params.establishmentId);
      if (!est || !est.belongsToOrganization(params.organizationId)) {
        throw new EstablishmentNotFoundError();
      }

      const ep = await repos.emissionPoints.findById(params.emissionPointId);
      if (!ep || ep.establishmentId !== params.establishmentId) {
        throw new EmissionPointNotFoundError();
      }
      if (!ep.isPosTerminal()) {
        throw new EmissionPointNotPosTypeError();
      }

      // El deviceId del terminal emparejado: se necesita ANTES de limpiar el
      // estado (unlinkAndRegenerate lo borra) para avisarle por socket.io que
      // se desvincule solo.
      const deviceId = ep.pairedDeviceId;

      // Nuevo secreto: el código que se haya mostrado/memorizado antes deja
      // de servir. La instalación física del POS deberá volver a pedir el
      // código de 6 dígitos (su token viejo seguirá funcionando hasta que
      // expire, pero ya no podrá re-sincronizar nada nuevo sin re-emparejar
      // si el admin también revoca el usuario de servicio manualmente).
      ep.unlinkAndRegenerate(authenticator.generateSecret());
      await repos.emissionPoints.save(ep);

      await repos.outbox.add({
        type: 'organization.billing_point.unlinked',
        aggregateType: 'emission_point',
        aggregateId: ep.id,
        payload: {
          organizationId: ep.organizationId,
          establishmentId: ep.establishmentId,
          emissionPointId: ep.id,
          deviceId,
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
        type: ep.type,
        paired: ep.isPaired(),
      };
    });
  }
}
