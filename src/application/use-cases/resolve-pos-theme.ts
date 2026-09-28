import {
  EmissionPointNotFoundError,
  EmissionPointNotPosTypeError,
} from '../../domain/errors';
import { EmissionPointRepository, EstablishmentRepository, PosThemeRepository } from '../../domain/repositories';
import { ResolvedPosThemeDTO } from '../dtos';
import {
  POS_THEME_BUILTIN_NAME,
  POS_THEME_SCHEMA_VERSION,
  PosThemeConfig,
  buildThemeEtag,
  resolveThemeAssets,
} from '../../domain/pos-theme';

/**
 * El endpoint que consume el POS: devuelve el tema RESUELTO de su caja, ya sea
 * el override del punto, el predeterminado de la organización o el integrado.
 *
 * Lo que nunca falla es la resolución del tema. Un punto que no existe sí es un
 * 404 (eso significa que la caja se emparejó con un punto que ya no está, que
 * es un problema de verdad y no de aspecto), pero un tema que falta es un
 * problema de datos, no de caja: si cae, cae al predeterminado y si no hay
 * ninguno, al integrado. Una caja sin tema resuelto tiene que seguir
 * funcionando con el aspecto que ya tenía.
 */
export class ResolvePosThemeUseCase {
  constructor(
    private readonly establishments: EstablishmentRepository,
    private readonly emissionPoints: EmissionPointRepository,
    private readonly themes: PosThemeRepository,
  ) {}

  async execute(input: {
    establishmentId: string;
    emissionPointId: string;
    organizationId: string;
  }): Promise<ResolvedPosThemeDTO> {
    const est = await this.establishments.findById(input.establishmentId);
    const point =
      est && est.belongsToOrganization(input.organizationId)
        ? await this.emissionPoints.findById(input.emissionPointId)
        : null;

    if (!point || point.establishmentId !== input.establishmentId) {
      throw new EmissionPointNotFoundError();
    }
    if (!point.isPosTerminal()) {
      throw new EmissionPointNotPosTypeError();
    }

    // 1. Override del punto. Si el tema ya no existe (se borró, o el punto
    //    quedó apuntando a algo roto) se cae al predeterminado: una caja
    //    Huérfana de tema tiene que seguir funcionando.
    if (point.posThemeId) {
      const override = await this.themes.findById(point.posThemeId);
      if (override && override.belongsToOrganization(input.organizationId)) {
        return {
          source: 'point',
          themeId: override.id,
          name: override.name,
          version: override.version,
          etag: buildThemeEtag(override.id, override.version),
          schemaVersion: override.schemaVersion,
          config: override.config,
          assets: resolveThemeAssets(override.config),
        };
      }
    }

    // 2. Predeterminado de la organización.
    const defaultTheme = await this.themes.findDefault(input.organizationId);
    if (defaultTheme) {
      return {
        source: 'default',
        themeId: defaultTheme.id,
        name: defaultTheme.name,
        version: defaultTheme.version,
        etag: buildThemeEtag(defaultTheme.id, defaultTheme.version),
        schemaVersion: defaultTheme.schemaVersion,
        config: defaultTheme.config,
        assets: resolveThemeAssets(defaultTheme.config),
      };
    }

    // 3. El tema integrado del POS: `config: null` porque el POS lo lleva de
    //    serie y no necesita que nadie se lo mande. Un ETag propio evita que
    //    su respuesta coincida con la de un tema guardado cualquiera.
    return {
      source: 'builtin',
      themeId: null,
      name: POS_THEME_BUILTIN_NAME,
      version: 0,
      etag: buildThemeEtag(null, 0),
      schemaVersion: POS_THEME_SCHEMA_VERSION,
      config: null as PosThemeConfig | null,
      assets: [],
    };
  }
}
