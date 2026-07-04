export interface ErrorDetail {
  field: string;
  message: string;
}

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly details?: ErrorDetail[];

  constructor(message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.details = details;
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
