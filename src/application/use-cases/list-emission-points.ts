import { EstablishmentNotFoundError } from '../../domain/errors';
import { EmissionPointRepository, EstablishmentRepository } from '../../domain/repositories';
import { EmissionPointDTO } from '../dtos';

export class ListEmissionPointsUseCase {
  constructor(
    private readonly estRepo: EstablishmentRepository,
    private readonly epRepo: EmissionPointRepository,
  ) {}

  async execute(establishmentId: string, organizationId: string): Promise<EmissionPointDTO[]> {
    const est = await this.estRepo.findById(establishmentId);
    if (!est || !est.belongsToOrganization(organizationId)) {
      throw new EstablishmentNotFoundError();
    }

    const points = await this.epRepo.listByEstablishment(establishmentId);
    return points.map((ep) => ({
      id: ep.id,
      establishmentId: ep.establishmentId,
      organizationId: ep.organizationId,
      code: ep.code,
      name: ep.name,
      status: ep.status,
    }));
  }
}
