import { zValidator } from '@hono/zod-validator';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../../domain/errors';
import {
  POS_THEME_CART_POSITIONS,
  POS_THEME_CART_WIDTHS,
  POS_THEME_CATEGORIES_PLACEMENTS,
  POS_THEME_DENSITIES,
  POS_THEME_FONT_FAMILIES,
  POS_THEME_LOGO_POSITIONS,
  POS_THEME_LOGO_SIZES,
  POS_THEME_MODES,
  POS_THEME_PRODUCT_CARDS,
  POS_THEME_RADII,
  POS_THEME_SCHEMA_VERSION,
  POS_THEME_STATUS_BAR_POSITIONS,
} from '../../domain/pos-theme';

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
  type: z.enum(['web', 'pos']).optional(),
});

export const pairPosTerminalSchema = z.object({
  code: z.string().length(6, 'El código debe tener 6 dígitos.').regex(/^\d{6}$/, 'El código debe ser numérico.'),
  deviceId: z.string().uuid('deviceId debe ser un UUID válido.'),
});

export const addCountrySchema = z.object({
  countryCode: z.string().length(2, 'El código de país debe tener 2 caracteres.'),
});

/* ------------------------------------------------------------------ *
 * Tema del POS (§3.1)
 *
 * `.strict()` en todos los niveles: lo que no esté en la lista se rechaza con
 * 422. El motivo es de seguridad, no de descuido — el POS es un kiosco y el
 * tema se aplica en la caja: si el servidor aceptara un campo desconocido no se
 * sabría qué hacer con él, y si aceptara `css` o `script` se podría ejecutar
 * código de un tercero en la pantalla de cobro.
 * ------------------------------------------------------------------ */

/** `#rrggbb` en minúsculas y sin alfa: el alfa haría el contraste imposible de
 * razonar y el POS no compensa el texto bajo una capa translúcida. */
const hexColor = z
  .string()
  .regex(/^#[0-9a-f]{6}$/, 'El color debe ser #rrggbb en minúsculas, sin alfa.');

const fileId = z.string().uuid('El fileId debe ser un UUID válido.');

const colorsSchema = z
  .object({
    primary: hexColor,
    background: hexColor,
    surface: hexColor,
    surfaceAlt: hexColor,
    text: hexColor,
    textMuted: hexColor,
    border: hexColor,
    success: hexColor,
    warning: hexColor,
    danger: hexColor,
  })
  .strict();

const timeHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener el formato HH:MM (24 h).');

export const posThemeConfigSchema = z
  .object({
    schemaVersion: z.literal(POS_THEME_SCHEMA_VERSION, { message: 'La versión del esquema no es la esperada.' }),
    mode: z.enum(POS_THEME_MODES),
    allowCashierToggle: z.boolean(),
    schedule: z
      .object({ darkFrom: timeHHMM, darkTo: timeHHMM })
      .strict(),
    colors: z
      .object({ light: colorsSchema, dark: colorsSchema })
      .strict(),
    typography: z
      .object({
        fontFamily: z.enum(POS_THEME_FONT_FAMILIES),
        baseSize: z
          .number()
          .int('El tamaño base debe ser un entero.')
          .min(14, 'El tamaño base mínimo es 14.')
          .max(20, 'El tamaño base máximo es 20.'),
        headingWeight: z.union([z.literal(500), z.literal(600), z.literal(700)]),
      })
      .strict(),
    shape: z
      .object({
        radius: z.enum(POS_THEME_RADII),
        density: z.enum(POS_THEME_DENSITIES),
        shadows: z.boolean(),
        borderWidth: z.union([z.literal(0), z.literal(1), z.literal(2)]),
      })
      .strict(),
    layout: z
      .object({
        cartPosition: z.enum(POS_THEME_CART_POSITIONS),
        cartWidth: z.enum(POS_THEME_CART_WIDTHS),
        // "auto" o un número fijo de columnas: un entero fuera de 2..6 daría
        // tarjetas ilegibles o un scroll eterno en una pantalla de 800x480.
        catalogColumns: z.union([
          z.literal('auto'),
          z.number().int().min(2, 'Mínimo 2 columnas.').max(6, 'Máximo 6 columnas.'),
        ]),
        productCard: z.enum(POS_THEME_PRODUCT_CARDS),
        categoriesPlacement: z.enum(POS_THEME_CATEGORIES_PLACEMENTS),
        statusBarPosition: z.enum(POS_THEME_STATUS_BAR_POSITIONS),
        showProductImages: z.boolean(),
      })
      .strict(),
    branding: z
      .object({
        logoFileId: fileId.nullable(),
        logoDarkFileId: fileId.nullable(),
        logoPosition: z.enum(POS_THEME_LOGO_POSITIONS),
        logoSize: z.enum(POS_THEME_LOGO_SIZES),
        showLogoOnLogin: z.boolean(),
        loginBackground: z.discriminatedUnion('type', [
          z.object({ type: z.literal('color'), color: hexColor.nullable(), imageFileId: z.null() }).strict(),
          z.object({ type: z.literal('image'), color: z.null(), imageFileId: fileId }).strict(),
        ]),
        welcomeMessage: z
          .string()
          .max(80, 'El mensaje de bienvenida admite 80 caracteres como máximo.')
          .nullable(),
      })
      .strict(),
  })
  .strict();

export const createPosThemeSchema = z
  .object({
    name: z.string().min(1, 'El nombre del tema es obligatorio.').max(80),
    config: posThemeConfigSchema,
  })
  .strict();

export const updatePosThemeSchema = createPosThemeSchema;

export const assignPosThemeSchema = z
  .object({ themeId: z.string().uuid('El themeId debe ser un UUID válido.').nullable() })
  .strict();

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
