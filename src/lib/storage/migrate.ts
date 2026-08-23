/** Migração para trás do JSON do projeto (§10). Cada entrada leva a versão n
 *  para n+1; a cadeia roda em sequência até alcançar SCHEMA_VERSION. Abrir um
 *  arquivo antigo nunca pode falhar em silêncio. */

import { SCHEMA_VERSION } from '../model/types';

type Doc = Record<string, unknown>;

const migrations: Record<number, (doc: Doc) => Doc> = {
  // 1: esquema inicial. A primeira migração real entra como `1: (doc) => ...`.
};

export function migrate(doc: Doc): Doc {
  const meta = doc['meta'] as { version?: unknown } | undefined;
  let version = typeof meta?.version === 'number' ? meta.version : 1;
  let current = doc;
  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new Error(`Sem migração da versão ${version} para ${version + 1}.`);
    current = step(current);
    version += 1;
  }
  if (version > SCHEMA_VERSION) {
    throw new Error(`Arquivo da versão ${version}; este MOIRA lê até a ${SCHEMA_VERSION}.`);
  }
  return current;
}
