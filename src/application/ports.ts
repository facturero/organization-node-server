import { Repositories } from '../domain/repositories';

export interface UnitOfWork {
  execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}

export interface ProvisionedServiceAccount {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
}

/**
 * Aprovisiona (o reutiliza) la identidad de dispositivo de un terminal POS
 * recién emparejado en auth-service, y devuelve tokens listos para usar.
 * NO crea un usuario humano: auth-service registra el dispositivo en
 * `pos_devices` y emite tokens de dispositivo. Implementado en infraestructura
 * como una llamada HTTP interna a auth-service, protegida por un secreto
 * compartido (INTERNAL_SERVICE_SECRET) — nunca pasa por el flujo público de
 * login.
 */
export interface ServiceAccountProvisioner {
  provisionForOrganization(params: {
    organizationId: string;
    emissionPointId: string;
    deviceId: string;
  }): Promise<ProvisionedServiceAccount>;
}
