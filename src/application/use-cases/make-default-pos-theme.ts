import { UnitOfWork } from '../ports';
import { PosThemeDTO } from '../dtos';
import { findOwnedTheme } from './pos-theme-support';
import { posThemeChangedPayload } from '../pos-theme-events';

/**
 * Poner un tema como predeterminado. La limpieza va DENTRO de la transacción:
 * MySQL no tiene índice único parcial sobre `is_default`, así que "un solo
 * default por organización" solo se puede garantizar aquí. Si el proceso se
 * muriera entre limpiar y guardar, la org se quedaría sin default; por eso el
 * orden importa poco pero ambas escrituras comparten transacción.
 *
 * Publica `"all"`: cambiar el predeterminado afecta a toda caja sin override.
 */
export class MakeDefaultPosThemeUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: {
    themeId: string;
    organizationId: string;
  }): Promise<PosThemeDTO> {
    return this.uow.execute(async (repos) => {
      const theme = await findOwnedTheme(repos, input.themeId, input.organizationId);

      await repos.posThemes.clearDefaultExcept(input.organizationId, theme.id);
      theme.makeDefault();
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
