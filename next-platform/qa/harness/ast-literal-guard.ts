/**
 * AST QA GUARD: Motor de Detecção de Strings Literais Hardcoded em TSX/JSX
 * Garante conformidade estrita com o requisito mandatório de bilinguismo (pt-BR / en-US).
 */

import * as ts from 'typescript';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

export interface AstLiteralViolation {
  file: string;
  line: number;
  column: number;
  text: string;
  kind: 'JsxText' | 'JsxAttribute' | 'JsxExpression';
  attributeName?: string;
  snippet?: string;
}

export interface AstGuardOptions {
  allowedLiterals?: Set<string>;
  sensitiveAttributes?: string[];
  excludePatterns?: RegExp[];
  minTextLength?: number;
}

const DEFAULT_ALLOWED = new Set<string>([
  'CONSUBOV',
  '••••••••',
  '🇧🇷 Português',
  '🇺🇸 English'
]);

const DEFAULT_SENSITIVE_ATTRIBUTES = [
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'placeholder',
  'title',
  'alt',
  'label',
  'helperText'
];

/**
 * Avalia se um determinado fragmento de texto constitui violação de literal não-traduzido.
 */
export function isViolatingLiteral(
  rawText: string,
  allowed: Set<string> = DEFAULT_ALLOWED
): boolean {
  const trimmed = rawText.trim();
  if (trimmed.length < 2) return false;
  if (allowed.has(trimmed)) return false;

  // Remove dígitos, emojis, pontuações e símbolos matemáticos
  const alphaOnly = trimmed.replace(/[\d\s\p{Emoji}\p{Punctuation}\p{Symbol}]/gu, '');
  if (alphaOnly.length < 2) return false;

  // Requer pelo menos 2 caracteres alfabéticos consecutivos (cobre português e inglês)
  return /[a-zA-ZÀ-ÿ]{2,}/.test(trimmed);
}

/**
 * Varre recursivamente um diretório em busca de arquivos TSX válidos.
 */
export function findTsxFiles(
  targetDir: string,
  excludePatterns: RegExp[] = [/\.test\./, /\.spec\./, /node_modules/]
): string[] {
  if (!existsSync(targetDir)) return [];
  const results: string[] = [];

  function walk(current: string) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          walk(fullPath);
        }
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) {
        const isExcluded = excludePatterns.some((pattern) => pattern.test(entry.name));
        if (!isExcluded) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(targetDir);
  return results.sort();
}

/**
 * Analisa a AST de um ou mais arquivos TSX e retorna a lista completa de violações.
 */
export function scanAstLiterals(
  filePaths: string[] | string,
  options?: AstGuardOptions
): AstLiteralViolation[] {
  const files = Array.isArray(filePaths) ? filePaths : [filePaths];
  const allowed = options?.allowedLiterals ?? DEFAULT_ALLOWED;
  const sensitiveAttrs = options?.sensitiveAttributes ?? DEFAULT_SENSITIVE_ATTRIBUTES;
  const violations: AstLiteralViolation[] = [];

  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    const sourceCode = readFileSync(filePath, 'utf-8');
    const sourceLines = sourceCode.split('\n');

    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      ts.ScriptKind.TSX
    );

    const visit = (node: ts.Node) => {
      // 1. Verificação de JsxText
      if (ts.isJsxText(node)) {
        const text = node.getText(sourceFile).trim();
        if (isViolatingLiteral(text, allowed)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            file: filePath,
            line: line + 1,
            column: character + 1,
            kind: 'JsxText',
            text,
            snippet: sourceLines[line]?.trim()
          });
        }
      }

      // 2. Verificação de Atributos Sensíveis em JsxAttribute
      if (ts.isJsxAttribute(node)) {
        const attrName = node.name.getText(sourceFile);
        if (sensitiveAttrs.includes(attrName)) {
          let value: string | null = null;
          let startPos = node.getStart();

          if (node.initializer) {
            if (ts.isStringLiteral(node.initializer)) {
              value = node.initializer.text.trim();
              startPos = node.initializer.getStart();
            } else if (
              ts.isJsxExpression(node.initializer) &&
              node.initializer.expression &&
              ts.isStringLiteral(node.initializer.expression)
            ) {
              value = node.initializer.expression.text.trim();
              startPos = node.initializer.expression.getStart();
            }
          }

          if (value && isViolatingLiteral(value, allowed)) {
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(startPos);
            violations.push({
              file: filePath,
              line: line + 1,
              column: character + 1,
              kind: 'JsxAttribute',
              attributeName: attrName,
              text: value,
              snippet: sourceLines[line]?.trim()
            });
          }
        }
      }

      // 3. Verificação de Literais diretos em JsxExpression como filho
      if (
        ts.isJsxExpression(node) &&
        node.parent &&
        (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
        node.expression &&
        ts.isStringLiteral(node.expression)
      ) {
        const text = node.expression.text.trim();
        if (isViolatingLiteral(text, allowed)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            file: filePath,
            line: line + 1,
            column: character + 1,
            kind: 'JsxExpression',
            text,
            snippet: sourceLines[line]?.trim()
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return violations;
}
