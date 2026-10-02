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

export const userQueue = {
  service: 'Physical CTAP Material Pickup',
  position: 4,
  estimatedWait: '12 min',
  status: 'Waiting',
};

export const availableServices = [
  {
    name: 'Physical CTAP Material Pickup',
    waiting: 28,
    estimatedWait: '24 min',
    status: 'High demand',
  },
  {
    name: 'CTAP Express',
    waiting: 9,
    estimatedWait: '10 min',
    status: 'Normal',
  },
  {
    name: 'Bookstore Support',
    waiting: 5,
    estimatedWait: '8 min',
    status: 'Normal',
  },
];
