// Shared maintenance-window time check used by the guard and the settings panel.

export function isInMaintenanceWindow(config, now = new Date()) {
  if (!config || !config.enabled) return false;
  if (!config.start_time || !config.end_time) return false;

  const day = now.getDay(); // 0 = Sunday
  if (config.days_of_week && config.days_of_week.length > 0 && !config.days_of_week.includes(day)) {
    return false;
  }

  const [sh, sm] = config.start_time.split(':').map(Number);
  const [eh, em] = config.end_time.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const curMin = now.getHours() * 60 + now.getMinutes();

  if (startMin === endMin) return true; // all day

  if (startMin < endMin) {
    return curMin >= startMin && curMin < endMin;
  }
  // Overnight window (e.g. 22:00 → 04:00)
  return curMin >= startMin || curMin < endMin;
}