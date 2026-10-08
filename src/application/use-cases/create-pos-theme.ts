import { PosTheme } from '../../domain/entities';
import { PosThemeNameAlreadyExistsError } from '../../domain/errors';
import { UnitOfWork } from '../ports';
import { PosThemeDTO } from '../dtos';
import { PosThemeConfig } from '../../domain/pos-theme';
import { assertThemeConfigAcceptable } from '../../domain/pos-theme-policy';
import { posThemeChangedPayload } from '../pos-theme-events';

/**
 * Crear un tema. Si es el primero de la organización queda como predeterminado:
 * si no, la organización se quedaría sin tema por defecto y el "cambia el
 * predeterminado" no tendría a qué cambiar.
 */
export class CreatePosThemeUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: {
    organizationId: string;
    name: string;
    config: PosThemeConfig;
  }): Promise<PosThemeDTO> {
    assertThemeConfigAcceptable(input.config);

    return this.uow.execute(async (repos) => {
      if (await repos.posThemes.findByName(input.organizationId, input.name)) {
        throw new PosThemeNameAlreadyExistsError();
      }

      const existing = await repos.posThemes.listByOrganization(input.organizationId);
      const isFirst = existing.length === 0;

      const theme = PosTheme.create({
        organizationId: input.organizationId,
        name: input.name,
        config: input.config,
        isDefault: isFirst,
      });
      await repos.posThemes.save(theme);

      // Aviso solo para la bitácora de auditoría (el gateway y las cajas escuchan `.changed`, no este). Se publica SIEMPRE:
      // `.changed` solo sale con el primer tema, así que crear los demás no dejaba ningún rastro.
      await repos.outbox.add({
        type: 'organization.pos_theme.created',
        aggregateType: 'pos_theme',
        aggregateId: theme.id,
        payload: { targetId: theme.id, organizationId: input.organizationId, name: theme.name, isDefault: theme.isDefault },
        occurredAt: new Date(),
      });

      // El primer tema SÍ publica evento, aunque no esté en la lista de §4.4:
      // pasar de "sin tema configurado" a "toda caja con este tema" cambia lo
      // que enseñan todas las cajas, y las cajas solo se enteran por el aviso.
      if (isFirst) {
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
      }

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
