import './infrastructure/telemetry/otel';
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
import { GetPairingCodeUseCase } from './application/use-cases/get-pairing-code';
import { PairPosTerminalUseCase } from './application/use-cases/pair-pos-terminal';
import { UnlinkEmissionPointUseCase } from './application/use-cases/unlink-emission-point';
import { HttpServiceAccountProvisioner } from './infrastructure/auth-client';
import { OutboxRelay } from '@facturero/outbox-relay';
import { createApp } from './interface/http/app';

async function main(): Promise<void> {
  await sequelize.authenticate();
  await sequelize.sync();

  const repos = buildRepositories();
  let relay: OutboxRelay | undefined;
  const uow = new SequelizeUnitOfWork((tx) => relay?.attachToTransaction(tx));
  const serviceAccountProvisioner = new HttpServiceAccountProvisioner(
    config.AUTH_SERVICE_URL,
    config.INTERNAL_SERVICE_SECRET,
  );

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
      getPairingCode: new GetPairingCodeUseCase(repos.establishments, repos.emissionPoints),
      pairPosTerminal: new PairPosTerminalUseCase(uow, serviceAccountProvisioner),
      unlinkEmissionPoint: new UnlinkEmissionPointUseCase(uow),
      listOrganizationCountries: new ListOrganizationCountriesUseCase(repos.organizationCountries),
      addOrganizationCountry: new AddOrganizationCountryUseCase(uow),
    },
    corsOrigin: config.CORS_ORIGIN,
  });

  if (config.RABBITMQ_URL) {
    relay = new OutboxRelay({
      sequelize,
      rabbitmqUrl: config.RABBITMQ_URL,
      exchange: 'crm.events',
    });
    await relay.start();
    console.log('[messaging] outbox relay iniciado');
  }

  serve({ fetch: app.fetch, port: config.PORT }, (info) => {
    console.log(`organization-service escuchando en http://localhost:${info.port}`);
  });
}

main().catch((e) => {
  console.error('Fallo al iniciar organization-service:', e);
  process.exit(1);
});
