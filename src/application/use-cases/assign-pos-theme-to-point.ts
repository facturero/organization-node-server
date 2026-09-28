import { UnitOfWork } from '../ports';
import {
  EmissionPointNotFoundError,
  EmissionPointNotPosTypeError,
  EstablishmentNotFoundError,
} from '../../domain/errors';
import { EmissionPointDTO } from '../dtos';
import { findOwnedTheme } from './pos-theme-support';

/**
 * Asignar (o quitar) el tema propio de una caja. `themeId: null` devuelve la
 * caja al predeterminado de la organización.
 *
 * Solo puntos `type = 'pos'`: un punto web no tiene pantalla que tematizar, y
 * dejarlo pasar convertiría el 422 en un "asigné un tema a algo que no lo usa"
 * que nadie notaría hasta que el cliente saliera preguntando.
 */
export class AssignPosThemeToPointUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: {
    establishmentId: string;
    emissionPointId: string;
    organizationId: string;
    themeId: string | null;
  }): Promise<EmissionPointDTO> {
    return this.uow.execute(async (repos) => {
      const est = await repos.establishments.findById(input.establishmentId);
      if (!est || !est.belongsToOrganization(input.organizationId)) {
        throw new EstablishmentNotFoundError();
      }

      const point = await repos.emissionPoints.findById(input.emissionPointId);
      if (!point || point.establishmentId !== input.establishmentId) {
        throw new EmissionPointNotFoundError();
      }
      if (!point.isPosTerminal()) {
        throw new EmissionPointNotPosTypeError();
      }

      // Un override que no existe (o es de otra organización) es un 404 como si
      // no existiera: no se confirma la existencia de temas ajenos.
      if (input.themeId !== null) {
        await findOwnedTheme(repos, input.themeId, input.organizationId);
      }

      point.setPosTheme(input.themeId);
      await repos.emissionPoints.save(point);

      await repos.outbox.add({
        type: 'organization.pos_theme.changed',
        aggregateType: 'emission_point',
        aggregateId: point.id,
        payload: {
          organizationId: point.organizationId,
          themeId: input.themeId,
          // Solo esta caja: es la única a la que le cambia lo que ve.
          affectedEmissionPointIds: [point.id],
          // Sin device no hay socket al que avisar; cuando lo emparejen tirará
          // del tema por HTTP y ya lo tendrá.
          affectedDeviceIds: point.pairedDeviceId ? [point.pairedDeviceId] : [],
        },
        occurredAt: new Date(),
      });

      const themeName = input.themeId
        ? (await findOwnedTheme(repos, input.themeId, input.organizationId)).name
        : (await repos.posThemes.findDefault(input.organizationId))?.name ?? null;

      return {
        id: point.id,
        establishmentId: point.establishmentId,
        organizationId: point.organizationId,
        code: point.code,
        name: point.name,
        status: point.status,
        type: point.type,
        paired: point.isPaired(),
        posThemeId: point.posThemeId,
        posThemeName: themeName,
      };
    });
  }
}
