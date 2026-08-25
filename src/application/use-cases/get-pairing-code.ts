import { authenticator } from 'otplib';
import { EmissionPointRepository, EstablishmentRepository } from '../../domain/repositories';
import {
  EmissionPointNotFoundError,
  EmissionPointNotPosTypeError,
  EstablishmentNotFoundError,
} from '../../domain/errors';
import { PairingCodeDTO } from '../dtos';

export class GetPairingCodeUseCase {
  constructor(
    private readonly estRepo: EstablishmentRepository,
    private readonly epRepo: EmissionPointRepository,
  ) {}

  async execute(params: {
    establishmentId: string;
    emissionPointId: string;
    organizationId: string;
  }): Promise<PairingCodeDTO> {
    const est = await this.estRepo.findById(params.establishmentId);
    if (!est || !est.belongsToOrganization(params.organizationId)) {
      throw new EstablishmentNotFoundError();
    }

    const ep = await this.epRepo.findById(params.emissionPointId);
    if (!ep || ep.establishmentId !== params.establishmentId) {
      throw new EmissionPointNotFoundError();
    }
    if (!ep.isPosTerminal() || !ep.totpSecret) {
      throw new EmissionPointNotPosTypeError();
    }

    return {
      code: authenticator.generate(ep.totpSecret),
      secondsRemaining: authenticator.timeRemaining(),
    };
  }
}
