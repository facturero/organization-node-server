'use strict';

/**
 * Temas de la aplicación web (el CRM), aparte de los de la caja (`pos_themes`): contratos distintos, el del POS lleva además
 * distribución de carrito y catálogo. Ver `frontend/docs/TEMAS.md`.
 *
 * - `app_themes`: los temas que crea cada empresa. `config` es JSON validado por el dominio (base + 8 colores), no por la base.
 * - `organization_theme_settings`: qué tema ve la empresa por defecto y si está fijado para todos. Una fila por organización, y
 *   solo cuando alguien la tocó (sin fila = claro y sin fijar). `default_theme` es `light`, `dark`, `system` o el id de un tema
 *   propio: por eso es texto y no una clave foránea.
 * - `user_theme_choices`: el tema que eligió cada usuario en cada organización. Vive aquí y no en auth-service para que una sola
 *   petición devuelva temas, ajustes y elección, y para que la regla «fijado para todos» se aplique junto al dato.
 *
 * Gratis para toda organización: nada lo ata a un plugin del catálogo (decisión del dueño, 2026-11-18).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_themes', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      organization_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(60), allowNull: false },
      config: { type: Sequelize.JSON, allowNull: false },
      created_by: { type: Sequelize.CHAR(36), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    // El nombre es único dentro de la organización: en el menú del avatar dos temas iguales no se distinguirían.
    await queryInterface.addIndex('app_themes', ['organization_id', 'name'], { unique: true });

    await queryInterface.createTable('organization_theme_settings', {
      organization_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
      },
      default_theme: { type: Sequelize.STRING(36), allowNull: false, defaultValue: 'light' },
      enforced: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('user_theme_choices', {
      organization_id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
      },
      // Sin clave foránea: los usuarios viven en auth-service.
      user_id: { type: Sequelize.CHAR(36), primaryKey: true },
      theme: { type: Sequelize.STRING(36), allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_theme_choices');
    await queryInterface.dropTable('organization_theme_settings');
    await queryInterface.dropTable('app_themes');
  },
};
