import { UnitOfWork } from '../ports';
import { PosThemeDTO } from '../dtos';
import { PosThemeConfig } from '../../domain/pos-theme';
import { assertThemeConfigAcceptable } from '../../domain/pos-theme-policy';
import { PosThemeNameAlreadyExistsError } from '../../domain/errors';
import { posThemeChangedPayload } from '../pos-theme-events';
import { findOwnedTheme } from './pos-theme-support';

/**
 * El `PUT` reemplaza el config entero y sube `version`. El versionado no es
 * decoración: es lo que el POS compara (a través del ETag) para saber si su
 * copia local está al día sin tener que descargar el JSON otra vez.
 */
export class UpdatePosThemeUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: {
    themeId: string;
    organizationId: string;
    name: string;
    config: PosThemeConfig;
  }): Promise<PosThemeDTO> {
    assertThemeConfigAcceptable(input.config);

    return this.uow.execute(async (repos) => {
      const theme = await findOwnedTheme(repos, input.themeId, input.organizationId);

      // Un nombre repetido no es un 404: el tema existe y es tuyo, lo que falla
      // es el nombre. El índice único de (organization_id, name) también lo
      // impide en la base.
      const sameName = await repos.posThemes.findByName(input.organizationId, input.name);
      if (sameName && sameName.id !== theme.id) {
        throw new PosThemeNameAlreadyExistsError();
      }

      theme.rename(input.name);
      theme.replaceConfig(input.config);
      await repos.posThemes.save(theme);

      const points = await repos.emissionPoints.listByOrganization(input.organizationId);
      await repos.outbox.add({
        type: 'organization.pos_theme.changed',
        aggregateType: 'pos_theme',
        aggregateId: theme.id,
        payload: posThemeChangedPayload({
          organizationId: input.organizationId,
          theme,
          points,
        }),
        occurredAt: new Date(),
      });

      return {
        id: theme.id,
        organizationId: theme.organizationId,
        name: theme.name,
        isDefault: theme.isDefault,
        version: theme.version,
        schemaVersion: theme.schemaVersion,
        config: theme.config,
        updatedAt: theme.updatedAt.toISOString(),
      };
    });
  }
}
