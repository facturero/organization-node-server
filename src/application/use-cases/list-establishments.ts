import { EstablishmentRepository } from '../../domain/repositories';
import { EstablishmentDTO } from '../dtos';

export class ListEstablishmentsUseCase {
  constructor(private readonly estRepo: EstablishmentRepository) {}

  async execute(organizationId: string): Promise<EstablishmentDTO[]> {
    const ests = await this.estRepo.listByOrganization(organizationId);
    return ests.map((e) => ({
      id: e.id,
      organizationId: e.organizationId,
      code: e.code,
      name: e.name,
      countryCode: e.countryCode,
      address: e.address,
      isMain: e.isMain,
      status: e.status,
    }));
  }
}
