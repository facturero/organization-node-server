import { authenticator } from 'otplib';
import { UnitOfWork, ServiceAccountProvisioner } from '../ports';
import { InvalidPairingCodeError, ServiceProvisioningError } from '../../domain/errors';
import { PairPosTerminalInput, PairPosTerminalOutput } from '../dtos';

export class PairPosTerminalUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly provisioner: ServiceAccountProvisioner,
  ) {}

  async execute(input: PairPosTerminalInput): Promise<PairPosTerminalOutput> {
    // 1. Validar el código y marcar el punto de emisión como emparejado.
    //    Esto vive en su propia transacción (corta, solo DB) — la llamada de
    //    red a auth-service para emitir tokens va DESPUÉS, fuera de la
    //    transacción, para no retener locks mientras se espera por la red.
    const matched = await this.uow.execute(async (repos) => {
      const candidates = await repos.emissionPoints.listUnpairedPosPoints();

      const ep = candidates.find(
        (candidate) => candidate.totpSecret && authenticator.check(input.code, candidate.totpSecret),
      );

      if (!ep) {
        throw new InvalidPairingCodeError();
      }

      // El deviceId es la identidad estable del terminal (generada en el
      // primer arranque del POS). Queda registrado en el punto de emisión
      // para poder enrutarle la desvinculación por socket.io después.
      ep.markPaired(input.deviceId);
      await repos.emissionPoints.save(ep);

      await repos.outbox.add({
        type: 'organization.billing_point.paired',
        aggregateType: 'emission_point',
        aggregateId: ep.id,
        payload: {
          organizationId: ep.organizationId,
          establishmentId: ep.establishmentId,
          emissionPointId: ep.id,
          deviceId: ep.pairedDeviceId,
        },
        occurredAt: new Date(),
      });

      return {
        organizationId: ep.organizationId,
        establishmentId: ep.establishmentId,
        emissionPointId: ep.id,
      };
    });

    // 2. Aprovisionar (o reutilizar) el usuario de servicio en auth-service
    //    y devolver tokens ya listos para que el POS los guarde. Si esto
    //    falla, revertimos el emparejamiento (vuelve a paired_at: null) para
    //    que el mismo código (mientras siga vigente) o uno nuevo permita reintentar
    //    — si no, el punto de emisión quedaría "emparejado" sin que el POS
    //    tenga credenciales reales, un estado inconsistente sin salida.
    try {
      const account = await this.provisioner.provisionForOrganization({
        organizationId: matched.organizationId,
        emissionPointId: matched.emissionPointId,
        deviceId: input.deviceId,
      });

      return {
        organizationId: matched.organizationId,
        establishmentId: matched.establishmentId,
        emissionPointId: matched.emissionPointId,
        accessToken: account.accessToken,
        tokenType: account.tokenType,
        expiresIn: account.expiresIn,
        refreshToken: account.refreshToken,
      };
    } catch (err) {
      await this.uow.execute(async (repos) => {
        const ep = await repos.emissionPoints.findById(matched.emissionPointId);
        if (ep) {
          ep.unlinkAndRegenerate(authenticator.generateSecret());
          await repos.emissionPoints.save(ep);
        }
      });
      throw new ServiceProvisioningError(
        err instanceof Error ? err.message : 'No se pudo aprovisionar las credenciales del terminal.',
      );
    }
  }
}
