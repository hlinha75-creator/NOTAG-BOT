/**
 * Sistema de agendamento de tarefas
 * Gerencia lembretes, eventos recorrentes, resets automáticos
 */

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.intervals = new Map();
  }

  /**
   * Agenda uma função para executar em um horário específico
   * @param {string} id - ID único do job
   * @param {Date} date - Data/hora para executar
   * @param {Function} callback - Função a executar
   */
  scheduleOnce(id, date, callback) {
    // Cancela job existente com mesmo ID
    this.cancelJob(id);

    const now = Date.now();
    const delay = date.getTime() - now;

    if (delay <= 0) {
      console.log(`[Scheduler] Job ${id} já expirado, executando imediatamente`);
      callback();
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        console.error(`[Scheduler] Error executing job ${id}:`, error);
      }
      this.jobs.delete(id);
    }, delay);

    this.jobs.set(id, { type: 'timeout', handle: timeout, scheduledFor: date });
    console.log(`[Scheduler] Job ${id} scheduled for ${date.toLocaleString()}`);
  }

  /**
   * Agenda execução periódica
   * @param {string} id 
   * @param {number} intervalMs - Intervalo em milissegundos
   * @param {Function} callback 
   * @param {boolean} immediate - Executar imediatamente também?
   */
  scheduleInterval(id, intervalMs, callback, immediate = false) {
    this.cancelInterval(id);

    if (immediate) {
      callback().catch(err => console.error(`[Scheduler] Error in immediate ${id}:`, err));
    }

    const interval = setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        console.error(`[Scheduler] Error in interval ${id}:`, error);
      }
    }, intervalMs);

    this.intervals.set(id, interval);
  }

  /**
   * Agenda para todo dia em horário específico
   * @param {string} id 
   * @param {number} hour - 0-23
   * @param {number} minute - 0-59
   * @param {Function} callback 
   */
  scheduleDaily(id, hour, minute, callback) {
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(hour, minute, 0, 0);

      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      this.scheduleOnce(`${id}_${next.getTime()}`, next, async () => {
        try {
          await callback();
        } catch (error) {
          console.error(`[Scheduler] Daily job ${id} error:`, error);
        }
        // Reagenda para próximo dia
        scheduleNext();
      });
    };

    scheduleNext();
  }

  /**
   * Agenda lembrete para evento
   * @param {string} eventId 
   * @param {Date} eventDate 
   * @param {number} minutesBefore - Minutos antes para alertar
   * @param {Function} reminderCallback 
   */
  scheduleEventReminder(eventId, eventDate, minutesBefore, reminderCallback) {
    const reminderTime = new Date(eventDate.getTime() - (minutesBefore * 60000));
    const jobId = `reminder_${eventId}_${minutesBefore}`;

    this.scheduleOnce(jobId, reminderTime, reminderCallback);
  }

  /**
   * Cancela job específico
   * @param {string} id 
   */
  cancelJob(id) {
    const job = this.jobs.get(id);
    if (job) {
      clearTimeout(job.handle);
      this.jobs.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Cancela intervalo
   * @param {string} id 
   */
  cancelInterval(id) {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Lista jobs ativos
   */
  listActiveJobs() {
    const now = Date.now();
    const list = [];

    for (const [id, job] of this.jobs.entries()) {
      list.push({
        id,
        type: job.type,
        scheduledFor: job.scheduledFor,
        remainingMs: job.scheduledFor.getTime() - now
      });
    }

    return list;
  }

  /**
   * Limpa todos os jobs
   */
  clearAll() {
    for (const [id, job] of this.jobs.entries()) {
      clearTimeout(job.handle);
    }
    for (const [id, interval] of this.intervals.entries()) {
      clearInterval(interval);
    }
    this.jobs.clear();
    this.intervals.clear();
  }
}

module.exports = new SchedulerService();