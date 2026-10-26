import { invokeFn } from '@/lib/invokeFn';

/**
 * Envio de email a partir da interface. Passa sempre pela função `sendEmail`, que usa o remetente da
 * AnkoraOne, aplica as regras de acesso e regista o envio na auditoria. Lança Error se nada seguir.
 */
export async function sendEmail({ to, subject, html, customerId, entityType, entityId, heading }) {
  const data = await invokeFn('sendEmail', {
    action: 'send',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    customer_id: customerId,
    entity_type: entityType,
    entity_id: entityId,
    heading,
  });
  if (!data?.sent) throw new Error(data?.errors?.[0] || 'O email não foi enviado');
  return data;
}

/** Pedido de mais licenças: os administradores da plataforma são escolhidos no servidor. */
export function requestMoreSeats({ customerId, used, limit }) {
  return invokeFn('sendEmail', { action: 'seat_request', customer_id: customerId, used, limit });
}

/** Administração: configuração de envio em uso e email de teste. */
export const mailConfig = () => invokeFn('sendEmail', { action: 'config' });
export const sendTestEmail = (to) => invokeFn('sendEmail', { action: 'test', to });
