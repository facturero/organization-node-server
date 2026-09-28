'use strict';

/**
 * Override de tema por punto de emisión (§4.1). `NULL` = la caja hereda el tema
 * predeterminado de la organización (y si la organización no tiene, el integrado
 * del POS). Es el mismo mecanismo que cubre "todas mis cajas juntas" y "esta
 * caja es única".
 *
 * La FK es `ON DELETE SET NULL` a propósito: si un tema llegara a borrarse con
 * cajas asignadas (el endpoint lo impide con un 409, pero la base no depende de
 * que nadie se lo salté), lo que debe pasar es que esas cajas vuelvan al
 * predeterminado de su organización, no que queden apuntando a una fila que ya
 * no existe. `organization_id` en esta tabla NO lleva FK por el mismo criterio
 * que ya tenía antes de este cambio.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('emission_points', 'pos_theme_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      references: { model: 'pos_themes', key: 'id' },
      onDelete: 'SET NULL',
    });

    // Índice aparte (no se crea con la columna): la resolución del tema filtra
    // por los puntos que tienen override para saber a quién hay que avisar.
    await queryInterface.addIndex('emission_points', ['pos_theme_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('emission_points', ['pos_theme_id']);
    await queryInterface.removeColumn('emission_points', 'pos_theme_id');
  },
};
