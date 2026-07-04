/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. organizations
    await queryInterface.createTable('organizations', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      legal_name: { type: Sequelize.STRING(255), allowNull: true },
      trade_name: { type: Sequelize.STRING(255), allowNull: true },
      tax_id: { type: Sequelize.STRING(20), allowNull: true },
      country_code: { type: Sequelize.STRING(2), allowNull: true },
      status: { type: Sequelize.ENUM('active', 'suspended'), allowNull: false, defaultValue: 'active' },
      settings: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('organizations', ['country_code', 'tax_id'], { unique: true });

    // 2. establishments
    await queryInterface.createTable('establishments', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      organization_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
      },
      code: { type: Sequelize.STRING(3), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      country_code: { type: Sequelize.STRING(2), allowNull: false },
      address: { type: Sequelize.STRING(255), allowNull: true },
      is_main: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('establishments', ['organization_id', 'code'], { unique: true });

    // 3. emission_points
    await queryInterface.createTable('emission_points', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      establishment_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'establishments', key: 'id' },
        onDelete: 'CASCADE',
      },
      organization_id: { type: Sequelize.CHAR(36), allowNull: false },
      code: { type: Sequelize.STRING(3), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: true },
      status: { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('emission_points', ['establishment_id', 'code'], { unique: true });

    // 4. organization_countries
    await queryInterface.createTable('organization_countries', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      organization_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onDelete: 'CASCADE',
      },
      country_code: { type: Sequelize.STRING(2), allowNull: false },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    });
    await queryInterface.addIndex('organization_countries', ['organization_id', 'country_code'], { unique: true });

    // 5. countries (read-model)
    await queryInterface.createTable('countries', {
      code: { type: Sequelize.STRING(2), primaryKey: true },
      name: { type: Sequelize.STRING(100), allowNull: true },
      currency_code: { type: Sequelize.STRING(3), allowNull: true },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    // 6. outbox_messages
    await queryInterface.createTable('outbox_messages', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      aggregate_type: { type: Sequelize.STRING(50), allowNull: false },
      aggregate_id: { type: Sequelize.CHAR(36), allowNull: false },
      type: { type: Sequelize.STRING(100), allowNull: false },
      payload: { type: Sequelize.JSON, allowNull: false },
      occurred_at: { type: Sequelize.DATE, allowNull: false },
      processed_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('outbox_messages', ['processed_at']);

    // 7. processed_events
    await queryInterface.createTable('processed_events', {
      event_id: { type: Sequelize.CHAR(36), primaryKey: true },
      processed_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('processed_events');
    await queryInterface.dropTable('outbox_messages');
    await queryInterface.dropTable('countries');
    await queryInterface.dropTable('organization_countries');
    await queryInterface.dropTable('emission_points');
    await queryInterface.dropTable('establishments');
    await queryInterface.dropTable('organizations');
  },
};
