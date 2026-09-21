const UK_TIME_ZONE = "Europe/London";
const UK_REFRESH_HOURS = new Set([6, 18]);

const UK_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type UkCampaignRefreshWindow = {
  shouldRun: boolean;
  localDate: string;
  localHour: number;
  localTime: string;
  timeZone: typeof UK_TIME_ZONE;
};

/**
 * Vercel cron schedules are UTC. This records the corresponding UK-local time
 * in every run and makes the GMT/BST offset explicit in tests and summaries.
 * `shouldRun` is true when a timestamp lands exactly on the preferred
 * 06:00/18:00 Europe/London hours.
 */
export function getUkCampaignRefreshWindow(
  date: Date = new Date(),
): UkCampaignRefreshWindow {
  const parts = Object.fromEntries(
    UK_DATE_TIME_FORMATTER.formatToParts(date).map((part) => [
      part.type,
      part.value,
    ]),
  );
  const localHour = Number(parts.hour);
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localTime = `${localDate}T${parts.hour}:${parts.minute}:${parts.second}`;

  return {
    shouldRun: UK_REFRESH_HOURS.has(localHour),
    localDate,
    localHour,
    localTime,
    timeZone: UK_TIME_ZONE,
  };
}
