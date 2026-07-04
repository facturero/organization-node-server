# organization-service — Guía de implementación (para opencode)

> **Objetivo.** Construir `organization-service`: dueño del **perfil fiscal y la estructura** de la organización (datos fiscales, establecimientos, puntos de emisión). Node + TS + Hono + Sequelize, **misma plantilla que `../auth-service/`**.
>
> **Opción A (clave):** la organización **ya existe** cuando este servicio la toca. `auth-service` genera el `organization_id` y crea al fundador (usuario + rol Administrador) al **registrarse**. Este servicio **NO crea** la organización ni siembra roles: es dueño de su **perfil**, identificado por el `organization_id` que llega en `X-Organization-Id`. El "alta" aquí es **`PUT /organizations/me`** (completar el perfil de una org que ya existe), no un `POST` que genere otra.
>
> **Contrato:** `openapi.yaml` (REST) y `asyncapi.yaml` (eventos) en esta carpeta son la **fuente de verdad** de endpoints y eventos. Impleméntalos tal cual.

## Reglas de oro

1. **Imita `../auth-service/` archivo por archivo:** entidades (constructor privado + factories + `fromPersistence`/`toPersistence`), errores (`AppError` con `code`/`httpStatus`/`details`, los casos de uso **lanzan**), repos (interfaz en `domain/`, impl Sequelize factory `(tx?)`, `save`=upsert, agregado `Repositories` + `UnitOfWork`), modelos (`timestamps:false`, `underscored:true`, `CHAR(36)`), controladores factory + `validateJson`, wiring **solo** en `main.ts`.
2. **Base propia `organization_db`.** Referencias a otros servicios por **ID** (nunca FK/JOIN cruzado). El único dato externo cacheado es el read-model `countries` (de tax-service).
3. **NO verifica JWT.** Confía en las cabeceras del gateway: `X-Organization-Id`, `X-User-Id`, `X-Country-Code`, `X-Permissions`. Todas las rutas salvo `/health` exigen `X-Organization-Id`.
4. **Aislamiento por `organization_id` en TODA query.** Operar sobre un recurso de otra organización → `404` (no revela cross-org, no `403`).
5. **Eventos vía Outbox** (misma transacción). Namespace `organization.*`. El **relay a RabbitMQ es infra compartida, pendiente** (igual que en auth): por ahora los eventos quedan en `outbox_messages`. No implementes el relay ni consumers salvo que se pida.
6. **No emitas `organization.org.created`** (auth ya creó la org). Este servicio emite `org.updated` / `establishment.created` / `billing_point.created`.
7. Tras cada fase: `npm run typecheck` y `npm test` verdes. Commits por fase.

## Fase 1 — Bootstrap

Clona de `../auth-service/`: `tsconfig.json`, `.sequelizerc`, `sequelize.config.cjs`, `.gitignore`, `Dockerfile` (sin `certs/`). `package.json`: mismas deps **menos** JWT/OAuth/argon2. Necesita: `hono`, `@hono/node-server`, `@hono/zod-validator`, `zod`, `sequelize`, `mysql2`, `dotenv`. Dev: `typescript`, `tsx`, `vitest`, `sequelize-cli`, `@types/node`. Scripts idénticos (`dev`, `build`, `start`, `typecheck`, `test`, `db:migrate`, `db:migrate:undo`).

`.env.example`:
```
NODE_ENV=development
PORT=3002
DB_HOST=localhost
DB_PORT=3306
DB_USER=org_user
DB_PASSWORD=secret
DB_NAME=organization_db
CORS_ORIGIN=http://localhost:5173
```

Estructura (layer-first, como auth): `src/{domain,application/use-cases,infrastructure/persistence,interface/http,shared,__tests__}` + `migrations/`.

- [ ] `npm install && npm run typecheck` OK sobre proyecto vacío.

## Fase 2 — Migración

Crea `migrations/<ts>-create-organization-tables.js`. Tablas (id de la org = el `organization_id` compartido con auth; campos fiscales **nullables** hasta completar):

- **`organizations`**: `id` PK (CHAR36), `legal_name?`, `trade_name?`, `tax_id?`, `country_code?`, `status` ENUM(active,suspended) def active, `settings?` JSON, `created_at`, `updated_at`. Único `(country_code, tax_id)`.
- **`establishments`**: `id` PK, `organization_id` FK→organizations onDelete CASCADE, `code`, `name`, `country_code`, `address?`, `is_main` bool def false, `status` ENUM(active,inactive), timestamps. Único `(organization_id, code)`.
- **`emission_points`**: `id` PK, `establishment_id` FK→establishments CASCADE, `organization_id` (denormalizado), `code`, `name?`, `status`, timestamps. Único `(establishment_id, code)`.
- **`organization_countries`**: `id` PK, `organization_id` FK, `country_code`, `enabled` bool. Único `(organization_id, country_code)`.
- **`countries`** (read-model): `code` PK, `name?`, `currency_code?`, `enabled` bool, `updated_at`.
- **`outbox_messages`**: `id` PK, `aggregate_type`, `aggregate_id`, `type`, `payload` JSON, `occurred_at`, `processed_at?`. Índice en `processed_at`.
- **`processed_events`**: `event_id` PK, `processed_at`.

Segunda migración `seed-countries.js`: `bulkInsert` idempotente de `EC` (`enabled:true`, `currency_code:'USD'`) para poder probar sin tax-service.

- [ ] `npm run db:migrate` limpio; `db:migrate:undo` revierte (orden inverso hijos→padres).

## Fase 3 — Dominio (`src/domain/`)

- **`value-objects.ts`**: `CountryCode` (ISO alpha-2 mayúsculas, regex `^[A-Z]{2}$`); `TaxId.create(countryCode, value)` con validación por país (EC=13 díg, PE=11, CO=9-10, MX=RFC), lanza `InvalidTaxIdError` (dígito verificador = fase 2, deja formato).
- **`entities.ts`**: `Organization` (props `id, legalName|null, tradeName|null, taxId|null, countryCode|null, status, settings|null, timestamps`; `static create({id, ...})` **con id obligatorio** — NO se genera aquí; `updateProfile(...)`, `isProfileComplete()` = tax_id && country_code). `Establishment` (`static create` genera id; `update(...)`). `EmissionPoint` (`static create`). `OrganizationCountry`.
- **`errors.ts`**: `AppError` + `ValidationError(422)`, `OrganizationContextRequiredError(401)`, `UserContextRequiredError(401)`, `ForbiddenError(403)`, `OrganizationNotFoundError(404)`, `EstablishmentNotFoundError(404)`, `InvalidCountryCodeError(422)`, `CountryNotEnabledError(422)`, `InvalidTaxIdError(422)`, `TaxIdAlreadyExistsError(409)`, `CannotDeactivateMainError(422)`.
- **`repositories.ts`**: interfaces `OrganizationRepository` (findById, findByTaxId, save), `EstablishmentRepository` (findById, listByOrganization, `nextCode(organizationId)`, save), `EmissionPointRepository` (listByEstablishment, `nextCode(establishmentId)`, save), `OrganizationCountryRepository` (listByOrganization, find, save), `CountryReadModelRepository` (isEnabled, upsert), `OutboxRepository` (add). `DomainEvent {type, aggregateType, aggregateId, payload, occurredAt}`. Agregado `Repositories`.

- [ ] `typecheck` OK.

## Fase 4 — Persistencia (`src/infrastructure/persistence/`)

`sequelize.ts` (clona auth). `models.ts`: un modelo por tabla (`timestamps:false`, `underscored:true`), asociaciones `Organization.hasMany(Establishment)`, etc. `repositories.ts`: mappers modelo→dominio, factories `(tx?)`, `buildRepositories(tx?)`, `SequelizeUnitOfWork` (= `sequelize.transaction(tx => work(buildRepositories(tx)))`).

Detalle crítico — `nextCode` correlativo con lock:
```ts
async nextCode(organizationId) {
  const rows = await EstablishmentModel.findAll({
    where: { organization_id: organizationId }, attributes: ['code'],
    transaction: tx, lock: tx ? tx.LOCK.UPDATE : undefined,
  });
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.code, 10) || 0), 0);
  return String(max + 1).padStart(3, '0');
}
```
`OrganizationRepository.save` = `OrganizationModel.upsert(...)` (el id ya viene dado). `countries.isEnabled` = `SELECT enabled FROM countries WHERE code=?`.

- [ ] `typecheck` OK.

## Fase 5 — Casos de uso (`src/application/use-cases/`)

`ports.ts`: `UnitOfWork`. `dtos.ts`: DTOs + mappers (incluye `completed: org.isProfileComplete()` en `OrganizationDTO`).

**`UpsertOrganizationProfileUseCase` (el central)** — `execute({ organizationId, legalName, tradeName?, taxId, countryCode })`:
1. Valida `CountryCode` + `TaxId` (por país).
2. En `uow`: `countries.isEnabled` → si no, `CountryNotEnabledError`. `findByTaxId`; si existe y `id !== organizationId` → `TaxIdAlreadyExistsError`.
3. `findById(organizationId)`: si existe → `updateProfile(...)`; si no → `Organization.create({ id: organizationId, ... })`. `save`.
4. Si `establishments.listByOrganization(orgId).length === 0` (primera vez): crea `Establishment 001` (isMain, name 'Matriz', countryCode) + `EmissionPoint 001`; emite `organization.establishment.created` + `organization.billing_point.created`.
5. Siempre emite `organization.org.updated { organizationId, legalName, tradeName, countryCode }`.
6. Devuelve `OrganizationDTO`.

Resto: `GetMyOrganizationUseCase(organizationId)` → DTO o placeholder `{id, completed:false}` si no hay fila. `UpdateOrganizationUseCase` (nombre/settings + `org.updated`). `ListEstablishmentsUseCase`. `CreateEstablishmentUseCase` (`nextCode` + `establishment.created`; countryCode por defecto = el de la org). `UpdateEstablishmentUseCase` (valida pertenencia; `CannotDeactivateMainError` si desactiva matriz). `ListEmissionPointsUseCase` (valida pertenencia del establecimiento). `CreateEmissionPointUseCase` (`nextCode` + `billing_point.created`). `ListOrganizationCountriesUseCase`. `AddOrganizationCountryUseCase` (valida país habilitado).

> Regla de pertenencia obligatoria: todo acceso a un `establishment`/`emission_point` verifica `organization_id === contexto` → si no, `EstablishmentNotFoundError` (404).

- [ ] Casos de uso implementados.

## Fase 6 — HTTP (`src/interface/http/`)

- **`middlewares.ts`**: `contextMiddleware` (lee `X-Organization-Id`/`X-User-Id`/`X-Country-Code`/`X-Permissions` CSV → `ContextVariables`), `requireOrganization` (401 si falta orgId), `requirePermission(perm)` (403 si no está en `permissions`), `errorHandler` (AppError → `{code,message,details?}`; resto → 500).
- **`validators.ts`**: Zod + `validateJson`. Schemas: `upsertOrganizationSchema {legalName, tradeName?, taxId, countryCode}`, `updateOrganizationSchema`, `createEstablishmentSchema`, `updateEstablishmentSchema`, `createEmissionPointSchema`, `addCountrySchema`.
- **`controllers.ts`**: factories; `organizationId` del contexto (`c.get('organizationId')`), no del body.
- **`routes.ts` + `app.ts`**: monta rutas **exactamente** como `openapi.yaml`. Cada ruta = `requireOrganization` + `requirePermission('...')` + (validador) + controlador. CORS `allowMethods` GET/POST/PUT/PATCH/DELETE/OPTIONS + `allowHeaders` con las `X-*`. `contextMiddleware` global. `onError(errorHandler)`, `notFound` → 404.

- [ ] Rutas montadas según `openapi.yaml`.

## Fase 7 — Composition root (`src/main.ts`)

`sequelize.authenticate()`, importa modelos, `buildRepositories()` (lecturas) + `SequelizeUnitOfWork` (escrituras), instancia todos los casos de uso, `createApp({useCases, corsOrigin})`, `serve({fetch, port: config.PORT})`. Config con Zod (sin claves JWT).

- [ ] `npm run build` OK; `GET /health` responde.

## Fase 8 — Tests (`src/__tests__/`)

Vitest con repos fake en memoria (sin DB). Cubrir: `UpsertOrganizationProfile` (aprovisiona 001/001 + emite los 3 eventos; **no** emite `org.created`; no re-aprovisiona en 2.ª llamada; rechaza país no habilitado / RUC inválido / RUC duplicado); `CreateEstablishment` numera `002` tras la matriz; pertenencia cross-org → 404.

- [ ] `npm test` verde.

## Definición de "hecho"

1. `db:migrate` crea las 7 tablas + habilita EC.
2. `PUT /organizations/me` (con `X-Organization-Id`) fija el perfil, aprovisiona establecimiento 001 + punto 001 la 1.ª vez, y escribe en `outbox_messages` `org.updated` + `establishment.created` + `billing_point.created` (**nunca** `org.created`).
3. `GET /organizations/me` devuelve el perfil o `completed:false`.
4. `POST /establishments` numera `002`, `003`…
5. Recurso de otra org → `404`; sin permiso → `403`; sin `X-Organization-Id` → `401`.
6. Validación de país habilitado + formato de RUC; RUC duplicado en el país → `409`.
7. `npm test` + `npm run build` OK. `openapi.yaml` y `asyncapi.yaml` implementados fielmente.

## Fuera de alcance (no hacer)

- Relay de Outbox + consumers de RabbitMQ (infra compartida; los eventos quedan en la tabla).
- El consumer de auth para `organization.org.updated` (vive en auth).
- Nivel `tenant`/grupo (evolución futura). Dígito verificador completo de RUC/NIT/RFC.
