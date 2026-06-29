import { logger } from '../../../services/logger/logger.js';

export async function handleTaskCreated(payload) {
  logger.info('[DomainHandler] Processando task.created', payload);
  // Regras de negócio de domínio para automação de conquistas ou métricas ao criar tarefa
  return { success: true, handled: 'task.created' };
}
