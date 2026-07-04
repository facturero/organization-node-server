import { InvalidCountryCodeError, InvalidTaxIdError } from './errors';

const COUNTRY_CODE_RE = /^[A-Z]{2}$/;

export class CountryCode {
  private constructor(public readonly value: string) {}

  static create(raw: string): CountryCode {
    const code = raw.trim().toUpperCase();
    if (!COUNTRY_CODE_RE.test(code)) {
      throw new InvalidCountryCodeError('El código de país debe ser ISO alpha-2 (2 letras mayúsculas).');
    }
    return new CountryCode(code);
  }

  equals(other: CountryCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

export class TaxId {
  private constructor(public readonly value: string, public readonly countryCode: string) {}

  static create(countryCode: CountryCode, raw: string): TaxId {
    const value = raw.trim();
    switch (countryCode.value) {
      case 'EC': {
        if (!/^\d{13}$/.test(value)) {
          throw new InvalidTaxIdError('El RUC de Ecuador debe tener 13 dígitos.');
        }
        break;
      }
      case 'PE': {
        if (!/^\d{11}$/.test(value)) {
          throw new InvalidTaxIdError('El RUC de Perú debe tener 11 dígitos.');
        }
        break;
      }
      case 'CO': {
        if (!/^\d{9,10}$/.test(value)) {
          throw new InvalidTaxIdError('El NIT de Colombia debe tener 9 o 10 dígitos.');
        }
        break;
      }
      case 'MX': {
        if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(value)) {
          throw new InvalidTaxIdError('El RFC de México no tiene un formato válido.');
        }
        break;
      }
      default: {
        if (value.length === 0 || value.length > 20) {
          throw new InvalidTaxIdError('El RUC/RFC/NIT debe tener entre 1 y 20 caracteres.');
        }
        break;
      }
    }
    return new TaxId(value, countryCode.value);
  }

  toString(): string {
    return this.value;
  }
}
