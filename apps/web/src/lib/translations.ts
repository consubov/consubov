import type { SiteLanguage } from "./siteLanguage";
export const APP_TRANSLATIONS: Record<SiteLanguage, Record<string,string>> = {
 "pt-BR": {
 "auth.invalid":"Email ou senha inválidos.","auth.login":"Entrar","auth.password":"Senha",
 "auth.remember":"Lembrar meu e-mail","auth.forgot":"Esqueci minha senha",
 "auth.reset":"Senha atualizada. Entre novamente com a nova senha.",
 "auth.subtitle":"Sistema de Gestão Pecuária","auth.relatto":"Relatórios Técnicos de Campo",
 "auth.denied":"Acesso não autorizado","auth.deniedDetail":"Seu perfil não possui permissão para acessar esta área.",
 "auth.back":"Voltar ao painel","auth.noProfile":"Usuário sem perfil configurado",
 "auth.contact":"Contate o administrador para vincular seu acesso.",
 "logout":"Sair","welcome":"Bem-vindo","save":"Salvar"
 },
 "en-US": {
 "auth.invalid":"Invalid email or password.","auth.login":"Sign in","auth.password":"Password",
 "auth.remember":"Remember my email","auth.forgot":"Forgot your password?",
 "auth.reset":"Password updated. Sign in again with your new password.",
 "auth.subtitle":"Livestock Management System","auth.relatto":"Field Technical Reports",
 "auth.denied":"Access denied","auth.deniedDetail":"Your profile does not have permission to access this area.",
 "auth.back":"Back to dashboard","auth.noProfile":"No user profile configured",
 "auth.contact":"Contact your administrator to assign access.",
 "logout":"Sign out","welcome":"Welcome","save":"Save"
 }
};
