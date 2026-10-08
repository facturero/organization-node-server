import { UnitOfWork } from '../ports';
import {
  CannotDeleteDefaultPosThemeError,
  PosThemeInUseError,
} from '../../domain/errors';
import { findOwnedTheme } from './pos-theme-support';

/**
 * Borrar un tema. Se niega por dos motivos distintos y el cliente los muestra
 * distinto, así que son dos errores:
 *
 * - es el predeterminado → borrarlo dejaría a la organización sin tema por
 *   defecto, que es justo lo que el usuario quiere al borrar ("ya no lo uso"),
 *   no lo que quiere decir ("dejame todas las cajas sin tema configurado").
 * - hay cajas asignadas → hay que quitarlo de esas cajas primero, y el error
 *   dice cuántas para que el CRM ofrezca hacerlo.
 *
 * No avisa a las cajas: si el tema no está en uso, no hay ninguna a la que avisar (la FK
 * `ON DELETE SET NULL` cubre el caso de que alguien se salte el endpoint: volverían al predeterminado en su próximo
 * pull). Sí publica `organization.pos_theme.deleted`, pero solo para la bitácora de auditoría.
 */
export class DeletePosThemeUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: { themeId: string; organizationId: string }): Promise<void> {
    await this.uow.execute(async (repos) => {
      const theme = await findOwnedTheme(repos, input.themeId, input.organizationId);

      if (theme.isDefault) {
        throw new CannotDeleteDefaultPosThemeError();
      }

      const points = await repos.emissionPoints.listByOrganization(input.organizationId);
      const assigned = points.filter((p) => p.posThemeId === theme.id).length;
      if (assigned > 0) {
        throw new PosThemeInUseError(assigned);
      }

      await repos.posThemes.remove(theme.id);
      await repos.outbox.add({
        type: 'organization.pos_theme.deleted',
        aggregateType: 'pos_theme',
        aggregateId: theme.id,
        payload: { targetId: theme.id, organizationId: input.organizationId, name: theme.name },
        occurredAt: new Date(),
      });
    });
  }
}
