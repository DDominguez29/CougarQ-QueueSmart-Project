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

export const reportStats = [
  {
    label: 'Students Served',
    value: '186',
    detail: 'Completed today',
  },
  {
    label: 'Completion Rate',
    value: '94%',
    detail: 'Served before expiring',
  },
  {
    label: 'Avg Service Time',
    value: '6 min',
    detail: 'At CTAP windows',
  },
];

export const hourlyServiceVolume = [
  {
    hour: '8 AM',
    served: 14,
    percent: 31,
  },
  {
    hour: '9 AM',
    served: 24,
    percent: 53,
  },
  {
    hour: '10 AM',
    served: 38,
    percent: 84,
  },
  {
    hour: '11 AM',
    served: 45,
    percent: 100,
  },
  {
    hour: '12 PM',
    served: 41,
    percent: 91,
  },
  {
    hour: '1 PM',
    served: 24,
    percent: 53,
  },
];

export const serviceReportBreakdown = [
  {
    service: 'CTAP Pickup',
    served: 124,
    detail: 'Windows 1 and 2',
  },
  {
    service: 'CTAP Express',
    served: 42,
    detail: 'Window 3',
  },
  {
    service: 'Support Table',
    served: 20,
    detail: 'Walk-up help',
  },
  {
    service: 'Expired',
    served: 8,
    detail: 'Needs review',
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
    studentId: '1842097',
    email: 'dwhiteman@cougarnet.uh.edu',
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
    studentId: '2297416',
    email: 'mpatel14@cougarnet.uh.edu',
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
    studentId: '3310852',
    email: 'cnguyen8@cougarnet.uh.edu',
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
    studentId: '4105938',
    email: 'etorrie@cougarnet.uh.edu',
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
    studentId: '5294761',
    email: 'abrown23@cougarnet.uh.edu',
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
    studentId: '6870329',
    email: 'jlee91@cougarnet.uh.edu',
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
    studentId: '7021845',
    email: 'pshah7@cougarnet.uh.edu',
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
    studentId: '7348620',
    email: 'mhill12@cougarnet.uh.edu',
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
    studentId: '8196403',
    email: 'smartinez5@cougarnet.uh.edu',
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
    studentId: '9054178',
    email: 'njohnson18@cougarnet.uh.edu',
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

export const serviceManagementStats = [
  {
    label: 'Queue Services',
    value: '3',
    detail: 'Visible to students',
  },
  {
    label: 'Open Now',
    value: '2',
    detail: 'Pickup and Express',
  },
  {
    label: 'Floor Support',
    value: '1',
    detail: 'No queue required',
  },
];

export const managedServices = [
  {
    name: 'CTAP Pickup',
    description: 'Full CTAP material pickup for students with multiple items.',
    status: 'Open',
    lane: 'Windows 1 and 2',
    waiting: 28,
    estimatedWait: '24 min',
    intake: 'Queue required',
    action: 'Pause',
  },
  {
    name: 'CTAP Express',
    description: 'One material pickup or quick CTAP question.',
    status: 'Open',
    lane: 'Window 3',
    waiting: 9,
    estimatedWait: '10 min',
    intake: 'Queue required',
    action: 'Pause',
  },
  {
    name: 'Digital Access Support',
    description: 'Login, eBook, platform access, and technical material help.',
    status: 'Floor support',
    lane: 'Support Table',
    waiting: 0,
    estimatedWait: 'Walk-up',
    intake: 'No queue',
    action: 'Edit',
  },
];

export const serviceRoutingRules = [
  {
    situation: 'Student has multiple physical materials',
    destination: 'CTAP Pickup',
    note: 'Send to the standard queue for Window 1 or 2.',
  },
  {
    situation: 'Student has one item or a quick CTAP question',
    destination: 'CTAP Express',
    note: 'Route to Window 3 to keep the main line moving.',
  },
  {
    situation: 'Student has digital access or login issues',
    destination: 'Support Table',
    note: 'Do not require queue entry unless staff need escalation.',
  },
];

export const serviceAdjustmentItems = [
  'Pause CTAP Pickup when the line reaches the end of the store entrance.',
  'Switch Window 3 to overflow pickup only if Express has fewer than 3 waiting.',
  'Keep Digital Access Support visible as floor help so students do not join the wrong queue.',
];

export const employeeServiceNotes = [
  {
    title: 'Digital materials',
    detail:
      'Remind students that eBooks and online courseware may appear in their UH account or publisher portal instead of being picked up at the window.',
  },
  {
    title: 'Access codes',
    detail:
      'Some codes are sent directly to students by email or attached to their digital material, so staff should verify the delivery method before sending them to pickup.',
  },
  {
    title: 'Physical pickup',
    detail:
      'Only route students to CTAP Pickup when the item is a physical book, packet, kit, or printed material that must be handed out in store.',
  },
];

export const knownDigitalMaterials = [
  'Pearson MyLab access code',
  'McGraw Hill Connect code',
  'Cengage Unlimited code',
  'WebAssign course access',
  'VitalSource eBook',
];
