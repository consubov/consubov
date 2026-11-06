# Autenticação local — critérios de revisão F23

Estado: implementação e validação em andamento. Este documento não aprova T02/T03 nem uso em produção.

## Autoridade e provisionamento

O primeiro login de cada conta exige resposta válida da API local do laboratório. A escolha explícita do vínculo exige validação na mesma API; o navegador não assina tokens nem concede vínculos. O login inicial não é suficiente para liberar operação: todos os arquivos do módulo autorizado precisam estar verificados e disponíveis.

O pacote público do shell não deve conter usuários/senhas sintéticos, chave de assinatura da API ou MFA fictício. Fixtures pertencem ao servidor de laboratório e aos testes. O login offline de conta ainda não habilitada no dispositivo deve ser recusado.

## Dados locais e validade

A credencial offline deve proteger a integridade da autorização recebida do servidor e evitar senha em texto claro. O registro persistido deve usar proteção autenticada vinculada à senha e a uma chave de dispositivo não extraível. Alterações de ciphertext, identidade, escopo ou metadados vinculados devem resultar em recusa, nunca em novos direitos.

A validade de laboratório é limitada à expiração de 24 horas já usada pelas sessões sintéticas. Ela não constitui aprovação de política de produção. Datas inválidas, expiradas, emitidas no futuro ou com duração além do limite devem falhar fechadas. Renovação exige validação online. Revogações não recebidas durante ausência de rede continuam sendo um limite da autorização temporal.

Logout deve invalidar operações assíncronas de autenticação e o canal ativo do módulo. Não deve apagar dados operacionais, anexos ou comandos pendentes de nenhuma conta. Um resultado tardio de login/seleção não pode ressuscitar sessão encerrada ou sobrescrever a sessão de outra conta.

## Limites do navegador

Chave Web Crypto não extraível significa que a API não exporta seu material; isso não equivale a vínculo de hardware. Código malicioso executando na mesma origem pode chamar APIs criptográficas e acessar dados enquanto a conta estiver desbloqueada. CSP, sandbox de módulos, ausência de segredos no bundle e proteção contra XSS continuam necessários.

O particionamento IndexedDB separa identidades na implementação, mas não constitui fronteira de segurança contra código arbitrário da mesma origem. A perda/eviction do perfil do navegador ou da chave local exige novo provisionamento online; não existe garantia absoluta de retenção. `navigator.storage.persist()` melhora a retenção quando concedido e deve ter seu resultado registrado no QA.

## Evidência necessária

Validar primeira conta desconhecida offline recusada, senha incorreta recusada, conta previamente habilitada funcionando após reinício offline, adulteração recusada, expiração recusada, troca/logout durante operações assíncronas, isolamento entre contas e nenhuma credencial/segredo da API no bundle público. Exercitar Chromium e WebKit com armazenamento real; Map/fakes isoladamente não comprovam persistência nem vínculo do dispositivo.
