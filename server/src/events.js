// Barramento de eventos interno: alterações a entidades e conversas do agente.
// Alimenta o tempo real (SSE) e os workflows desencadeados por entidades.
import { EventEmitter } from 'node:events';

export const bus = new EventEmitter();
bus.setMaxListeners(0);

/** Emite depois de a transação estar confirmada (fora do ciclo atual). */
export function emitEntityEvent(event) {
  setImmediate(() => bus.emit('entity', event));
}

export function emitConversationEvent(conversation) {
  setImmediate(() => bus.emit('conversation', conversation));
}
