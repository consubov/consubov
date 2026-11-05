/** Converts create-user HTTP failures into safe UI explanations. */
type HttpError = { context?: Response };

export async function createUserErrorMessage(error: unknown): Promise<string> {
  const context = (error && typeof error === 'object' && 'context' in error)
    ? (error as HttpError).context : undefined;
  const status = context?.status;
  let reason = '';
  if (context && typeof context.clone === 'function') {
    try {
      const body: unknown = await context.clone().json();
      if (body && typeof body === 'object' && 'error' in body) {
        const text = (body as { error?: unknown }).error;
        reason = typeof text === 'string' ? text : '';
      }
    } catch { /* response is not JSON */ }
  }
  if ((status === 400 || status === 409) &&
    /e-mail|email/i.test(reason) && /vinculad/i.test(reason)) {
    return "Este e-mail já está vinculado a outro perfil. Verifique o cadastro existente.";
  }
  if ((status === 400 || status === 409) &&
    /e-mail|email/i.test(reason) && /cadastrad|registrad|existing/i.test(reason)) {
    return 'Este e-mail já está cadastrado. Use um e-mail exclusivo para o novo perfil.';
  }
  if (status === 400 || status === 422) return 'Dados inválidos. Confira o e-mail e a senha.';
  if (status === 401) return 'Sua sessão expirou. Entre novamente como administrador.';
  if (status === 403) return 'Sua conta não tem permissão para cadastrar usuários.';
  if (status === 409) return 'Cadastro já existente. Verifique antes de tentar novamente.';
  if (status === 429) return 'Muitas tentativas. Aguarde antes de tentar novamente.';
  if (typeof status === 'number' && status >= 500) {
    return 'Serviço de cadastro indisponível. Confirme o estado do usuário antes de repetir.';
  }
  return 'Cadastro não concluído. Verifique a conexão antes de tentar novamente.';
}
