import { EstablishmentNotFoundError } from '../../domain/errors';
import {
  EmissionPointRepository,
  EstablishmentRepository,
  PosThemeRepository,
} from '../../domain/repositories';
import { EmissionPointDTO } from '../dtos';

export class ListEmissionPointsUseCase {
  constructor(
    private readonly estRepo: EstablishmentRepository,
    private readonly epRepo: EmissionPointRepository,
    private readonly themeRepo: PosThemeRepository,
  ) {}

  async execute(establishmentId: string, organizationId: string): Promise<EmissionPointDTO[]> {
    const est = await this.estRepo.findById(establishmentId);
    if (!est || !est.belongsToOrganization(organizationId)) {
      throw new EstablishmentNotFoundError();
    }

    const points = await this.epRepo.listByEstablishment(establishmentId);
    const themePorId = new Map<string, string>();
    // El nombre del tema efectivo se resuelve aquí para que el CRM muestre "qué
    // tema tiene esta caja" sin tener que pedir cada tema por separado. Se trae el
    // predeterminado de la organización una vez y se cachean los que ya tengan
    // override, porque el listado es corto y esto son dos consultas, no una por
    // caja.
    const porDefecto = await this.themeRepo.findDefault(organizationId);
    for (const p of points) {
      if (!p.posThemeId) continue;
      themePorId.set(
        p.posThemeId,
        (await this.themeRepo.findById(p.posThemeId))?.name ?? porDefecto?.name ?? '',
      );
    }

    return points.map((ep) => ({
      id: ep.id,
      establishmentId: ep.establishmentId,
      organizationId: ep.organizationId,
      code: ep.code,
      name: ep.name,
      status: ep.status,
      type: ep.type,
      paired: ep.isPaired(),
      posThemeId: ep.posThemeId ?? null,
      posThemeName: ep.posThemeId
        ? (themePorId.get(ep.posThemeId) ?? null)
        : (porDefecto?.name ?? null),
    }));
  }
}
