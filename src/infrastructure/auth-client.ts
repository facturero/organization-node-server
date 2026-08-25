import { randomUUID } from 'node:crypto';
import { ProvisionedServiceAccount, ServiceAccountProvisioner } from '../application/ports';
import { ServiceProvisioningError } from '../domain/errors';

export class HttpServiceAccountProvisioner implements ServiceAccountProvisioner {
  constructor(
    private readonly authServiceUrl: string,
    private readonly internalSecret: string,
  ) {}

  async provisionForOrganization(params: {
    organizationId: string;
    emissionPointId: string;
    deviceId: string;
  }): Promise<ProvisionedServiceAccount> {
    // Identidad de dispositivo (pos_devices): NO crea un usuario humano en
    // auth-service. Idempotente por deviceId (el id del pos_device ES el
    // deviceId del terminal).
    let res: Response;
    try {
      res = await fetch(`${this.authServiceUrl}/internal/device-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': this.internalSecret,
        },
        body: JSON.stringify({
          organizationId: params.organizationId,
          emissionPointId: params.emissionPointId,
          deviceId: params.deviceId,
          label: `POS terminal ${params.emissionPointId}`,
          requestId: randomUUID(),
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new ServiceProvisioningError(
        `No se pudo contactar a auth-service: ${err instanceof Error ? err.message : 'error de red'}`,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ServiceProvisioningError(`auth-service respondió ${res.status}: ${body}`);
    }

    const data = (await res.json()) as ProvisionedServiceAccount;
    return data;
  }
}
