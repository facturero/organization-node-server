import { serve } from '@hono/node-server';
import { config } from './infrastructure/config';
import { sequelize } from './infrastructure/persistence/sequelize';
import './infrastructure/persistence/models';
import { buildRepositories, SequelizeUnitOfWork } from './infrastructure/persistence/repositories';
import { UpsertOrganizationProfileUseCase } from './application/use-cases/upsert-organization-profile';
import { GetMyOrganizationUseCase } from './application/use-cases/get-my-organization';
import { UpdateOrganizationUseCase } from './application/use-cases/update-organization';
import { ListEstablishmentsUseCase } from './application/use-cases/list-establishments';
import { CreateEstablishmentUseCase } from './application/use-cases/create-establishment';
import { UpdateEstablishmentUseCase } from './application/use-cases/update-establishment';
import { ListEmissionPointsUseCase } from './application/use-cases/list-emission-points';
import { CreateEmissionPointUseCase } from './application/use-cases/create-emission-point';
import { ListOrganizationCountriesUseCase } from './application/use-cases/list-organization-countries';
import { AddOrganizationCountryUseCase } from './application/use-cases/add-organization-country';
import { createApp } from './interface/http/app';

async function main(): Promise<void> {
  await sequelize.authenticate();

  const repos = buildRepositories();
  const uow = new SequelizeUnitOfWork();

  const app = createApp({
    useCases: {
      upsertOrganization: new UpsertOrganizationProfileUseCase(uow),
      getMyOrganization: new GetMyOrganizationUseCase(repos.organizations),
      updateOrganization: new UpdateOrganizationUseCase(uow),
      listEstablishments: new ListEstablishmentsUseCase(repos.establishments),
      createEstablishment: new CreateEstablishmentUseCase(uow),
      updateEstablishment: new UpdateEstablishmentUseCase(uow),
      listEmissionPoints: new ListEmissionPointsUseCase(repos.establishments, repos.emissionPoints),
      createEmissionPoint: new CreateEmissionPointUseCase(uow),
      listOrganizationCountries: new ListOrganizationCountriesUseCase(repos.organizationCountries),
      addOrganizationCountry: new AddOrganizationCountryUseCase(uow),
    },
    corsOrigin: config.CORS_ORIGIN,
  });

  serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(`organization-service escuchando en http://localhost:${info.port}`);
  });
}

main().catch((e) => {
  console.error('Fallo al iniciar organization-service:', e);
  process.exit(1);
});
