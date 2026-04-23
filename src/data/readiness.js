export const readinessSignals = [
  { id: 'compliance', label: 'Compliance', score: 84, status: 'ready' },
  { id: 'delivery', label: 'Delivery Reliability', score: 71, status: 'monitor' },
  { id: 'transparency', label: 'Reporting Integrity', score: 92, status: 'ready' },
  { id: 'response', label: 'Response Cadence', score: 63, status: 'action' }
];

export const statusConfig = {
  ready: { label: 'Ready', tone: 'text-success' },
  monitor: { label: 'Monitor', tone: 'text-warning' },
  action: { label: 'Action Required', tone: 'text-danger' }
};
