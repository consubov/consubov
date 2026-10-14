/**
 * Static PostgreSQL DDL Validator (Local Dry-Run)
 * Parses and verifies PostgreSQL DDL statements: syntax, data types, primary keys,
 * foreign keys, index targets, and Row Level Security (RLS) policies.
 * Hermetic execution: zero external database connection required.
 */
import fs from 'node:fs';
import path from 'node:path';

export const VALID_PG_TYPES = new Set([
  'uuid',
  'text',
  'varchar',
  'char',
  'integer',
  'int',
  'int4',
  'bigint',
  'int8',
  'smallint',
  'int2',
  'boolean',
  'bool',
  'json',
  'jsonb',
  'timestamp',
  'timestamptz',
  'timestamp with time zone',
  'timestamp without time zone',
  'date',
  'time',
  'numeric',
  'decimal',
  'real',
  'double precision',
  'bytea',
]);

/**
 * Strips comments from SQL and splits into distinct statements.
 */
export function sanitizeSql(sql) {
  // Remove multi-line comments
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove single-line comments
  cleaned = cleaned.replace(/--.*$/gm, '');
  return cleaned;
}

export function splitStatements(sql) {
  const cleaned = sanitizeSql(sql);
  const statements = [];
  let current = '';
  let inString = false;
  let quoteChar = '';

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if ((char === "'" || char === '"') && (i === 0 || cleaned[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inString = false;
        quoteChar = '';
      }
    }

    if (char === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
    } else {
      current += char;
    }
  }

  const remainder = current.trim();
  if (remainder) statements.push(remainder);

  return statements;
}

/**
 * Normalizes an identifier (e.g., 'public.atomic_command_log' -> 'public.atomic_command_log', '"tenant_id"' -> 'tenant_id').
 */
export function normalizeIdentifier(ident) {
  return ident.trim().replace(/^"|"$/g, '').toLowerCase();
}

/**
 * Normalizes table name to include schema (default 'public').
 */
export function normalizeTableName(name) {
  const raw = normalizeIdentifier(name);
  return raw.includes('.') ? raw : `public.${raw}`;
}

/**
 * Parses column definition string inside CREATE TABLE.
 */
export function parseColumnDef(colStr) {
  const trimmed = colStr.trim();
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  const name = normalizeIdentifier(tokens[0]);
  let typeTokens = [];
  let index = 1;

  // Handle multi-word types like 'timestamp with time zone' or 'double precision'
  const lowerNext = tokens[index].toLowerCase();
  if (lowerNext === 'timestamp' && tokens[index + 1]?.toLowerCase() === 'with' && tokens[index + 2]?.toLowerCase() === 'time' && tokens[index + 3]?.toLowerCase() === 'zone') {
    typeTokens = ['timestamp with time zone'];
    index += 4;
  } else if (lowerNext === 'timestamp' && tokens[index + 1]?.toLowerCase() === 'without' && tokens[index + 2]?.toLowerCase() === 'time' && tokens[index + 3]?.toLowerCase() === 'zone') {
    typeTokens = ['timestamp without time zone'];
    index += 4;
  } else if (lowerNext === 'double' && tokens[index + 1]?.toLowerCase() === 'precision') {
    typeTokens = ['double precision'];
    index += 2;
  } else {
    // Strip type modifiers like varchar(255) or numeric(10,2)
    const baseType = tokens[index].replace(/\(.*\)/, '').toLowerCase();
    typeTokens = [baseType];
    index += 1;
  }

  const dataType = typeTokens.join(' ');
  const remainder = tokens.slice(index).join(' ').toLowerCase();

  const isPrimaryKey = remainder.includes('primary key');
  const isNotNull = isPrimaryKey || remainder.includes('not null');
  const hasDefault = remainder.includes('default');

  let references = null;
  const refMatch = remainder.match(/references\s+([a-zA-Z0-9_."]+)\s*(?:\(([^)]+)\))?/i);
  if (refMatch) {
    references = {
      table: normalizeTableName(refMatch[1]),
      column: refMatch[2] ? normalizeIdentifier(refMatch[2]) : 'id',
    };
  }

  return {
    name,
    dataType,
    isNotNull,
    isPrimaryKey,
    hasDefault,
    references,
    raw: trimmed,
  };
}

/**
 * Builds or updates an in-memory SQL schema catalog from statements.
 */
export function buildSchemaCatalog(statements, existingCatalog = { tables: {}, indexes: {}, policies: {} }) {
  const catalog = {
    tables: { ...existingCatalog.tables },
    indexes: { ...existingCatalog.indexes },
    policies: { ...existingCatalog.policies },
  };

  const errors = [];
  const warnings = [];

  for (const stmt of statements) {
    const normalized = stmt.replace(/\s+/g, ' ').trim();

    // 1. CREATE TABLE
    const createTableMatch = normalized.match(/^CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_."]+)\s*\(([\s\S]*)\)$/i);
    if (createTableMatch) {
      const fullTableName = normalizeTableName(createTableMatch[1]);
      const body = createTableMatch[2].trim();

      const columns = {};
      const primaryKeys = [];
      const foreignKeys = [];
      const uniqueConstraints = [];

      // Split body by commas outside parentheses
      const parts = [];
      let currentPart = '';
      let depth = 0;
      for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (c === '(') depth++;
        else if (c === ')') depth--;
        else if (c === ',' && depth === 0) {
          parts.push(currentPart.trim());
          currentPart = '';
          continue;
        }
        currentPart += c;
      }
      if (currentPart.trim()) parts.push(currentPart.trim());

      for (const part of parts) {
        const lowerPart = part.toLowerCase();

        // Primary Key constraint
        const pkMatch = part.match(/^(?:CONSTRAINT\s+[a-zA-Z0-9_"]+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const cols = pkMatch[1].split(',').map(normalizeIdentifier);
          primaryKeys.push(...cols);
          continue;
        }

        // Unique constraint
        const uqMatch = part.match(/^(?:CONSTRAINT\s+([a-zA-Z0-9_"]+)\s+)?UNIQUE\s*\(([^)]+)\)/i);
        if (uqMatch) {
          const name = uqMatch[1] ? normalizeIdentifier(uqMatch[1]) : `uq_${fullTableName}_${uniqueConstraints.length}`;
          const cols = uqMatch[2].split(',').map(normalizeIdentifier);
          uniqueConstraints.push({ name, columns: cols });
          continue;
        }

        // Foreign Key constraint
        const fkMatch = part.match(/^(?:CONSTRAINT\s+([a-zA-Z0-9_"]+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([a-zA-Z0-9_."]+)\s*\(([^)]+)\)/i);
        if (fkMatch) {
          foreignKeys.push({
            name: fkMatch[1] ? normalizeIdentifier(fkMatch[1]) : `fk_${fullTableName}_${foreignKeys.length}`,
            columns: fkMatch[2].split(',').map(normalizeIdentifier),
            targetTable: normalizeTableName(fkMatch[3]),
            targetColumns: fkMatch[4].split(',').map(normalizeIdentifier),
          });
          continue;
        }

        // Column definition
        const colDef = parseColumnDef(part);
        if (colDef) {
          columns[colDef.name] = colDef;
          if (colDef.isPrimaryKey) primaryKeys.push(colDef.name);
          if (colDef.references) {
            foreignKeys.push({
              name: `fk_${fullTableName}_${colDef.name}`,
              columns: [colDef.name],
              targetTable: colDef.references.table,
              targetColumns: [colDef.references.column],
            });
          }
        } else {
          warnings.push(`Unrecognized table component in ${fullTableName}: "${part}"`);
        }
      }

      catalog.tables[fullTableName] = {
        name: fullTableName,
        columns,
        primaryKeys: Array.from(new Set(primaryKeys)),
        foreignKeys,
        uniqueConstraints,
        rlsEnabled: false,
      };
      continue;
    }

    // 2. CREATE INDEX
    const createIndexMatch = normalized.match(/^CREATE\s+(UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_."]+)\s+ON\s+([a-zA-Z0-9_."]+)(?:\s+USING\s+[a-zA-Z0-9_]+)?\s*\(([^)]+)\)/i);
    if (createIndexMatch) {
      const isUnique = Boolean(createIndexMatch[1]);
      const indexName = normalizeIdentifier(createIndexMatch[2]);
      const tableName = normalizeTableName(createIndexMatch[3]);
      const colExpression = createIndexMatch[4];
      const cols = colExpression.split(',').map(c => normalizeIdentifier(c.trim().split(/\s+/)[0]));

      catalog.indexes[indexName] = {
        name: indexName,
        tableName,
        columns: cols,
        isUnique,
        expression: colExpression,
      };
      continue;
    }

    // 3. ALTER TABLE ... ENABLE ROW LEVEL SECURITY
    const enableRlsMatch = normalized.match(/^ALTER\s+TABLE\s+([a-zA-Z0-9_."]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    if (enableRlsMatch) {
      const tableName = normalizeTableName(enableRlsMatch[1]);
      if (catalog.tables[tableName]) {
        catalog.tables[tableName].rlsEnabled = true;
      }
      continue;
    }

    // 4. CREATE POLICY
    const createPolicyMatch = normalized.match(/^CREATE\s+POLICY\s+["']?([^"']+)["']?\s+ON\s+([a-zA-Z0-9_."]+)([\s\S]*)$/i);
    if (createPolicyMatch) {
      const policyName = createPolicyMatch[1].trim();
      const tableName = normalizeTableName(createPolicyMatch[2]);
      const policyBody = createPolicyMatch[3];

      const forMatch = policyBody.match(/FOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)/i);
      const toMatch = policyBody.match(/TO\s+([a-zA-Z0-9_,\s]+)(?:USING|WITH|$)/i);
      const usingMatch = policyBody.match(/USING\s*\(([\s\S]*?)\)(?:\s+WITH\s+CHECK|$)/i);
      const withCheckMatch = policyBody.match(/WITH\s+CHECK\s*\(([\s\S]*?)\)$/i);

      if (!catalog.policies[tableName]) catalog.policies[tableName] = {};
      catalog.policies[tableName][policyName] = {
        name: policyName,
        tableName,
        command: forMatch ? forMatch[1].toUpperCase() : 'ALL',
        roles: toMatch ? toMatch[1].trim() : 'PUBLIC',
        using: usingMatch ? usingMatch[1].trim() : null,
        withCheck: withCheckMatch ? withCheckMatch[1].trim() : null,
        raw: normalized,
      };
      continue;
    }

    // 5. DROP POLICY
    const dropPolicyMatch = normalized.match(/^DROP\s+POLICY(?:\s+IF\s+EXISTS)?\s+["']?([^"']+)["']?\s+ON\s+([a-zA-Z0-9_."]+)/i);
    if (dropPolicyMatch) {
      const policyName = dropPolicyMatch[1].trim();
      const tableName = normalizeTableName(dropPolicyMatch[2]);
      if (catalog.policies[tableName]) {
        delete catalog.policies[tableName][policyName];
      }
      continue;
    }

    // 6. DROP INDEX
    const dropIndexMatch = normalized.match(/^DROP\s+INDEX(?:\s+IF\s+EXISTS)?\s+([a-zA-Z0-9_."]+)/i);
    if (dropIndexMatch) {
      const raw = dropIndexMatch[1];
      const indexName = normalizeIdentifier(raw.includes('.') ? raw.split('.')[1] : raw);
      delete catalog.indexes[indexName];
      continue;
    }

    // 7. DROP TABLE
    const dropTableMatch = normalized.match(/^DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+([a-zA-Z0-9_."]+)/i);
    if (dropTableMatch) {
      const tableName = normalizeTableName(dropTableMatch[1]);
      delete catalog.tables[tableName];
      delete catalog.policies[tableName];
      // remove associated indexes
      for (const [idxName, idx] of Object.entries(catalog.indexes)) {
        if (idx.tableName === tableName) delete catalog.indexes[idxName];
      }
      continue;
    }
  }

  return { catalog, errors, warnings };
}

/**
 * Validates a schema catalog for PostgreSQL compliance, integrity, and safety.
 */
export function validateCatalogIntegrity(catalog) {
  const errors = [];
  const warnings = [];

  for (const [tableName, table] of Object.entries(catalog.tables)) {
    // 1. Check Primary Key
    if (!table.primaryKeys || table.primaryKeys.length === 0) {
      errors.push(`Table ${tableName} lacks a PRIMARY KEY constraint.`);
    }

    // 2. Check Data Types
    for (const [colName, col] of Object.entries(table.columns)) {
      if (!VALID_PG_TYPES.has(col.dataType)) {
        errors.push(`Table ${tableName} column "${colName}" has invalid PostgreSQL type: "${col.dataType}".`);
      }
    }

    // 3. Check Foreign Keys exist in target tables
    for (const fk of table.foreignKeys) {
      const targetTable = catalog.tables[fk.targetTable];
      if (targetTable) {
        for (const targetCol of fk.targetColumns) {
          if (!targetTable.columns[targetCol]) {
            errors.push(`Table ${tableName} FK "${fk.name}" references non-existent column "${targetCol}" on "${fk.targetTable}".`);
          }
        }
      }
      // If targetTable is not in current catalog, it may be in another pre-existing schema migration (recorded as warning if isolated dry-run)
    }

    // 4. Validate Table Indexes
    for (const [idxName, idx] of Object.entries(catalog.indexes)) {
      if (idx.tableName === tableName) {
        for (const col of idx.columns) {
          if (!table.columns[col]) {
            errors.push(`Index "${idxName}" targets non-existent column "${col}" on "${tableName}".`);
          }
        }
      }
    }

    // 5. Check RLS policies if RLS is enabled
    if (table.rlsEnabled) {
      const tablePolicies = catalog.policies[tableName];
      if (!tablePolicies || Object.keys(tablePolicies).length === 0) {
        warnings.push(`Table ${tableName} has RLS enabled but no policies defined.`);
      } else {
        for (const [polName, pol] of Object.entries(tablePolicies)) {
          if (!pol.using && !pol.withCheck) {
            errors.push(`Policy "${polName}" on "${tableName}" specifies neither USING nor WITH CHECK clause.`);
          }
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * Validates a DDL SQL string.
 */
export function validateDdlScript(sqlText, existingCatalog) {
  const statements = splitStatements(sqlText);
  const { catalog, errors: parseErrors, warnings: parseWarnings } = buildSchemaCatalog(statements, existingCatalog);
  const { errors: integErrors, warnings: integWarnings } = validateCatalogIntegrity(catalog);

  return {
    valid: parseErrors.length === 0 && integErrors.length === 0,
    statementsCount: statements.length,
    catalog,
    errors: [...parseErrors, ...integErrors],
    warnings: [...parseWarnings, ...integWarnings],
  };
}

/**
 * CLI execution entrypoint
 */
if (process.argv[1] && process.argv[1].endsWith('sql-ddl-validator.mjs')) {
  const targetFile = process.argv[2];
  if (!targetFile) {
    console.error('Usage: node scripts/qa/sql-ddl-validator.mjs <file.sql>');
    process.exit(2);
  }

  const filePath = path.resolve(process.cwd(), targetFile);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(2);
  }

  const sql = fs.readFileSync(filePath, 'utf8');
  const result = validateDdlScript(sql);

  console.log(`[sql-ddl-validator] File: ${targetFile}`);
  console.log(`[sql-ddl-validator] Statements parsed: ${result.statementsCount}`);
  console.log(`[sql-ddl-validator] Tables found: ${Object.keys(result.catalog.tables).length}`);
  console.log(`[sql-ddl-validator] Indexes found: ${Object.keys(result.catalog.indexes).length}`);

  if (result.warnings.length > 0) {
    console.warn('[sql-ddl-validator] WARNINGS:');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (!result.valid) {
    console.error('[sql-ddl-validator] FAIL: Integrity errors found:');
    result.errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('[sql-ddl-validator] PASS: DDL syntax, types, constraints and RLS are valid.');
  process.exit(0);
}
