#!/usr/bin/env node
// Écrit src/core/db/database.types.ts au format de `supabase gen types typescript`,
// à partir du catalogue JSON produit par scripts/gen-types.sql (lancé par db-test.sh
// quand TYPES_OUT est défini). Les types utilitaires du bas du fichier (Tables,
// TablesInsert…) sont repris tels quels du fichier existant.
//
//   node scripts/gen-types.mjs catalogue.json src/core/db/database.types.ts
import { readFileSync, writeFileSync } from 'node:fs'

const [catalogPath, outPath] = process.argv.slice(2)
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const previous = readFileSync(outPath, 'utf8')
const helpers = previous.slice(previous.indexOf('type DefaultSchema'), previous.indexOf('export const Constants'))

const STRING = new Set(['uuid', 'text', 'varchar', 'bpchar', 'char', 'date', 'time', 'timetz', 'timestamp', 'timestamptz', 'interval', 'citext', 'bytea', 'inet'])
const NUMBER = new Set(['int2', 'int4', 'int8', 'numeric', 'float4', 'float8', 'oid'])

function tsType({ udt, typtype }, elem) {
  if (elem) return `${tsType(elem)}[]`
  if (typtype === 'e') return `Database["public"]["Enums"]["${udt}"]`
  if (STRING.has(udt)) return 'string'
  if (NUMBER.has(udt)) return 'number'
  if (udt === 'bool') return 'boolean'
  if (udt === 'json' || udt === 'jsonb') return 'Json'
  if (udt === 'void') return 'undefined'
  return 'unknown'
}

const pad = (n) => ' '.repeat(n)
const lines = []
const out = (indent, text) => lines.push(pad(indent) + text)

function columns(label, cols, mode) {
  out(8, `${label}: {`)
  for (const c of cols) {
    const type = tsType(c, c.elem) + (c.nullable ? ' | null' : '')
    if (mode === 'row') out(10, `${c.name}: ${type}`)
    else if (mode === 'insert') {
      if (c.generated) out(10, `${c.name}?: never`)
      else out(10, `${c.name}${c.nullable || c.hasDefault ? '?' : ''}: ${type}`)
    } else out(10, `${c.name}?: ${c.generated ? 'never' : type}`)
  }
  out(8, '}')
}

function relationships(fks) {
  if (fks.length === 0) return out(8, 'Relationships: []')
  out(8, 'Relationships: [')
  for (const fk of fks) {
    out(10, '{')
    out(12, `foreignKeyName: "${fk.name}"`)
    out(12, `columns: [${fk.columns.map((c) => `"${c}"`).join(', ')}]`)
    out(12, `isOneToOne: ${fk.oneToOne}`)
    out(12, `referencedRelation: "${fk.refTable}"`)
    out(12, `referencedColumns: [${fk.refColumns.map((c) => `"${c}"`).join(', ')}]`)
    out(10, '},')
  }
  out(8, ']')
}

function section(label, rows, write) {
  if (rows.length === 0) {
    out(4, `${label}: {`)
    out(6, '[_ in never]: never')
    return out(4, '}')
  }
  out(4, `${label}: {`)
  for (const row of rows) write(row)
  out(4, '}')
}

out(0, '// Types de la base OhO, au format de `supabase gen types typescript`.')
out(0, '// Générés par `npm run db:types` (scripts/gen-types.mjs) depuis le catalogue du')
out(0, '// Postgres de test après application des migrations : ne pas modifier à la main.')
out(0, '')
out(0, 'export type Json =')
for (const t of ['string', 'number', 'boolean', 'null', '{ [key: string]: Json | undefined }', 'Json[]']) out(2, `| ${t}`)
out(0, '')
out(0, 'export type Database = {')
out(2, 'public: {')
section('Tables', catalog.tables.filter((t) => t.kind === 'r'), (t) => {
  out(6, `${t.name}: {`)
  columns('Row', t.columns, 'row')
  columns('Insert', t.columns, 'insert')
  columns('Update', t.columns, 'update')
  relationships(t.fks)
  out(6, '}')
})
section('Views', catalog.tables.filter((t) => t.kind === 'v'), (t) => {
  out(6, `${t.name}: {`)
  columns('Row', t.columns.map((c) => ({ ...c, nullable: true })), 'row')
  relationships(t.fks)
  out(6, '}')
})
section('Functions', catalog.functions, (f) => {
  const inputs = f.argNames
    .map((name, i) => ({ name, mode: f.argModes[i] ?? 'i', type: f.argTypes[i] }))
    .filter((a) => a.mode === 'i' || a.mode === 'b')
  const firstOptional = inputs.length - f.defaults
  const args = inputs.length === 0
    ? 'never'
    : `{ ${inputs.map((a, i) => `${a.name}${i >= firstOptional ? '?' : ''}: ${tsType(a.type)}`).join('; ')} }`
  const returns = tsType(f.returns) + (f.setof ? '[]' : '')
  out(6, `${f.name}: { Args: ${args}; Returns: ${returns} }`)
})
section('Enums', Object.keys(catalog.enums).sort(), (name) =>
  out(6, `${name}: ${catalog.enums[name].map((v) => `"${v}"`).join(' | ')}`),
)
out(4, 'CompositeTypes: {')
out(6, '[_ in never]: never')
out(4, '}')
out(2, '}')
out(0, '}')
out(0, '')

let text = lines.join('\n') + '\n' + helpers + 'export const Constants = {\n  public: {\n    Enums: {\n'
for (const name of Object.keys(catalog.enums).sort()) {
  text += `      ${name}: [${catalog.enums[name].map((v) => `"${v}"`).join(', ')}],\n`
}
text += '    },\n  },\n} as const\n'
writeFileSync(outPath, text)
console.log(`types écrits : ${outPath} (${catalog.tables.length} tables et vues, ${catalog.functions.length} fonctions)`)
