import { EmissionPointRepository, PosThemeRepository } from '../../domain/repositories';
import { PosThemeSummaryDTO } from '../dtos';

/**
 * Listado para el CRM. No devuelve el `config` completo a propósito: la lista
 * enseña una miniatura por tema y el config son 10 KB de JSON por cada uno.
 */
export class ListPosThemesUseCase {
  constructor(
    private readonly themes: PosThemeRepository,
    private readonly emissionPoints: EmissionPointRepository,
  ) {}

  async execute(organizationId: string): Promise<PosThemeSummaryDTO[]> {
    const themes = await this.themes.listByOrganization(organizationId);
    const points = await this.emissionPoints.listByOrganization(organizationId);

    const counts = new Map<string, number>();
    for (const point of points) {
      if (!point.posThemeId) continue;
      counts.set(point.posThemeId, (counts.get(point.posThemeId) ?? 0) + 1);
    }

    return themes.map((t) => ({
      id: t.id,
      name: t.name,
      isDefault: t.isDefault,
      version: t.version,
      updatedAt: t.updatedAt.toISOString(),
      assignedPointsCount: counts.get(t.id) ?? 0,
    }));
  }
}
