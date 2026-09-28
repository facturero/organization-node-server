// Verifica que todo `$ref` de un contrato apunte a algo que existe. Un contrato
// con una ref rota no falla al construirse: falla cuando alguien lo lee.
//
//   npx js-yaml openapi.yaml  | node scripts/check-openapi-refs.mjs openapi
//   npx js-yaml asyncapi.yaml | node scripts/check-openapi-refs.mjs asyncapi
//
// Se lee JSON de stdin y no el YAML para no meter `js-yaml` en las dependencias
// del servicio: esto es una comprobación puntual, no parte del runtime.
import process from 'node:process';

const cual = process.argv[2] ?? 'openapi';

let entrada = '';
for await (const trozo of process.stdin) entrada += trozo;
if (!entrada.trim()) {
  console.error(`vacío: ejecuta  npx js-yaml ${cual}.yaml | node scripts/check-openapi-refs.mjs ${cual}`);
  process.exit(2);
}

const doc = JSON.parse(entrada);

const rotas = [];
const vistas = new Set();

function resolver(ref) {
  if (vistas.has(ref)) return true;
  vistas.add(ref);
  if (!ref.startsWith('#/')) return null;
  let actual = doc;
  for (const parte of ref.slice(2).split('/')) {
    const clave = decodeURIComponent(parte.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (actual === undefined || actual === null || !(clave in actual)) {
      rotas.push(ref);
      return null;
    }
    actual = actual[clave];
  }
  return actual;
}

function recorrer(nodo, ruta) {
  if (Array.isArray(nodo)) {
    nodo.forEach((n, i) => recorrer(n, `${ruta}[${i}]`));
    return;
  }
  if (nodo && typeof nodo === 'object') {
    for (const [k, v] of Object.entries(nodo)) {
      if (k === '$ref' && typeof v === 'string') {
        const r = resolver(v);
        if (r === null) rotas.push(`${v} (usada en ${ruta})`);
        else recorrer(r, v);
      } else {
        recorrer(v, `${ruta}.${k}`);
      }
    }
  }
}

recorrer(doc, '$');

// Operaciones sin `x-required-permission`, que es el convenio del repo: la
// fuente de verdad de los permisos es el middleware, pero el contrato lo dice
// para quien lo lea sin el código. Solo tiene sentido en el openapi.
const sinPermiso = [];
if (cual === 'openapi') {
  for (const [ruta, ops] of Object.entries(doc.paths)) {
    for (const [metodo, op] of Object.entries(ops)) {
      if (metodo === 'parameters') continue;
      if (!op['x-required-permission']) sinPermiso.push(`${metodo.toUpperCase()} ${ruta}`);
    }
  }
}

console.log(`refs rotas: ${rotas.length}`);
rotas.forEach((r) => console.log('  ' + r));
console.log(`operaciones sin x-required-permission: ${sinPermiso.length}`);
sinPermiso.forEach((r) => console.log('  ' + r));
process.exit(rotas.length ? 1 : 0);
