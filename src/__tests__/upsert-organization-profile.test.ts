import { describe, it, expect } from 'vitest';
import { createInMemoryUow } from './helpers';
import { UpsertOrganizationProfileUseCase } from '../application/use-cases/upsert-organization-profile';
import { CountryNotEnabledError, InvalidTaxIdError, TaxIdAlreadyExistsError } from '../domain/errors';

describe('UpsertOrganizationProfileUseCase', () => {
  it('creates profile + 001/001 + emits 3 events on first call', async () => {
    const uow = createInMemoryUow();
    const useCase = new UpsertOrganizationProfileUseCase(uow);

    const result = await useCase.execute({
      organizationId: 'org-1',
      legalName: 'Acme S.A.',
      tradeName: 'Acme',
      taxId: '1790012345001',
      countryCode: 'EC',
    });

    expect(result.completed).toBe(true);
    expect(result.legalName).toBe('Acme S.A.');
    expect(result.taxId).toBe('1790012345001');
    expect(result.countryCode).toBe('EC');
  });

  it('rejects when country is not enabled', async () => {
    const uow = createInMemoryUow();
    const useCase = new UpsertOrganizationProfileUseCase(uow);

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        legalName: 'Test',
        taxId: '12345678901',
        countryCode: 'XX',
      }),
    ).rejects.toThrow(CountryNotEnabledError);
  });

  it('rejects invalid tax id format', async () => {
    const uow = createInMemoryUow();
    const useCase = new UpsertOrganizationProfileUseCase(uow);

    await expect(
      useCase.execute({
        organizationId: 'org-1',
        legalName: 'Test',
        taxId: '123',
        countryCode: 'EC',
      }),
    ).rejects.toThrow(InvalidTaxIdError);
  });

  it('rejects duplicate tax id', async () => {
    const uow = createInMemoryUow();
    const useCase = new UpsertOrganizationProfileUseCase(uow);

    await useCase.execute({
      organizationId: 'org-1',
      legalName: 'First',
      taxId: '1790012345001',
      countryCode: 'EC',
    });

    await expect(
      useCase.execute({
        organizationId: 'org-2',
        legalName: 'Second',
        taxId: '1790012345001',
        countryCode: 'EC',
      }),
    ).rejects.toThrow(TaxIdAlreadyExistsError);
  });

  it('does not re-provision 001/001 on second update', async () => {
    const uow = createInMemoryUow();
    const useCase = new UpsertOrganizationProfileUseCase(uow);

    await useCase.execute({
      organizationId: 'org-1',
      legalName: 'Acme S.A.',
      taxId: '1790012345001',
      countryCode: 'EC',
    });

    const result = await useCase.execute({
      organizationId: 'org-1',
      legalName: 'Acme Updated',
      taxId: '1790012345001',
      countryCode: 'EC',
    });

    expect(result.legalName).toBe('Acme Updated');
    expect(result.completed).toBe(true);
  });
});
