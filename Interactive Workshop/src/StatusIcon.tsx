import { CheckCircle2, Circle, CircleAlert, Clock3 } from 'lucide-react';
import type { Status } from './types';

export function StatusIcon({ status, size = 16 }: { status: Status; size?: number }) {
  const Icon = status === 'done' ? CheckCircle2 : status === 'blocked' ? CircleAlert : status === 'deferred' ? Clock3 : Circle;
  return <Icon size={size} />;
}