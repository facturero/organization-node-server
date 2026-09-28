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
import { GetPairingCodeUseCase } from '../../application/use-cases/get-pairing-code';
import { PairPosTerminalUseCase } from '../../application/use-cases/pair-pos-terminal';
import { UnlinkEmissionPointUseCase } from '../../application/use-cases/unlink-emission-point';
import { ListPosThemesUseCase } from '../../application/use-cases/list-pos-themes';
import { CreatePosThemeUseCase } from '../../application/use-cases/create-pos-theme';
import { GetPosThemeUseCase } from '../../application/use-cases/get-pos-theme';
import { UpdatePosThemeUseCase } from '../../application/use-cases/update-pos-theme';
import { DeletePosThemeUseCase } from '../../application/use-cases/delete-pos-theme';
import { MakeDefaultPosThemeUseCase } from '../../application/use-cases/make-default-pos-theme';
import { AssignPosThemeToPointUseCase } from '../../application/use-cases/assign-pos-theme-to-point';
import { ResolvePosThemeUseCase } from '../../application/use-cases/resolve-pos-theme';
import {
  addCountrySchema,
  assignPosThemeSchema,
  createEmissionPointSchema,
  createEstablishmentSchema,
  createPosThemeSchema,
  pairPosTerminalSchema,
  updateEstablishmentSchema,
  updateOrganizationSchema,
  updatePosThemeSchema,
  upsertOrganizationSchema,
  validateJson,
} from './validators';
import {
  addOrganizationCountryController,
  assignPosThemeToPointController,
  createEmissionPointController,
  createEstablishmentController,
  createPosThemeController,
  deletePosThemeController,
  getMyOrganizationController,
  getPairingCodeController,
  getPosThemeController,
  listEmissionPointsController,
  listEstablishmentsController,
  listOrganizationCountriesController,
  listPosThemesController,
  makeDefaultPosThemeController,
  pairPosTerminalController,
  resolvePosThemeController,
  unlinkEmissionPointController,
  updateEstablishmentController,
  updateOrganizationController,
  updatePosThemeController,
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
    getPairingCode: GetPairingCodeUseCase;
    pairPosTerminal: PairPosTerminalUseCase;
    unlinkEmissionPoint: UnlinkEmissionPointUseCase;
    listOrganizationCountries: ListOrganizationCountriesUseCase;
    addOrganizationCountry: AddOrganizationCountryUseCase;
    listPosThemes: ListPosThemesUseCase;
    createPosTheme: CreatePosThemeUseCase;
    getPosTheme: GetPosThemeUseCase;
    updatePosTheme: UpdatePosThemeUseCase;
    deletePosTheme: DeletePosThemeUseCase;
    makeDefaultPosTheme: MakeDefaultPosThemeUseCase;
    assignPosThemeToPoint: AssignPosThemeToPointUseCase;
    resolvePosTheme: ResolvePosThemeUseCase;
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

  /* Biblioteca de temas del POS. Los permisos son de organización (no de
   * establecimiento) porque un tema es de toda la organización: es lo que
   * permite que "todas mis cajas juntas" cambie en un solo sitio. */
  r.get('/organizations/me/pos-themes',
    requireOrganization(),
    requirePermission('organization:read'),
    listPosThemesController(useCases.listPosThemes));

  r.post('/organizations/me/pos-themes',
    requireOrganization(),
    requirePermission('organization:admin'),
    validateJson(createPosThemeSchema),
    createPosThemeController(useCases.createPosTheme));

  r.get('/organizations/me/pos-themes/:themeId',
    requireOrganization(),
    requirePermission('organization:read'),
    getPosThemeController(useCases.getPosTheme));

  r.put('/organizations/me/pos-themes/:themeId',
    requireOrganization(),
    requirePermission('organization:admin'),
    validateJson(updatePosThemeSchema),
    updatePosThemeController(useCases.updatePosTheme));

  r.delete('/organizations/me/pos-themes/:themeId',
    requireOrganization(),
    requirePermission('organization:admin'),
    deletePosThemeController(useCases.deletePosTheme));

  r.post('/organizations/me/pos-themes/:themeId/make-default',
    requireOrganization(),
    requirePermission('organization:admin'),
    makeDefaultPosThemeController(useCases.makeDefaultPosTheme));

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

  r.get('/establishments/:id/billing-points/:pointId/pairing-code',
    requireOrganization(),
    requirePermission('establishment:read'),
    getPairingCodeController(useCases.getPairingCode));

  r.post('/establishments/:id/billing-points/:pointId/unlink',
    requireOrganization(),
    requirePermission('establishment:update'),
    unlinkEmissionPointController(useCases.unlinkEmissionPoint));

  /* Tema efectivo de UNA caja. El `PUT` es para el CRM (asignar o quitar el
   * override, `themeId: null` = volver al predeterminado) y el `GET` es el que
   * consume el POS en cada arranque y en cada aviso por socket. */
  r.put('/establishments/:id/billing-points/:pointId/theme',
    requireOrganization(),
    requirePermission('organization:admin'),
    validateJson(assignPosThemeSchema),
    assignPosThemeToPointController(useCases.assignPosThemeToPoint));

  r.get('/establishments/:id/billing-points/:pointId/theme',
    requireOrganization(),
    requirePermission('organization:read'),
    resolvePosThemeController(useCases.resolvePosTheme));

  return r;
}

// Rutas PÚBLICAS de emparejamiento: un terminal POS sin configurar no tiene
// JWT ni contexto de organización todavía, así que estas rutas viven fuera
// de establishmentRoutes() (que exige requireOrganization en todo lo demás)
// y se registran en el gateway con `public: true`.
export function pairingRoutes(deps: AppDependencies): Hono {
  const r = new Hono();
  const { useCases } = deps;

  r.post('/billing-points/pair',
    validateJson(pairPosTerminalSchema),
    pairPosTerminalController(useCases.pairPosTerminal));

  return r;
}
