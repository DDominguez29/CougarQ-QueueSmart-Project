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

export const queueRushMetrics = [
  {
    label: 'Next 15 Minutes',
    value: '18',
    detail: 'Students likely to reach counter',
  },
  {
    label: 'Longest Wait',
    value: '37 min',
    detail: 'CTAP pickup lane',
  },
  {
    label: 'CTAP Windows',
    value: '3',
    detail: 'Pickup, express, and review',
  },
];

export const activeQueue = [
  {
    position: 1,
    name: 'Dylan Whiteman',
    studentId: 'UH-1842',
    service: 'CTAP Express',
    ticket: 'A108',
    waited: '4 min',
    status: 'Summoned',
    station: 'Express Window',
    priority: 'Ready now',
  },
  {
    position: 2,
    name: 'Maya Patel',
    studentId: 'UH-2297',
    service: 'Physical CTAP Material Pickup',
    ticket: 'B214',
    waited: '31 min',
    status: 'Queued',
    station: 'Pickup Window',
    priority: 'Long wait',
  },
  {
    position: 3,
    name: 'Carlos Nguyen',
    studentId: 'UH-3310',
    service: 'Physical CTAP Material Pickup',
    ticket: 'B215',
    waited: '28 min',
    status: 'Queued',
    station: 'Pickup Window',
    priority: 'Long wait',
  },
  {
    position: 4,
    name: 'Ethan Torrie',
    studentId: 'UH-4105',
    service: 'Digital Material Access',
    ticket: 'C067',
    waited: '15 min',
    status: 'Expired',
    station: 'Support Table',
    priority: 'Needs review',
  },
  {
    position: 5,
    name: 'Alyssa Brown',
    studentId: 'UH-5294',
    service: 'CTAP Express',
    ticket: 'A109',
    waited: '9 min',
    status: 'Queued',
    station: 'Express Window',
    priority: 'Normal',
  },
  {
    position: 6,
    name: 'Jordan Lee',
    studentId: 'UH-6870',
    service: 'Physical CTAP Material Pickup',
    ticket: 'B216',
    waited: '24 min',
    status: 'Queued',
    station: 'Pickup Window',
    priority: 'Normal',
  },
  {
    position: 7,
    name: 'Priya Shah',
    studentId: 'UH-7021',
    service: 'Physical CTAP Material Pickup',
    ticket: 'B217',
    waited: '21 min',
    status: 'Queued',
    station: 'Pickup Window',
    priority: 'Normal',
  },
  {
    position: 8,
    name: 'Marcus Hill',
    studentId: 'UH-7348',
    service: 'CTAP Express',
    ticket: 'A110',
    waited: '7 min',
    status: 'Queued',
    station: 'Express Window',
    priority: 'Normal',
  },
  {
    position: 9,
    name: 'Sofia Martinez',
    studentId: 'UH-8196',
    service: 'Digital Material Access',
    ticket: 'C068',
    waited: '12 min',
    status: 'Queued',
    station: 'Support Table',
    priority: 'Needs review',
  },
  {
    position: 10,
    name: 'Noah Johnson',
    studentId: 'UH-9054',
    service: 'Physical CTAP Material Pickup',
    ticket: 'B218',
    waited: '18 min',
    status: 'Queued',
    station: 'Pickup Window',
    priority: 'Normal',
  },
];

export const ctapWindowPlan = [
  {
    window: 'Window 1',
    focus: 'CTAP pickup',
    assignment: 'Full material pickup and standard CTAP orders.',
  },
  {
    window: 'Window 2',
    focus: 'CTAP pickup',
    assignment: 'Second full-service lane for rush-season volume.',
  },
  {
    window: 'Window 3',
    focus: 'CTAP Express',
    assignment: 'One material pickup or quick CTAP questions.',
  },
];

export const floorSupportPlan = [
  {
    area: 'Support Table',
    focus: 'Digital access help',
    detail: 'Help students with login, course material access, and technical questions without joining the queue.',
  },
  {
    area: 'Queue Triage',
    focus: 'Before they scan in',
    detail: 'Route quick questions to Express and digital issues to the support table.',
  },
];

export const queueAttentionItems = [
  {
    label: 'Expired Tickets',
    value: '5',
    detail: 'Review before calling more physical pickup students.',
  },
  {
    label: 'Physical Pickup',
    value: '28',
    detail: 'Main bottleneck during the current rush.',
  },
  {
    label: 'Express Lane',
    value: '9',
    detail: 'Healthy if called in pairs when the window clears.',
  },
];

export const queueRushPlan = [
  'Keep Window 1 and Window 2 focused on full CTAP pickup during the rush.',
  'Use Window 3 for Express students picking up one material or asking a quick question.',
  'Send digital access and technical material issues to the support table before they join the queue.',
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
