import { GuildSettingsRow } from './database';

export type WorkingHours = {
  [day: string]: { start: string; end: string } | null;
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function isOutsideWorkingHours(settings: GuildSettingsRow | null): { isOutside: boolean; message?: string } {
  if (!settings || !settings.workingHours) {
    return { isOutside: false };
  }

  try {
    const workingHours: WorkingHours = JSON.parse(settings.workingHours);
    const now = new Date();
    
    const dayIndex = now.getDay();
    const currentDay = DAYS[dayIndex === 0 ? 6 : dayIndex - 1];
    
    const dayHours = workingHours[currentDay];
    
    if (!dayHours) {
      const hoursStr = formatWorkingHours(workingHours);
      return {
        isOutside: true,
        message: `You've created a ticket outside of our working hours. Our working hours are:\n${hoursStr}`,
      };
    }

    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    const [startHour, startMinute] = dayHours.start.split(':').map(Number);
    const [endHour, endMinute] = dayHours.end.split(':').map(Number);
    
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endTimeInMinutes = endHour * 60 + endMinute;

    if (currentTimeInMinutes < startTimeInMinutes || currentTimeInMinutes >= endTimeInMinutes) {
      const hoursStr = formatWorkingHours(workingHours);
      return {
        isOutside: true,
        message: `You've created a ticket outside of our working hours. Our working hours are:\n${hoursStr}`,
      };
    }

    return { isOutside: false };
  } catch (e) {
    return { isOutside: false };
  }
}

function formatWorkingHours(workingHours: WorkingHours): string {
  const lines: string[] = [];
  const today = new Date();
  
  for (const day of DAYS) {
    const hours = workingHours[day];
    if (hours) {
      const dayIndex = DAYS.indexOf(day);
      const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
      
      let daysUntil = dayIndex - todayIndex;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0 && today.getHours() * 60 + today.getMinutes() >= 24 * 60) {
        daysUntil = 7;
      }
      
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysUntil);
      
      const [startHour, startMinute] = hours.start.split(':').map(Number);
      const [endHour, endMinute] = hours.end.split(':').map(Number);
      
      const startDate = new Date(targetDate);
      startDate.setHours(startHour, startMinute, 0, 0);
      
      const endDate = new Date(targetDate);
      endDate.setHours(endHour, endMinute, 0, 0);
      
      const startTimestamp = Math.floor(startDate.getTime() / 1000);
      const endTimestamp = Math.floor(endDate.getTime() / 1000);
      
      lines.push(`${day}: <t:${startTimestamp}:t> - <t:${endTimestamp}:t>`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No working hours set';
}
