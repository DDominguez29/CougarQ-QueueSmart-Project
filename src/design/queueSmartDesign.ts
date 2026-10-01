export const queueSmartColors = {
  uhRed: '#c8102e',
  uhDarkRed: '#960c22',
  text: '#1f2933',
  mutedText: '#5d6673',
  border: '#d9dde3',
  surface: '#ffffff',
  softSurface: '#f6f7f9',
  warning: '#b45309',
  success: '#0f766e',
};

export const dashboardStats = [
  {
    label: 'Students Waiting',
    value: '42',
    detail: 'Across all active services',
  },
  {
    label: 'Average Wait',
    value: '18 min',
    detail: 'Down 6 min from last hour',
  },
  {
    label: 'Summoned',
    value: '11',
    detail: 'Ready for service',
  },
  {
    label: 'Expired',
    value: '5',
    detail: 'Need staff review',
  },
];

export const serviceSummaries = [
  {
    name: 'Physical CTAP Material Pickup',
    status: 'High demand',
    waiting: 28,
    averageWait: '24 min',
    staff: 4,
  },
  {
    name: 'CTAP Express',
    status: 'Normal',
    waiting: 9,
    averageWait: '10 min',
    staff: 2,
  },
  {
    name: 'Bookstore Support',
    status: 'Normal',
    waiting: 5,
    averageWait: '8 min',
    staff: 1,
  },
];

export const queueActivity = [
  {
    name: 'Jessica Garcia',
    service: 'Physical CTAP Material Pickup',
    status: 'Queued',
    waited: '28 min',
  },
  {
    name: 'Dylan Whiteman',
    service: 'CTAP Express',
    status: 'Summoned',
    waited: '4 min',
  },
  {
    name: 'Ethan Torrie',
    service: 'Physical CTAP Material Pickup',
    status: 'Expired',
    waited: '15 min',
  },
];
