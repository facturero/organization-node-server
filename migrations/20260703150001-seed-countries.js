/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('countries', [
      {
        code: 'EC',
        name: 'Ecuador',
        currency_code: 'USD',
        enabled: true,
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('countries', { code: 'EC' });
  },
};
