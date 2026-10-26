import { base44 } from '@/api/base44Client';

/**
 * Chama uma função do backend e devolve `data`. Erros (incluindo respostas 4xx, como «funcionalidade não incluída
 * na licença») chegam como Error com a mensagem do servidor.
 */
export async function invokeFn(name, payload) {
  let res;
  try {
    res = await base44.functions.invoke(name, payload);
  } catch (e) {
    const msg = e?.response?.data?.error || e?.data?.error || e?.message || 'Erro';
    const err = new Error(msg);
    err.status = e?.response?.status || e?.status;
    throw err;
  }
  const data = res?.data ?? res;
  if (data?.error) throw new Error(data.error);
  return data;
}
