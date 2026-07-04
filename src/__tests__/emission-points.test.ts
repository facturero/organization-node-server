import { describe, it, expect } from 'vitest';
import { createInMemoryRepositories } from './helpers';
import { ListEmissionPointsUseCase } from '../application/use-cases/list-emission-points';
import { CreateEmissionPointUseCase } from '../application/use-cases/create-emission-point';
import { EstablishmentNotFoundError } from '../domain/errors';
import { Organization, Establishment, EmissionPoint } from '../domain/entities';
import { Repositories } from '../domain/repositories';
import { UnitOfWork } from '../application/ports';

describe('EmissionPoints', () => {
  async function seedSetup(repos: Repositories) {
    const org = Organization.create({ id: 'org-1', legalName: 'Test', taxId: '1790012345001', countryCode: 'EC' });
    await repos.organizations.save(org);
    const est = Establishment.create({ organizationId: 'org-1', code: '001', name: 'Matriz', countryCode: 'EC', isMain: true });
    await repos.establishments.save(est);
    return { org, est };
  }

  it('creates emission point with correlative code', async () => {
    const repos = createInMemoryRepositories();
    const { est } = await seedSetup(repos);
    const uow: UnitOfWork = { execute: (fn) => fn(repos) };
    const useCase = new CreateEmissionPointUseCase(uow);

    const result = await useCase.execute({
      establishmentId: est.id,
      organizationId: 'org-1',
      name: 'Punto 1',
    });

    expect(result.code).toBe('001');
    expect(result.establishmentId).toBe(est.id);
  });

  it('throws EstablishmentNotFoundError when establishment belongs to another org', async () => {
    const repos = createInMemoryRepositories();
    const { est } = await seedSetup(repos);
    const uow: UnitOfWork = { execute: (fn) => fn(repos) };
    const useCase = new CreateEmissionPointUseCase(uow);

    await expect(
      useCase.execute({
        establishmentId: est.id,
        organizationId: 'other-org',
      }),
    ).rejects.toThrow(EstablishmentNotFoundError);
  });

  it('lists emission points for an establishment', async () => {
    const repos = createInMemoryRepositories();
    const { est } = await seedSetup(repos);
    const ep1 = repos.emissionPoints.save(
      EmissionPoint.create({ establishmentId: est.id, organizationId: 'org-1', code: '001', name: 'P1' }),
    );
    const ep2 = repos.emissionPoints.save(
      EmissionPoint.create({ establishmentId: est.id, organizationId: 'org-1', code: '002', name: 'P2' }),
    );
    await Promise.all([ep1, ep2]);

    const useCase = new ListEmissionPointsUseCase(
      repos.establishments,
      repos.emissionPoints,
    );

    const result = await useCase.execute(est.id, 'org-1');
    expect(result).toHaveLength(2);
  });
});


