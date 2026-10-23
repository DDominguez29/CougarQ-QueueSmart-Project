import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAdminReport } from '../src/modules/reports/reports.service.ts';
import { storeDate, validateReportQuery } from '../src/modules/reports/reports.validation.ts';
import { admin, student, makeEntry, makeStore, expectApiError } from './fixtures.ts';

const day = { startDate: '2026-10-22', endDate: '2026-10-22' };
function finished(id: string, completedAt = '2026-10-22T16:00:00.000Z', wait = 10) {
  const end = Date.parse(completedAt);
  return makeEntry({ id, status: 'served', completedAt, endedAt: completedAt,
    serviceStartedAt: new Date(end - 5 * 60_000).toISOString(),
    joinedAt: new Date(end - (wait + 5) * 60_000).toISOString() });
}

test('reports count completed visits and unique people, excluding abandoned and active visits from average wait', () => {
  const store = makeStore([
    finished('first', undefined, 5), finished('repeat', undefined, 15),
    { ...finished('second-person', undefined, 40), userId: 'student-2' },
    makeEntry({ id: 'left', status: 'left', endedAt: '2026-10-22T17:00:00Z' }),
    makeEntry({ id: 'queued' }), makeEntry({ id: 'serving', status: 'serving' }),
  ]);
  const report = getAdminReport(store, admin, day);
  assert.deepEqual(report.summary, { servedVisits: 3, uniquePeopleServed: 2, averageWaitMinutes: 20, measuredWaitVisits: 3, missingWaitVisits: 0, leftVisits: 1 });
  assert.equal(report.totalVisits, 4);
  assert.equal(report.days[0].servedVisits, 3);
});

test('queue wait excludes service duration and accepts zero-minute waits', () => {
  const store = makeStore([finished('zero', undefined, 0), finished('ten', undefined, 10)]);
  assert.equal(getAdminReport(store, admin, day).summary.averageWaitMinutes, 5);
});

test('legacy and invalid timing is excluded from wait averages without losing served counts', () => {
  const store = makeStore([
    makeEntry({ id: 'legacy', status: 'served', endedAt: '2026-10-22T16:00:00Z' }),
    { ...finished('bad-start'), serviceStartedAt: 'invalid' },
    { ...finished('negative-wait'), joinedAt: '2026-10-22T18:00:00Z' },
    { ...finished('bad-completion'), serviceStartedAt: '2026-10-22T18:00:00Z' },
    { ...finished('bad-join'), joinedAt: 'invalid' },
    finished('valid'),
  ]);
  const report = getAdminReport(store, admin, day);
  assert.equal(report.summary.servedVisits, 6);
  assert.equal(report.summary.measuredWaitVisits, 1);
  assert.equal(report.summary.missingWaitVisits, 5);
  assert.equal(report.summary.averageWaitMinutes, 10);
});

test('invalid or absent completion dates cannot be assigned to a reporting day', () => {
  const store = makeStore([makeEntry({ id: 'missing', status: 'served' }), makeEntry({ id: 'invalid', status: 'served', endedAt: 'invalid' })]);
  assert.equal(getAdminReport(store, admin, day).summary.servedVisits, 0);
});

test('empty reports show zero counts and unavailable averages, including empty days', () => {
  const report = getAdminReport(makeStore(), admin, { startDate: '2026-10-21', endDate: '2026-10-22' });
  assert.equal(report.summary.averageWaitMinutes, null);
  assert.equal(report.summary.servedVisits, 0);
  assert.deepEqual(report.days.map((item) => item.date), ['2026-10-21', '2026-10-22']);
  assert.equal(report.days[0].averageWaitMinutes, null);
  assert.equal(report.totalPages, 1);
});

test('range averages are weighted by visits rather than averaged from daily averages', () => {
  const store = makeStore([
    finished('a', '2026-10-21T16:00:00Z', 10), finished('b', '2026-10-21T17:00:00Z', 10),
    finished('c', '2026-10-21T18:00:00Z', 10), finished('d', '2026-10-22T16:00:00Z', 50),
  ]);
  const report = getAdminReport(store, admin, { startDate: '2026-10-21', endDate: '2026-10-22' });
  assert.deepEqual(report.days.map((item) => item.averageWaitMinutes), [10, 50]);
  assert.equal(report.summary.averageWaitMinutes, 20);
  assert.equal(report.summary.uniquePeopleServed, 1);
});

test('Chicago midnight boundaries include the entire selected local day', () => {
  const store = makeStore([
    finished('before', '2026-10-22T04:59:59.999Z'), finished('start', '2026-10-22T05:00:00.000Z'),
    finished('end', '2026-10-23T04:59:59.999Z'), finished('after', '2026-10-23T05:00:00.000Z'),
  ]);
  assert.deepEqual(getAdminReport(store, admin, day).visits.map((item) => item.id), ['end', 'start']);
});

test('spring and autumn daylight-saving transitions use 23-hour and 25-hour Chicago days', () => {
  for (const [date, before, start, end, after] of [
    ['2026-03-08', '2026-03-08T05:59:59Z', '2026-03-08T06:00:00Z', '2026-03-09T04:59:59Z', '2026-03-09T05:00:00Z'],
    ['2026-11-01', '2026-11-01T04:59:59Z', '2026-11-01T05:00:00Z', '2026-11-02T05:59:59Z', '2026-11-02T06:00:00Z'],
  ]) {
    const store = makeStore([finished('before', before), finished('start', start), finished('end', end), finished('after', after)]);
    assert.equal(getAdminReport(store, admin, { startDate: date, endDate: date }).summary.servedVisits, 2);
  }
});

test('reports use completion day even when the user joined the previous day', () => {
  const store = makeStore([{ ...finished('overnight', '2026-10-22T05:10:00Z', 20) }]);
  assert.equal(getAdminReport(store, admin, day).summary.servedVisits, 1);
  assert.equal(getAdminReport(store, admin, day).summary.averageWaitMinutes, 20);
});

test('service filters retain deleted-service history and exclude other services', () => {
  const store = makeStore([finished('ctap'), { ...finished('support'), serviceId: 'support', serviceName: 'Old Support' }]);
  store.services.delete('support');
  const report = getAdminReport(store, admin, { ...day, serviceId: 'support' });
  assert.equal(report.summary.servedVisits, 1);
  assert.equal(report.visits[0].serviceName, 'Old Support');
  assert.ok(report.services.some((service) => service.id === 'support'));
  expectApiError(() => getAdminReport(store, admin, { ...day, serviceId: 'missing' }), 404, 'SERVICE_NOT_FOUND');
});

test('paginated history preserves full-range totals and clamps pages past the end', () => {
  const store = makeStore(Array.from({ length: 26 }, (_, index) => finished(`visit-${index}`, `2026-10-22T16:${String(index).padStart(2, '0')}:00Z`)));
  const first = getAdminReport(store, admin, day);
  const second = getAdminReport(store, admin, { ...day, page: '2' });
  assert.equal(first.visits.length, 25);
  assert.equal(second.visits.length, 1);
  assert.equal(second.summary.servedVisits, 26);
  assert.equal(first.visits[0].id, 'visit-25');
  assert.equal(getAdminReport(store, admin, { ...day, page: '99' }).page, 2);
  second.visits[0].status = 'left';
  assert.equal(store.queueEntries.get(second.visits[0].id)?.status, 'served');
});

test('report permissions are checked before filters or data are exposed', () => {
  expectApiError(() => getAdminReport(makeStore(), undefined), 401, 'UNAUTHENTICATED');
  expectApiError(() => getAdminReport(makeStore(), student), 403, 'FORBIDDEN');
});

test('report filter validation rejects malformed fields, calendar dates, and excessive ranges', () => {
  const invalid = [
    { startDate: '2026-02-29' }, { startDate: '2026-02-30' }, { startDate: '' }, { startDate: null },
    { startDate: ['2026-10-22'] }, { endDate: 22 }, { endDate: '1900-01-01' }, { startDate: '2101-01-01' },
    { startDate: '2026-10-23', endDate: '2026-10-22' }, { startDate: '2026-01-01', endDate: '2026-02-01' },
    { page: '0' }, { page: '-1' }, { page: '1.5' }, { page: '1000000' }, { page: ['1', '2'] }, { page: null },
    { serviceId: '' }, { serviceId: ['ctap'] }, { userId: 'other' },
  ];
  for (const query of invalid) expectApiError(() => validateReportQuery(query), 400, 'INVALID_INPUT');
  assert.equal(validateReportQuery({ startDate: '2024-02-29', endDate: '2024-02-29' }).startDate, '2024-02-29');
});

test('default report date follows the store timezone rather than UTC', () => {
  const now = new Date('2026-10-23T02:00:00Z');
  assert.equal(storeDate(now), '2026-10-22');
  assert.equal(getAdminReport(makeStore(), admin, {}, now).startDate, '2026-10-22');
});
