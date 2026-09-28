export interface ErrorDetail {
  field: string;
  message: string;
}

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly details?: ErrorDetail[];
  /** Campos extra que el error necesita en la respuesta además de code/message
   * (por ejemplo `pairs` en LOW_CONTRAST o `assignedPointsCount` en el 409 de
   * borrar un tema en uso). El errorHandler los copia tal cual al JSON. */
  readonly extra?: Record<string, unknown>;

  constructor(message: string, details?: ErrorDetail[], extra?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    this.extra = extra;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 422;
  constructor(details: ErrorDetail[], message = 'La petición no es válida.') {
    super(message, details);
  }
}

export class OrganizationContextRequiredError extends AppError {
  readonly code = 'ORG_CONTEXT_REQUIRED';
  readonly httpStatus = 401;
  constructor(message = 'Falta el contexto de organización.') { super(message); }
}

export class UserContextRequiredError extends AppError {
  readonly code = 'USER_CONTEXT_REQUIRED';
  readonly httpStatus = 401;
  constructor(message = 'Falta el contexto de usuario.') { super(message); }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
  constructor(message = 'Permiso insuficiente.') { super(message); }
}

export class OrganizationNotFoundError extends AppError {
  readonly code = 'ORG_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'Organización no encontrada.') { super(message); }
}

export class EstablishmentNotFoundError extends AppError {
  readonly code = 'ESTABLISHMENT_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'Establecimiento no encontrado.') { super(message); }
}

export class EmissionPointNotFoundError extends AppError {
  readonly code = 'EMISSION_POINT_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'Punto de emisión no encontrado.') { super(message); }
}

export class InvalidCountryCodeError extends AppError {
  readonly code = 'INVALID_COUNTRY_CODE';
  readonly httpStatus = 422;
  constructor(message = 'Código de país inválido.') { super(message); }
}

export class CountryNotEnabledError extends AppError {
  readonly code = 'COUNTRY_NOT_ENABLED';
  readonly httpStatus = 422;
  constructor(message = 'El país no está habilitado.') { super(message); }
}

export class InvalidTaxIdError extends AppError {
  readonly code = 'INVALID_TAX_ID';
  readonly httpStatus = 422;
  constructor(message = 'El RUC/RFC/NIT no tiene un formato válido para el país.') { super(message); }
}

export class TaxIdAlreadyExistsError extends AppError {
  readonly code = 'TAX_ID_EXISTS';
  readonly httpStatus = 409;
  constructor(message = 'Ya existe una organización con ese RUC en el país.') { super(message); }
}

export class CannotDeactivateMainError extends AppError {
  readonly code = 'CANNOT_DEACTIVATE_MAIN';
  readonly httpStatus = 422;
  constructor(message = 'No se puede desactivar el establecimiento matriz.') { super(message); }
}

export class InvalidPairingCodeError extends AppError {
  readonly code = 'INVALID_PAIRING_CODE';
  readonly httpStatus = 401;
  constructor(message = 'El código no es válido o ya expiró.') { super(message); }
}

export class EmissionPointNotPosTypeError extends AppError {
  readonly code = 'EMISSION_POINT_NOT_POS';
  readonly httpStatus = 422;
  constructor(message = 'Este punto de emisión no es de tipo POS.') { super(message); }
}

export class ServiceProvisioningError extends AppError {
  readonly code = 'SERVICE_PROVISIONING_FAILED';
  readonly httpStatus = 502;
  constructor(message = 'No se pudo aprovisionar las credenciales del terminal.') { super(message); }
}

export class PosThemeNotFoundError extends AppError {
  readonly code = 'POS_THEME_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'Tema del POS no encontrado.') { super(message); }
}

export class PosThemeNameAlreadyExistsError extends AppError {
  readonly code = 'POS_THEME_NAME_EXISTS';
  readonly httpStatus = 409;
  constructor(message = 'Ya existe un tema con ese nombre en la organización.') { super(message); }
}

/** El default no se puede borrar: sin él, las cajas que no tienen override se
 * quedarían sin tema configurado (caerían al integrado, que no es lo que el
 * dueño quiere al borrar algo). */
export class CannotDeleteDefaultPosThemeError extends AppError {
  readonly code = 'POS_THEME_IS_DEFAULT';
  readonly httpStatus = 409;
  constructor(message = 'No se puede borrar el tema predeterminado.') { super(message); }
}

export class PosThemeInUseError extends AppError {
  readonly code = 'POS_THEME_IN_USE';
  readonly httpStatus = 409;
  constructor(public readonly assignedPointsCount: number) {
    super(
      'No se puede borrar un tema que tienen asignado uno o más puntos de emisión.',
      undefined,
      { assignedPointsCount },
    );
  }
}

/** El contraste bajo no es una manía estética: una caja con texto ilegible
 * pierde ventas. Se rechaza en el servidor (no solo avisa en el editor) porque
 * el editor es una de las formas de entrar al sistema, no la única. */
export class LowContrastPosThemeError extends AppError {
  readonly code = 'LOW_CONTRAST';
  readonly httpStatus = 422;
  constructor(public readonly pairs: ReadonlyArray<{ a: string; b: string; ratio: number; min: number }>) {
    super(
      'El contraste del tema es demasiado bajo para poder leerlo en la caja.',
      undefined,
      { pairs },
    );
  }
}

export class PosThemeTooLargeError extends AppError {
  readonly code = 'POS_THEME_TOO_LARGE';
  readonly httpStatus = 422;
  constructor(message = 'El tema supera el tamaño máximo permitido.') { super(message); }
}
