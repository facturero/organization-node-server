import { zValidator } from '@hono/zod-validator';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../../domain/errors';

export const upsertOrganizationSchema = z.object({
  legalName: z.string().min(1, 'La razón social es obligatoria.').max(255),
  tradeName: z.string().max(255).optional(),
  taxId: z.string().min(1, 'El RUC/RFC/NIT es obligatorio.').max(20),
  countryCode: z.string().length(2, 'El código de país debe tener 2 caracteres.'),
});

export const updateOrganizationSchema = z.object({
  legalName: z.string().max(255).optional(),
  tradeName: z.string().max(255).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const createEstablishmentSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.').max(255),
  address: z.string().max(255).optional(),
  countryCode: z.string().length(2).optional(),
});

export const updateEstablishmentSchema = z.object({
  name: z.string().max(255).optional(),
  address: z.string().max(255).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const createEmissionPointSchema = z.object({
  name: z.string().max(255).optional(),
});

export const addCountrySchema = z.object({
  countryCode: z.string().length(2, 'El código de país debe tener 2 caracteres.'),
});

export function validateJson<T extends ZodSchema>(schema: T) {
  return zValidator('json', schema, (result) => {
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
      }));
      throw new ValidationError(details);
    }
  });
}
