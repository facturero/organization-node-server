import { Context } from 'hono';
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
import { ContextVariables } from './middlewares';

export function getMyOrganizationController(useCase: GetMyOrganizationUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const result = await useCase.execute(orgId);
    return c.json(result, 200);
  };
}

export function upsertOrganizationController(useCase: UpsertOrganizationProfileUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const body = c.req.valid('json' as never) as {
      legalName: string;
      tradeName?: string;
      taxId: string;
      countryCode: string;
    };
    const result = await useCase.execute({
      organizationId: orgId,
      legalName: body.legalName,
      tradeName: body.tradeName,
      taxId: body.taxId,
      countryCode: body.countryCode,
    });
    return c.json(result, 200);
  };
}

export function updateOrganizationController(useCase: UpdateOrganizationUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const body = c.req.valid('json' as never) as {
      legalName?: string;
      tradeName?: string;
      settings?: Record<string, unknown>;
    };
    const result = await useCase.execute({
      organizationId: orgId,
      legalName: body.legalName,
      tradeName: body.tradeName,
      settings: body.settings,
    });
    return c.json(result, 200);
  };
}

export function listEstablishmentsController(useCase: ListEstablishmentsUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const result = await useCase.execute(orgId);
    return c.json(result, 200);
  };
}

export function createEstablishmentController(useCase: CreateEstablishmentUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const body = c.req.valid('json' as never) as {
      name: string;
      address?: string;
      countryCode?: string;
    };
    const result = await useCase.execute({
      organizationId: orgId,
      name: body.name,
      address: body.address,
      countryCode: body.countryCode,
    });
    return c.json(result, 201);
  };
}

export function updateEstablishmentController(useCase: UpdateEstablishmentUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const id = c.req.param('id') ?? '';
    const body = c.req.valid('json' as never) as {
      name?: string;
      address?: string;
      status?: 'active' | 'inactive';
    };
    const result = await useCase.execute({
      id,
      organizationId: orgId,
      name: body.name,
      address: body.address,
      status: body.status,
    });
    return c.json(result, 200);
  };
}

export function listEmissionPointsController(useCase: ListEmissionPointsUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const estId = c.req.param('id') ?? '';
    const result = await useCase.execute(estId, orgId);
    return c.json(result, 200);
  };
}

export function createEmissionPointController(useCase: CreateEmissionPointUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const estId = c.req.param('id') ?? '';
    const body = c.req.valid('json' as never) as { name?: string };
    const result = await useCase.execute({
      establishmentId: estId,
      organizationId: orgId,
      name: body.name,
    });
    return c.json(result, 201);
  };
}

export function listOrganizationCountriesController(useCase: ListOrganizationCountriesUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const result = await useCase.execute(orgId);
    return c.json(result, 200);
  };
}

export function addOrganizationCountryController(useCase: AddOrganizationCountryUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const orgId = c.get('organizationId');
    const body = c.req.valid('json' as never) as { countryCode: string };
    const result = await useCase.execute({
      organizationId: orgId,
      countryCode: body.countryCode,
    });
    return c.json(result, 201);
  };
}
