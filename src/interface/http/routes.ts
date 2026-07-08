import { Hono } from 'hono';
import { UpsertOrganizationProfileUseCase } from '../../application/use-cases/upsert-organization-profile';
import { GetMyOrganizationUseCase } from '../../application/use-cases/get-my-organization';
import { UpdateOrganizationUseCase } from '../../application/use-cases/update-organization';
import { ListEstablishmentsUseCase } from '../../application/use-cases/list-establishments';
import { CreateEstablishmentUseCase } from '../../application/use-cases/create-establishment';
import { UpdateEstablishmentUseCase } from '../../application/use-cases/update-establishment';
import { ListEmissionPointsUseCase } from '../../application/use-cases/list-emission-points';
import { CreateEmissionPointUseCase } from '../../application/use-cases/create-emission-point';
import { ListOrganizationCountriesUseCase } from '../../application/use-cases/list-organization-countries';
import { AddOrganizationCountryUseCase } from '../../application/use-cases/add-organization-country';
import {
  addCountrySchema,
  createEmissionPointSchema,
  createEstablishmentSchema,
  updateEstablishmentSchema,
  updateOrganizationSchema,
  upsertOrganizationSchema,
  validateJson,
} from './validators';
import {
  addOrganizationCountryController,
  createEmissionPointController,
  createEstablishmentController,
  getMyOrganizationController,
  listEmissionPointsController,
  listEstablishmentsController,
  listOrganizationCountriesController,
  updateEstablishmentController,
  updateOrganizationController,
  upsertOrganizationController,
} from './controllers';
import { ContextVariables, requireOrganization, requirePermission } from './middlewares';

type Vars = { Variables: ContextVariables };

export interface AppDependencies {
  useCases: {
    upsertOrganization: UpsertOrganizationProfileUseCase;
    getMyOrganization: GetMyOrganizationUseCase;
    updateOrganization: UpdateOrganizationUseCase;
    listEstablishments: ListEstablishmentsUseCase;
    createEstablishment: CreateEstablishmentUseCase;
    updateEstablishment: UpdateEstablishmentUseCase;
    listEmissionPoints: ListEmissionPointsUseCase;
    createEmissionPoint: CreateEmissionPointUseCase;
    listOrganizationCountries: ListOrganizationCountriesUseCase;
    addOrganizationCountry: AddOrganizationCountryUseCase;
  };
  corsOrigin: string;
}

export function healthRoutes(): Hono {
  const r = new Hono();
  r.get('/health', (c) => c.json({ status: 'ok' }));
  return r;
}

export function organizationRoutes(deps: AppDependencies): Hono<Vars> {
  const r = new Hono<Vars>();
  const { useCases } = deps;

  r.get('/organizations/me',
    requireOrganization(),
    requirePermission('organization:read'),
    getMyOrganizationController(useCases.getMyOrganization));

  r.put('/organizations/me',
    requireOrganization(),
    requirePermission('organization:admin'),
    validateJson(upsertOrganizationSchema),
    upsertOrganizationController(useCases.upsertOrganization));

  r.patch('/organizations/me',
    requireOrganization(),
    requirePermission('organization:admin'),
    validateJson(updateOrganizationSchema),
    updateOrganizationController(useCases.updateOrganization));

  r.get('/organizations/me/countries',
    requireOrganization(),
    requirePermission('organization:read'),
    listOrganizationCountriesController(useCases.listOrganizationCountries));

  r.post('/organizations/me/countries',
    requireOrganization(),
    requirePermission('organization:admin'),
    validateJson(addCountrySchema),
    addOrganizationCountryController(useCases.addOrganizationCountry));

  return r;
}

export function establishmentRoutes(deps: AppDependencies): Hono<Vars> {
  const r = new Hono<Vars>();
  const { useCases } = deps;

  r.get('/establishments',
    requireOrganization(),
    requirePermission('establishment:read'),
    listEstablishmentsController(useCases.listEstablishments));

  r.post('/establishments',
    requireOrganization(),
    requirePermission('establishment:create'),
    validateJson(createEstablishmentSchema),
    createEstablishmentController(useCases.createEstablishment));

  r.patch('/establishments/:id',
    requireOrganization(),
    requirePermission('establishment:update'),
    validateJson(updateEstablishmentSchema),
    updateEstablishmentController(useCases.updateEstablishment));

  r.get('/establishments/:id/billing-points',
    requireOrganization(),
    requirePermission('establishment:read'),
    listEmissionPointsController(useCases.listEmissionPoints));

  r.post('/establishments/:id/billing-points',
    requireOrganization(),
    requirePermission('establishment:create'),
    validateJson(createEmissionPointSchema),
    createEmissionPointController(useCases.createEmissionPoint));

  return r;
}
