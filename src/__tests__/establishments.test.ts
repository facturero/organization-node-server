import { describe, it, expect } from 'vitest';
import { createInMemoryRepositories } from './helpers';
import { CreateEstablishmentUseCase } from '../application/use-cases/create-establishment';
import { UpdateEstablishmentUseCase } from '../application/use-cases/update-establishment';
import { OrganizationNotFoundError, CannotDeactivateMainError, EstablishmentNotFoundError } from '../domain/errors';
import { Organization, Establishment } from '../domain/entities';
import { Repositories } from '../domain/repositories';
import { UnitOfWork } from '../application/ports';

describe('Establishments', () => {
  async function seedOrg(repos: Repositories) {
    const org = Organization.create({ id: 'org-1', legalName: 'Test', taxId: '1790012345001', countryCode: 'EC' });
    await repos.organizations.save(org);
    return org;
  }

  describe('CreateEstablishmentUseCase', () => {
    it('creates with next code 001 when org exists but no establishments', async () => {
      const repos = createInMemoryRepositories();
      await seedOrg(repos);
      const uow: UnitOfWork = {
        execute: (fn) => fn(repos),
      };
      const useCase = new CreateEstablishmentUseCase(uow);

      const result = await useCase.execute({
        organizationId: 'org-1',
        name: 'Sucursal Norte',
      });

      expect(result.code).toBe('001');
      expect(result.name).toBe('Sucursal Norte');
      expect(result.organizationId).toBe('org-1');
    });

    it('numerates 002 after first establishment', async () => {
      const repos = createInMemoryRepositories();
      await seedOrg(repos);
      await repos.establishments.save(
        Establishment.create({ organizationId: 'org-1', code: '001', name: 'Matriz', countryCode: 'EC', isMain: true }),
      );
      const uow: UnitOfWork = { execute: (fn) => fn(repos) };
      const useCase = new CreateEstablishmentUseCase(uow);

      const result = await useCase.execute({
        organizationId: 'org-1',
        name: 'Sucursal Sur',
      });

      expect(result.code).toBe('002');
    });

    it('throws OrganizationNotFoundError when org does not exist', async () => {
      const repos = createInMemoryRepositories();
      const uow: UnitOfWork = { execute: (fn) => fn(repos) };
      const useCase = new CreateEstablishmentUseCase(uow);

      await expect(
        useCase.execute({ organizationId: 'org-missing', name: 'Test' }),
      ).rejects.toThrow(OrganizationNotFoundError);
    });
  });

  describe('UpdateEstablishmentUseCase', () => {
    it('throws CannotDeactivateMainError when deactivating main establishment', async () => {
      const repos = createInMemoryRepositories();
      await seedOrg(repos);
      const est = Establishment.create({ organizationId: 'org-1', code: '001', name: 'Matriz', countryCode: 'EC', isMain: true });
      await repos.establishments.save(est);
      const uow: UnitOfWork = { execute: (fn) => fn(repos) };
      const useCase = new UpdateEstablishmentUseCase(uow);

      await expect(
        useCase.execute({ id: est.id, organizationId: 'org-1', status: 'inactive' }),
      ).rejects.toThrow(CannotDeactivateMainError);
    });

    it('throws EstablishmentNotFoundError for cross-org access', async () => {
      const repos = createInMemoryRepositories();
      await seedOrg(repos);
      const est = Establishment.create({ organizationId: 'org-1', code: '001', name: 'Matriz', countryCode: 'EC' });
      await repos.establishments.save(est);
      const uow: UnitOfWork = { execute: (fn) => fn(repos) };
      const useCase = new UpdateEstablishmentUseCase(uow);

      await expect(
        useCase.execute({ id: est.id, organizationId: 'other-org', status: 'inactive' }),
      ).rejects.toThrow(EstablishmentNotFoundError);
    });
  });
});


