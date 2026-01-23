import { formatDistanceToNow, format } from 'date-fns';

export function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return format(d, 'MMM d, yyyy');
}

export function formatRelativeTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatReadingTime(minutes) {
  if (!minutes) return '';
  if (minutes < 1) return '< 1 min read';
  return `${minutes} min read`;
}

export function formatWordCount(count) {
  if (!count) return '';
  return new Intl.NumberFormat().format(count) + ' words';
}
