import { EmissionPoint, PosTheme } from '../domain/entities';

/**
 * `type` y no `interface` a propósito: un `type` de objeto literal recibe
 * índice implícito y así este payload se puede pasar directo a
 * `DomainEvent.payload` (que es `Record<string, unknown>`) sin un cast.
 */
export type PosThemeChangedPayload = {
  organizationId: string;
  /** `null` y no el centinela `"default"` cuando lo que cambió fue una
   * asignación: se quitó el override de una caja. Un centinela de texto
   * compilaría como un `string` cualquiera y un consumidor podría usarlo como id
   * sin que el compilador dijera nada; `null` obliga a tratarlo. */
  themeId: string | null;
  /** "all" = que cada caja decida si le afecta (comparando su propio punto).
   * Se usa cuando lo que cambió es el tema predeterminado, porque entonces
   * afecta a toda caja sin override y no hay forma barata de saber cuáles son
   * sin recorrerlas todas en el publicador. */
  affectedEmissionPointIds: string[] | 'all';
  /**
   * Los mismos puntos, pero como `deviceId`: es lo que el gateway usa para
   * enrutar al socket (`device:<deviceId>`) y lo único que funciona, porque la
   * sala dirigida de un POS es la de su dispositivo y no la de su punto de
   * emisión. Sin esto el gateway tendría que resolver emission point → device,
   * y el JWT del POS no lleva claim de punto de emisión.
   *
   * Solo van los puntos emparejados: uno sin `pairedDeviceId` no tiene socket
   * al que avisar, y cuando lo emparejen se le resolverá el tema igualmente.
   */
  affectedDeviceIds: string[];
};

/**
 * A quién hay que avisar de un cambio de tema (§4.4).
 *
 * Importa hacerlo bien porque, si no, se cae en el extremo opuesto: con
 * `"all"` en cada `PUT`, cualquier cambio de un tema propio haría que todas las
 * cajas volvieran a descargar su JSON, que es justo lo que pasa en una red de
 * tiendas con la línea más lenta del local. Con la lista exacta, solo
 * descargan las cajas a las que les toca.
 */
export function posThemeChangedPayload(params: {
  organizationId: string;
  theme: PosTheme;
  points: EmissionPoint[];
}): PosThemeChangedPayload {
  const { organizationId, theme, points } = params;

  // Un tema predeterminado llega a toda caja que no tenga override propio, y
  // el POS ya se filtra solo comparando su punto contra la lista.
  if (theme.isDefault) {
    return {
      organizationId,
      themeId: theme.id,
      affectedEmissionPointIds: 'all',
      // Irrelevant con "all": el gateway avisa a la sala de la organización y
      // deja que cada caja decida. Se manda vacío para no obligar a recorrer
      // todos los puntos de la org en cada cambio del predeterminado.
      affectedDeviceIds: [],
    };
  }

  const afectados = points.filter((p) => p.posThemeId === theme.id);

  return {
    organizationId,
    themeId: theme.id,
    affectedEmissionPointIds: afectados.map((p) => p.id),
    affectedDeviceIds: afectados
      .map((p) => p.pairedDeviceId)
      .filter((id): id is string => id !== null),
  };
}
