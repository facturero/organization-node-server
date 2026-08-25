'use strict';

/**
 * Rastrea qué terminal físico (deviceId del POS) está emparejado con cada
 * punto de emisión. Se llena al emparejar (viene en el body de /pair, el POS
 * genera su deviceId en el primer arranque) y se limpia al desvincular. Sirve
 * para que el gateway hub pueda enrutar el evento de desvinculación al
 * dispositivo exacto (sala socket.io `device:<deviceId>`).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('emission_points', 'paired_device_id', {
      type: Sequelize.CHAR(36),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('emission_points', 'paired_device_id');
  },
};
