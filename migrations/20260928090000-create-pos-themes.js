'use strict';

/**
 * Biblioteca de temas del POS por organización (§4.1 del encargo).
 *
 * Un tema es SOLO DATOS: la columna `config` guarda el JSON con `schemaVersion`
 * y lo valida el dominio, no la base. No hay `plugin_id` ni nada que lo haga
 * de pago: los temas están disponibles para toda organización.
 *
 * `is_default` NO lleva índice único a propósito: MySQL no tiene índices únicos
 * parciales, y un índice único sobre `(organization_id, is_default)` dejaría
 * meter UN solo tema no-default por organización (todos los `false` colisionarían).
 * El "un solo default" se aplica en el caso de uso, dentro de la transacción.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pos_themes', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      organization_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(80), allowNull: false },
      config: { type: Sequelize.JSON, allowNull: false },
      schema_version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('pos_themes', ['organization_id']);
    // El nombre del tema es único dentro de la organización, no globalmente: dos
    // tiendas distintas pueden llamar "Oscuro" a su tema.
    await queryInterface.addIndex('pos_themes', ['organization_id', 'name'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('pos_themes');
  },
};
