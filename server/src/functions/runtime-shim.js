// Equivalente ao módulo 'base44:runtime' da Base44. As funções leem os segredos com
// `secrets.get(nome)`; no servidor próprio os segredos são variáveis de ambiente.
export const secrets = { get: (name) => process.env[name] ?? undefined };
export default { secrets };
