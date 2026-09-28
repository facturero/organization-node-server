import { PosTheme } from '../../domain/entities';
import { PosThemeNotFoundError } from '../../domain/errors';

type ThemeFinder = {
  posThemes: { findById(id: string): Promise<PosTheme | null> };
};

/**
 * Resuelve un tema exigiendo que sea de esta organización, o 404. Nunca 403: un
 * tema de otra organización no debe ni confirmar que existe.
 *
 * Vive aparte porque lo usan por igual el listado, el detalle, el borrado, el
 * "poner como predeterminado" y la asignación a una caja, y en cada uno el
 * filtro por `organizationId` es la regla de oro de aislamiento del servicio.
 */
export async function findOwnedTheme(
  repos: ThemeFinder,
  themeId: string,
  organizationId: string,
): Promise<PosTheme> {
  const theme = await repos.posThemes.findById(themeId);
  if (!theme || !theme.belongsToOrganization(organizationId)) {
    throw new PosThemeNotFoundError();
  }
  return theme;
}
