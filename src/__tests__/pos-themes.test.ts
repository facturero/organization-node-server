import { describe, it, expect } from 'vitest';
import {
  ADMIN_PERMISSIONS,
  READ_PERMISSIONS,
  asOrganization,
  createTestApp,
  jsonOf,
} from './helpers';
import { classicTheme, lowContrastTheme, oversizedTheme } from './pos-theme-fixtures';
import { Repositories } from '../domain/repositories';
import { Hono } from 'hono';
import { PosThemeConfig } from '../domain/pos-theme';

/** Lo que el listado y las respuestas de creación devuelven. El `config` solo
 * viene en el detalle, que es justo lo que se quiere: la lista no arrastra el
 * kilo de colores de cada tema. */
type ThemeSummary = {
  id: string;
  name: string;
  isDefault: boolean;
  version: number;
  assignedPointsCount: number;
};

type ResolvedTheme = {
  themeId: string | null;
  source: 'builtin' | 'default' | 'point';
  config: PosThemeConfig | null;
  etag: string;
};

type ApiError = { code: string; message: string; details?: unknown; pairs?: unknown[] };

describe('Temas del POS · HTTP', () => {
  async function seedOrgWithPosPoint(repos: Repositories, orgId = 'org-1') {
    const est = {
      id: `est-${orgId}`,
      organizationId: orgId,
      code: '001',
      name: 'Matriz',
      countryCode: 'EC',
      address: null,
      isMain: true,
      status: 'active' as const,
      toPersistence: () => est,
    };
    await repos.establishments.save(est as never);

    const point = {
      id: `ep-${orgId}`,
      establishmentId: est.id,
      organizationId: orgId,
      code: '001',
      name: 'Caja 1',
      status: 'active' as const,
      type: 'pos' as const,
      totpSecret: 'S',
      pairedAt: new Date(),
      pairedDeviceId: 'dev-1',
      posThemeId: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
      toPersistence() {
        return this;
      },
      isPaired: () => true,
      isPosTerminal: () => true,
      setPosTheme(id: string | null) {
        this.posThemeId = id;
      },
      belongsToOrganization: () => true,
    };
    await repos.emissionPoints.save(point as never);

    return { est, point: { id: point.id, establishmentId: est.id } };
  }

  function call(
    app: Hono,
    method: string,
    path: string,
    opts: {
      org?: string;
      perms?: string[];
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ) {
    return app.request(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...asOrganization(opts.org ?? 'org-1', opts.perms ?? ADMIN_PERMISSIONS),
        ...(opts.headers ?? {}),
      },
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });
  }

  /** Crea un tema y devuelve el resumen. `expect` dentro a propósito: si un test
   * necesita un tema de más, que falle aquí y no en una aserción con un id `undefined`
   * veinte líneas más abajo. */
  async function createTheme(
    app: Hono,
    name: string,
    config: PosThemeConfig = classicTheme(),
  ): Promise<ThemeSummary> {
    const res = await call(app, 'POST', '/organizations/me/pos-themes', {
      body: { name, config },
    });
    expect(res.status).toBe(201);
    return jsonOf<ThemeSummary>(res);
  }

  async function listThemes(app: Hono, org = 'org-1'): Promise<ThemeSummary[]> {
    const res = await call(app, 'GET', '/organizations/me/pos-themes', { org });
    expect(res.status).toBe(200);
    return jsonOf<ThemeSummary[]>(res);
  }

  const themeUrl = (estId: string, pointId: string) =>
    `/establishments/${estId}/billing-points/${pointId}/theme`;

  describe('ciclo de vida y predeterminado', () => {
    it('el primer tema queda como predeterminado y publica el evento a "all"', async () => {
      const { app, repos } = createTestApp();
      const theme = await createTheme(app, 'Clásico');

      expect(theme.isDefault).toBe(true);

      const events = repos.events.filter((e) => e.type === 'organization.pos_theme.changed');
      expect(events).toHaveLength(1);
      expect(events[0].payload.affectedEmissionPointIds).toBe('all');
    });

    it('el segundo tema NO se hace predeterminado ni publica evento', async () => {
      const { app, repos } = createTestApp();
      await createTheme(app, 'Clásico');
      const segundo = await createTheme(app, 'Oscuro');

      expect(segundo.isDefault).toBe(false);
      // El POS no tiene por qué enterarse de un tema que no usa. Publicar un
      // evento por cada creación sería ruido en cada caja de cada organización.
      expect(repos.events.filter((e) => e.type === 'organization.pos_theme.changed')).toHaveLength(1);
    });

    it('make-default avisa a "all" y deja un solo predeterminado', async () => {
      const { app, repos } = createTestApp();
      await createTheme(app, 'Clásico');
      const segundo = await createTheme(app, 'Oscuro');

      repos.events.length = 0;
      const res = await call(app, 'POST', `/organizations/me/pos-themes/${segundo.id}/make-default`);
      expect(res.status).toBe(200);
      expect((await jsonOf<ThemeSummary>(res)).isDefault).toBe(true);

      const list = await listThemes(app);
      expect(list.filter((t) => t.isDefault)).toHaveLength(1);
      expect(list.find((t) => t.id === segundo.id)?.isDefault).toBe(true);

      const event = repos.events[0];
      expect(event.payload.affectedEmissionPointIds).toBe('all');
      // Con "all" el gateway avisa a la sala de la organización, así que no
      // hace falta recorrer los puntos para listar devices.
      expect(event.payload.affectedDeviceIds).toEqual([]);
    });

    it('el listado cuenta cuántas cajas usan cada tema', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      await createTheme(app, 'Clásico');
      const segundo = await createTheme(app, 'Oscuro');

      await call(app, 'PUT', themeUrl(est.id, point.id), { body: { themeId: segundo.id } });

      const list = await listThemes(app);
      expect(list.find((t) => t.id === segundo.id)?.assignedPointsCount).toBe(1);
      // El predeterminado no lo está usando nadie: se aplica solo.
      expect(list.find((t) => t.isDefault)?.assignedPointsCount).toBe(0);
    });

    it('el listado NO devuelve el config, y el detalle sí', async () => {
      const { app } = createTestApp();
      const theme = await createTheme(app, 'Clásico');

      const list = await listThemes(app);
      expect((list[0] as Record<string, unknown>).config).toBeUndefined();

      const detalle = await call(app, 'GET', `/organizations/me/pos-themes/${theme.id}`);
      expect((await jsonOf<{ config: PosThemeConfig }>(detalle)).config.colors.light.primary).toBe(
        '#2563eb',
      );
    });

    it('editar sube la versión y avisa solo a las cajas con ese override', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);

      await createTheme(app, 'Clásico');
      const segundo = await createTheme(app, 'Alto contraste');
      await call(app, 'PUT', themeUrl(est.id, point.id), { body: { themeId: segundo.id } });

      repos.events.length = 0;
      const res = await call(app, 'PUT', `/organizations/me/pos-themes/${segundo.id}`, {
        body: { name: 'Alto contraste', config: classicTheme({ mode: 'dark' }) },
      });

      expect(res.status).toBe(200);
      expect((await jsonOf<ThemeSummary>(res)).version).toBe(2);

      const event = repos.events.find((e) => e.type === 'organization.pos_theme.changed');
      expect(event?.payload.affectedEmissionPointIds).toEqual([point.id]);
    });
  });

  describe('resolución para el POS', () => {
    it('sin nada configurado devuelve el tema integrado con config null', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);

      const res = await call(app, 'GET', themeUrl(est.id, point.id));
      const body = await jsonOf<ResolvedTheme>(res);

      expect(res.status).toBe(200);
      expect(body.source).toBe('builtin');
      expect(body.config).toBeNull();
      expect(body.themeId).toBeNull();
      expect(body.etag).toBe('"builtin-0"');
    });

    it('sin override cae al predeterminado de la organización', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Clásico');

      const res = await call(app, 'GET', themeUrl(est.id, point.id));
      const body = await jsonOf<ResolvedTheme>(res);

      expect(body.source).toBe('default');
      expect(body.themeId).toBe(theme.id);
      expect(body.config?.colors.light.primary).toBe('#2563eb');
    });

    it('con override la fuente es el punto, aunque sea el mismo tema que el default', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Clásico');
      const url = themeUrl(est.id, point.id);

      await call(app, 'PUT', url, { body: { themeId: theme.id } });

      const res = await call(app, 'GET', url);
      expect((await jsonOf<ResolvedTheme>(res)).source).toBe('point');
    });

    it('el ETag coincide con versión y tema, y da 304 si no ha cambiado', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Clásico');
      const url = themeUrl(est.id, point.id);

      const first = await call(app, 'GET', url);
      const etag = first.headers.get('etag');
      expect(etag).toBe(`"${theme.id}-1"`);

      const notModified = await call(app, 'GET', url, { headers: { 'If-None-Match': etag! } });
      expect(notModified.status).toBe(304);
    });

    it('guardar cambia el ETag, así que un pull tras editar devuelve 200', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Clásico');
      const url = themeUrl(est.id, point.id);

      const antes = (await call(app, 'GET', url)).headers.get('etag');
      await call(app, 'PUT', `/organizations/me/pos-themes/${theme.id}`, {
        body: { name: 'Clásico', config: classicTheme({ mode: 'schedule' }) },
      });

      const despues = await call(app, 'GET', url, { headers: { 'If-None-Match': antes! } });
      expect(despues.status).toBe(200);
      expect(despues.headers.get('etag')).toBe(`"${theme.id}-2"`);
    });

    it('un override huérfano cae al predeterminado, nunca 404', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Clásico');
      await call(app, 'PUT', themeUrl(est.id, point.id), { body: { themeId: theme.id } });

      // Se borra saltándose el endpoint (que lo impediría con un 409) para
      // provocar la red de seguridad: la caja tiene que seguir vendiendo.
      await repos.posThemes.remove(theme.id);

      const res = await call(app, 'GET', themeUrl(est.id, point.id));
      expect(res.status).toBe(200);
      expect((await jsonOf<ResolvedTheme>(res)).source).toBe('builtin');
    });
  });

  describe('aislamiento entre organizaciones', () => {
    it('el tema de otra organización es 404, nunca 403', async () => {
      const { app } = createTestApp();
      const theme = await createTheme(app, 'Secreto');

      const res = await call(app, 'GET', `/organizations/me/pos-themes/${theme.id}`, {
        org: 'org-2',
      });
      // Un 403 confirmaría que el id existe. El 404 no dice nada.
      expect(res.status).toBe(404);
      expect((await jsonOf<ApiError>(res)).code).toBe('POS_THEME_NOT_FOUND');
    });

    it('no se puede editar ni borrar el tema de otra organización', async () => {
      const { app } = createTestApp();
      const theme = await createTheme(app, 'Secreto');
      const url = `/organizations/me/pos-themes/${theme.id}`;

      // Con un body VÁLIDO: si se manda uno inválido sale un 422 antes de llegar
      // al 404, porque la validación va primero que la búsqueda. No es un
      // problema —el 422 tampoco revela que el id existe— pero el test tiene que
      // pasar por donde quiere pasar.
      const body = { name: 'mío', config: classicTheme() };
      expect((await call(app, 'PUT', url, { org: 'org-2', body })).status).toBe(404);
      expect((await call(app, 'DELETE', url, { org: 'org-2' })).status).toBe(404);
      expect((await call(app, 'POST', `${url}/make-default`, { org: 'org-2' })).status).toBe(404);
    });

    it('el listado solo muestra los temas propios', async () => {
      const { app } = createTestApp();
      await createTheme(app, 'De org-1');
      expect(await listThemes(app, 'org-2')).toEqual([]);
    });

    it('no deja asignar a una caja que no es de la organización', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos, 'org-1');
      const theme = await createTheme(app, 'Secreto');

      const res = await call(app, 'PUT', themeUrl(est.id, point.id), {
        org: 'org-2',
        body: { themeId: theme.id },
      });
      expect(res.status).toBe(404);
    });
  });

  describe('permisos', () => {
    it('leer sí, escribir no: con organization:read se puede listar pero no crear', async () => {
      const { app } = createTestApp();
      await createTheme(app, 'Clásico');

      const escritura = await call(app, 'POST', '/organizations/me/pos-themes', {
        perms: READ_PERMISSIONS,
        body: { name: 'Otro', config: classicTheme() },
      });
      expect(escritura.status).toBe(403);

      expect(await listThemes(app)).toHaveLength(1);
    });

    it('sin permiso de organización no se listan ni se resuelven', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      await createTheme(app, 'Clásico');

      expect(
        (await call(app, 'GET', '/organizations/me/pos-themes', { perms: [] })).status,
      ).toBe(403);
      // El POS necesita leer el tema para pintar la caja: va con
      // organization:read, no con permiso de escritura.
      expect(
        (await call(app, 'GET', themeUrl(est.id, point.id), { perms: READ_PERMISSIONS })).status,
      ).toBe(200);
    });
  });

  describe('validación del config', () => {
    async function post(config: unknown, name = 'X') {
      const { app } = createTestApp();
      return call(app, 'POST', '/organizations/me/pos-themes', { body: { name, config } });
    }

    async function expectRejected(config: unknown) {
      const res = await post(config);
      expect(res.status).toBe(422);
      return jsonOf<ApiError>(res);
    }

    it('rechaza un campo desconocido en la raíz: nada de CSS libre', async () => {
      const body = await expectRejected({ ...classicTheme(), css: 'body{display:none}' });
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('rechaza un campo desconocido anidado, y también una lista donde toca un objeto', async () => {
      const base = classicTheme();
      await expectRejected({ ...base, colors: [{ primary: '#2563eb' }] });
      await expectRejected({
        ...base,
        branding: { ...base.branding, colorPrimary: '#000000' },
      });
    });

    it('rechaza un color que no es #rrggbb', async () => {
      const base = classicTheme();
      for (const primary of ['rgb(1,2,3)', 'red', '#fff', '#12345', '2563eb']) {
        await expectRejected({
          ...base,
          colors: { ...base.colors, light: { ...base.colors.light, primary } },
        });
      }
    });

    it('rechaza un hex en mayúsculas: la comparación es exacta, no "casi"', async () => {
      const base = classicTheme();
      await expectRejected({
        ...base,
        colors: { ...base.colors, light: { ...base.colors.light, primary: '#2563EB' } },
      });
    });

    it('rechaza un hex con canal alfa', async () => {
      const base = classicTheme();
      await expectRejected({
        ...base,
        colors: { ...base.colors, light: { ...base.colors.light, primary: '#2563ebcc' } },
      });
    });

    it('rechaza una fuente fuera de la lista cerrada', async () => {
      const base = classicTheme();
      await expectRejected({ ...base, typography: { ...base.typography, fontFamily: 'comic-sans' } });
    });

    it('rechaza un tamaño de fuente fuera de rango', async () => {
      const base = classicTheme();
      for (const baseSize of [11, 40, 16.5]) {
        await expectRejected({ ...base, typography: { ...base.typography, baseSize } });
      }
    });

    it('rechaza un fileId de marca que no es uuid', async () => {
      const base = classicTheme();
      for (const logoFileId of ['https://ejemplo.com/logo.png', 'logo.png', '1']) {
        await expectRejected({ ...base, branding: { ...base.branding, logoFileId } });
      }
    });

    it('rechaza logoPosition y logoSize fuera de lista', async () => {
      const base = classicTheme();
      await expectRejected({ ...base, branding: { ...base.branding, logoPosition: 'centrado' } });
      await expectRejected({ ...base, branding: { ...base.branding, logoSize: 'gigante' } });
    });

    it('rechaza un fondo de tipo imagen sin imageFileId', async () => {
      const base = classicTheme();
      await expectRejected({
        ...base,
        branding: {
          ...base.branding,
          loginBackground: { type: 'image', color: null, imageFileId: null },
        },
      });
    });

    it('rechaza un schemaVersion que no es el 1', async () => {
      await expectRejected({ ...classicTheme(), schemaVersion: 2 });
    });

    it('rechaza el contraste bajo con 422 y las parejas que fallan', async () => {
      const res = await post(lowContrastTheme());
      expect(res.status).toBe(422);

      const body = await jsonOf<ApiError & { pairs: { a: string; ratio: number }[] }>(res);
      expect(body.code).toBe('LOW_CONTRAST');
      expect(body.pairs.length).toBeGreaterThan(0);
      expect(body.pairs[0].a).toBe('light.textMuted');
      expect(body.pairs[0].ratio).toBeLessThan(3);
    });

    it('un welcomeMessage enorme lo corta el esquema, no la política de tamaño', async () => {
      // El schema es cerrado y `welcomeMessage` admite 80 caracteres, así que un
      // payload gigante nunca llega a la regla de 8 KB: el usuario recibe el
      // mensaje concreto en vez de un "demasiado grande" genérico. La regla de
      // 8 KB protege para cuando el schema se afloje, y se prueba en
      // `pos-theme-policy.test.ts` saltándose el HTTP.
      const body = await expectRejected(oversizedTheme());
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(body.details)).toContain('80');
    });

    it('el nombre del tema es obligatorio y acotado', async () => {
      const { app } = createTestApp();
      expect(
        (await call(app, 'POST', '/organizations/me/pos-themes', { body: { config: classicTheme() } }))
          .status,
      ).toBe(422);
      expect(
        (
          await call(app, 'POST', '/organizations/me/pos-themes', {
            body: { name: 'x'.repeat(200), config: classicTheme() },
          })
        ).status,
      ).toBe(422);
    });
  });

  describe('asignación a una caja', () => {
    it('asigna y quita el override con themeId null', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Oscuro');
      const url = themeUrl(est.id, point.id);

      const asignado = await call(app, 'PUT', url, { body: { themeId: theme.id } });
      expect(asignado.status).toBe(200);
      expect((await jsonOf<{ posThemeId: string }>(asignado)).posThemeId).toBe(theme.id);

      const quitado = await call(app, 'PUT', url, { body: { themeId: null } });
      expect(quitado.status).toBe(200);
      expect((await jsonOf<{ posThemeId: string | null }>(quitado)).posThemeId).toBeNull();
    });

    it('asignar avisa solo a esa caja y a su socket', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Oscuro');

      repos.events.length = 0;
      await call(app, 'PUT', themeUrl(est.id, point.id), { body: { themeId: theme.id } });

      const event = repos.events.find((e) => e.type === 'organization.pos_theme.changed');
      expect(event?.payload.affectedEmissionPointIds).toEqual([point.id]);
      // El gateway enruta por deviceId, no por punto de emisión: sin esto el
      // aviso no llegaría a ningún socket.
      expect(event?.payload.affectedDeviceIds).toEqual(['dev-1']);
    });

    it('un punto sin emparejar publica la lista de devices vacía', async () => {
      const { app, repos } = createTestApp();
      const { est } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Oscuro');

      const sinPair = {
        id: 'ep-solo',
        establishmentId: est.id,
        organizationId: 'org-1',
        code: '003',
        name: 'Caja sin emparejar',
        status: 'active' as const,
        type: 'pos' as const,
        totpSecret: 'S',
        pairedAt: null,
        pairedDeviceId: null,
        posThemeId: null as string | null,
        createdAt: new Date(),
        updatedAt: new Date(),
        toPersistence() {
          return this;
        },
        isPaired: () => false,
        isPosTerminal: () => true,
        setPosTheme(id: string | null) {
          this.posThemeId = id;
        },
        belongsToOrganization: () => true,
      };
      await repos.emissionPoints.save(sinPair as never);

      repos.events.length = 0;
      await call(app, 'PUT', themeUrl(est.id, sinPair.id), { body: { themeId: theme.id } });

      const event = repos.events.find((e) => e.type === 'organization.pos_theme.changed');
      expect(event?.payload.affectedEmissionPointIds).toEqual([sinPair.id]);
      expect(event?.payload.affectedDeviceIds).toEqual([]);
    });

    it('quitar el override publica themeId null, no un id inventado', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Oscuro');
      const url = themeUrl(est.id, point.id);
      await call(app, 'PUT', url, { body: { themeId: theme.id } });

      repos.events.length = 0;
      await call(app, 'PUT', url, { body: { themeId: null } });

      const event = repos.events.find((e) => e.type === 'organization.pos_theme.changed');
      // El consumidor tiene que distinguir "ya no tiene override" de "este tema
      // cambió". Un `themeId: "default"` compilaría como string y ese error se
      // pagaría en el POS, cuando ya esté pintando con colores ajenos.
      expect(event?.payload.themeId).toBeNull();
      expect(event?.payload.affectedEmissionPointIds).toEqual([point.id]);
    });

    it('no deja asignar un tema a un punto que no es POS', async () => {
      const { app, repos } = createTestApp();
      const { est } = await seedOrgWithPosPoint(repos);
      const theme = await createTheme(app, 'Oscuro');

      const web = {
        id: 'ep-web',
        establishmentId: est.id,
        organizationId: 'org-1',
        code: '002',
        name: 'Web',
        status: 'active' as const,
        type: 'web' as const,
        totpSecret: null,
        pairedAt: null,
        pairedDeviceId: null,
        posThemeId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        toPersistence() {
          return this;
        },
        isPaired: () => false,
        isPosTerminal: () => false,
        setPosTheme() {},
        belongsToOrganization: () => true,
      };
      await repos.emissionPoints.save(web as never);

      const res = await call(app, 'PUT', themeUrl(est.id, web.id), { body: { themeId: theme.id } });
      expect(res.status).toBe(422);
      expect((await jsonOf<ApiError>(res)).code).toBe('EMISSION_POINT_NOT_POS');
    });

    it('rechaza un themeId que no es uuid antes de tocar la base', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);

      const res = await call(app, 'PUT', themeUrl(est.id, point.id), {
        body: { themeId: 'no-es-un-uuid' },
      });
      expect(res.status).toBe(422);
    });
  });

  describe('el tema visto desde el listado de cajas', () => {
    it('una caja sin override muestra el nombre del predeterminado', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      await createTheme(app, 'Clásico');

      const res = await call(app, 'GET', `/establishments/${est.id}/billing-points`);
      expect(res.status).toBe(200);

      const lista = await jsonOf<{ id: string; posThemeId: string | null; posThemeName: string | null }[]>(res);
      expect(lista[0].id).toBe(point.id);
      expect(lista[0].posThemeId).toBeNull();
      expect(lista[0].posThemeName).toBe('Clásico');
    });

    it('una caja con override muestra el suyo, no el predeterminado', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      await createTheme(app, 'Clásico');
      const segundo = await createTheme(app, 'Oscuro');
      await call(app, 'PUT', themeUrl(est.id, point.id), { body: { themeId: segundo.id } });

      const res = await call(app, 'GET', `/establishments/${est.id}/billing-points`);
      const lista = await jsonOf<{ posThemeId: string; posThemeName: string }[]>(res);
      expect(lista[0].posThemeId).toBe(segundo.id);
      expect(lista[0].posThemeName).toBe('Oscuro');
    });

    it('sin ningún tema configurado, nombre e id salen a null', async () => {
      const { app, repos } = createTestApp();
      const { est } = await seedOrgWithPosPoint(repos);

      const res = await call(app, 'GET', `/establishments/${est.id}/billing-points`);
      const lista = await jsonOf<{ posThemeId: string | null; posThemeName: string | null }[]>(res);
      expect(lista[0].posThemeId).toBeNull();
      expect(lista[0].posThemeName).toBeNull();
    });
  });

  describe('borrado', () => {
    it('borra un tema que no está en uso', async () => {
      const { app } = createTestApp();
      await createTheme(app, 'Clásico');
      const segundo = await createTheme(app, 'Oscuro');

      const res = await call(app, 'DELETE', `/organizations/me/pos-themes/${segundo.id}`);
      expect(res.status).toBe(204);
      expect(await listThemes(app)).toHaveLength(1);
    });

    it('crear y borrar un tema dejan su aviso para la bitácora (sin avisar a las cajas)', async () => {
      const { app, repos } = createTestApp();
      await createTheme(app, 'Clásico');
      const segundo = await createTheme(app, 'Oscuro');

      const creado = repos.events.filter((e) => e.type === 'organization.pos_theme.created');
      expect(creado.map((e) => e.payload.name)).toEqual(['Clásico', 'Oscuro']);
      expect(creado[1].payload).toMatchObject({ targetId: segundo.id, organizationId: 'org-1', isDefault: false });

      await call(app, 'DELETE', `/organizations/me/pos-themes/${segundo.id}`);

      const borrado = repos.events.filter((e) => e.type === 'organization.pos_theme.deleted');
      expect(borrado).toHaveLength(1);
      expect(borrado[0].payload).toMatchObject({ targetId: segundo.id, name: 'Oscuro' });
      // Las cajas escuchan `.changed`: borrar un tema que ninguna usa no debe generar ninguno nuevo.
      expect(repos.events.filter((e) => e.type === 'organization.pos_theme.changed')).toHaveLength(1);
    });

    it('un borrado rechazado no deja aviso', async () => {
      const { app, repos } = createTestApp();
      const primero = await createTheme(app, 'Clásico');
      await call(app, 'DELETE', `/organizations/me/pos-themes/${primero.id}`);
      expect(repos.events.filter((e) => e.type === 'organization.pos_theme.deleted')).toHaveLength(0);
    });

    it('no borra el predeterminado', async () => {
      const { app } = createTestApp();
      const primero = await createTheme(app, 'Clásico');

      const res = await call(app, 'DELETE', `/organizations/me/pos-themes/${primero.id}`);
      expect(res.status).toBe(409);
      expect((await jsonOf<ApiError>(res)).code).toBe('POS_THEME_IS_DEFAULT');
    });

    it('no borra un tema en uso y dice cuántas cajas lo tienen', async () => {
      const { app, repos } = createTestApp();
      const { est, point } = await seedOrgWithPosPoint(repos);
      await createTheme(app, 'Clásico');
      const segundo = await createTheme(app, 'Oscuro');
      await call(app, 'PUT', themeUrl(est.id, point.id), { body: { themeId: segundo.id } });

      const res = await call(app, 'DELETE', `/organizations/me/pos-themes/${segundo.id}`);
      expect(res.status).toBe(409);

      const body = await jsonOf<ApiError & { assignedPointsCount: number }>(res);
      expect(body.code).toBe('POS_THEME_IN_USE');
      expect(body.assignedPointsCount).toBe(1);
    });

    // El "solo un predeterminado por organización" bajo concurrencia no se prueba
    // aquí a propósito: el repositorio en memoria no serializa, así que un test
    // de carrera sobre él no probaría nada real. Lo que lo garantiza es que
    // `make-default` baja el flag del anterior y sube el nuevo dentro de la
    // MISMA transacción (ver `MakeDefaultPosThemeUseCase` y el
    // `SELECT ... FOR UPDATE` de `PosThemeRepository`); probarlo de verdad
    // necesita MySQL.
  });
});
