/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('emission_points', 'type', {
      type: Sequelize.ENUM('web', 'pos'),
      allowNull: false,
      defaultValue: 'web',
    });
    await queryInterface.addColumn('emission_points', 'totp_secret', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addColumn('emission_points', 'paired_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('emission_points', 'paired_at');
    await queryInterface.removeColumn('emission_points', 'totp_secret');
    await queryInterface.removeColumn('emission_points', 'type');
  },
};
