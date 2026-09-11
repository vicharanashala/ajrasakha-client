/**
 * Formats a byte count into a short human-readable size label (e.g. "482 KB", "1.4 MB").
 */
export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? Math.round(value).toString() : value.toFixed(value < 10 ? 1 : 0);
  return `${formatted} ${units[exponent]}`;
};
