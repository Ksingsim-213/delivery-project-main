export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} นาที`;
  if (remainingMinutes === 0) return `${hours} ชม.`;
  return `${hours} ชม. ${remainingMinutes} นาที`;
};
