import { I18nParams } from './types';

/**
 * Substitui tokens no formato {nome_variavel} pelos valores fornecidos no objeto params.
 * Se o parâmetro não for encontrado, preserva o token intacto.
 */
export function interpolate(template: string, params?: I18nParams): string {
  if (!params || Object.keys(params).length === 0) {
    return template;
  }
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key) && params[key] !== undefined) {
      return String(params[key]);
    }
    return match;
  });
}
