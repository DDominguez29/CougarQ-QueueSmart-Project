import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createNotificationStore } from './store.mjs';
import { createNotificationHandler } from './http.mjs';

const item = (userId = 'u1', queueEntryId = 'e1') => ({ userId, queueEntryId, serviceName: 'Advising' });
test('join stores event, unique ID, timestamp and returns defensive copy', () => {
  const s = createNotificationStore(); const n = s.notifyJoined(item());
  assert.equal(n.type, 'joined'); assert.match(n.message, /Advising/);
  assert.ok(!Number.isNaN(Date.parse(n.createdAt)));
  n.message = 'tampered'; assert.notEqual(s.list('u1')[0].message, 'tampered');
  assert.notEqual(s.notifyJoined(item('u1', 'e2')).id, n.id);
});
test('only first two waiting users alerted; no premature alert', () => {
  const s = createNotificationStore();
  const entries = [item('u1', 'e1'), item('u2', 'e2'), item('u3', 'e3')];
  assert.equal(s.notifyQueueChanged(entries).length, 2);
  assert.equal(s.list('u3').length, 0);
  assert.match(s.list('u1')[0].message, /next/);
  assert.match(s.list('u2')[0].message, /one person/);
  assert.equal(s.notifyQueueChanged(entries.slice(1)).length, 1);
  assert.equal(s.list('u3').length, 1);
});
test('duplicates suppressed even after dismissal; rejoin gets fresh alerts', () => {
  const s = createNotificationStore(); const a = item();
  const n = s.notifyJoined(a); s.remove('u1', n.id);
  assert.equal(s.notifyJoined(a), null);
  s.notifyQueueChanged([a]); assert.deepEqual(s.notifyQueueChanged([a]), []);
  assert.ok(s.notifyJoined(item('u1', 'new-visit')));
});
test('empty queues and users without messages', () => {
  const s = createNotificationStore(); assert.deepEqual(s.notifyQueueChanged([]), []);
  assert.deepEqual(s.list('missing'), []);
});
test('ownership, newest first, defensive list copy, delete', () => {
  const s = createNotificationStore(); const first = s.notifyJoined(item());
  const second = s.notifyJoined(item('u1', 'e2')); s.notifyJoined(item('u2', 'e3'));
  assert.deepEqual(s.list('u1').map(x => x.id), [second.id, first.id]);
  const result = s.list('u1'); result[0].message = 'wrong';
  assert.notEqual(s.list('u1')[0].message, 'wrong');
  assert.throws(() => s.remove('u2', first.id), { status: 404 });
  s.remove('u1', first.id); assert.equal(s.list('u1').length, 1);
  assert.throws(() => s.remove('u1', first.id), { status: 404 });
});
for (const field of ['userId', 'queueEntryId', 'serviceName']) {
  for (const [label, value] of Object.entries({ missing: undefined, blank: ' ', number: 5, long: 'x'.repeat(129) })) {
    test(`reject ${label} ${field} without mutation`, () => {
      const s = createNotificationStore();
      assert.throws(() => s.notifyJoined({ ...item(), [field]: value }), { status: 400 });
      assert.deepEqual(s.list('u1'), []);
    });
  }
}
test('length boundaries, trimming and invalid containers', () => {
  const s = createNotificationStore();
  assert.ok(s.notifyJoined({ userId: 'x'.repeat(128), queueEntryId: 'y'.repeat(128), serviceName: 'z'.repeat(100) }));
  assert.equal(s.notifyJoined({ ...item(), userId: ' u1 ' }).userId, 'u1');
  for (const bad of [null, [], 'bad']) assert.throws(() => s.notifyJoined(bad), { status: 400 });
  assert.throws(() => s.notifyQueueChanged(null), { status: 400 });
  assert.throws(() => s.notifyQueueChanged([item(), item()]), { status: 400 });
  assert.throws(() => s.list(null), { status: 400 });
  assert.throws(() => s.remove('u1', ''), { status: 400 });
});
test('invalid batch is atomic', () => {
  const s = createNotificationStore();
  assert.throws(() => s.notifyQueueChanged([item(), {}])); assert.deepEqual(s.list('u1'), []);
});

test('HTTP routes: isolation, authentication, validation, deletion and errors', async t => {
  const s = createNotificationStore(); const own = s.notifyJoined(item());
  const other = s.notifyJoined(item('u2', 'e2'));
  // Test-only identity adapter; production must verify authentication.
  const handler = createNotificationHandler(s, req => {
    if (req.headers.authorization === 'explode') throw new Error('secret internal detail');
    return req.headers.authorization ? { id: req.headers.authorization } : null;
  });
  const server = createServer(async (req, res) => {
    if (!await handler(req, res)) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, method = 'GET', auth = 'u1') => fetch(base + path, { method, headers: auth ? { authorization: auth } : {} });
  let r = await call('/api/notifications'); assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).notifications.map(n => n.id), [own.id]);
  assert.equal((await call('/api/notifications', 'GET', null)).status, 401);
  assert.equal((await call(`/api/notifications/${other.id}`, 'DELETE')).status, 404);
  assert.equal((await call('/api/notifications/', 'DELETE')).status, 400);
  assert.equal((await call('/api/notifications/%ZZ', 'DELETE')).status, 400);
  assert.equal((await call('/api/notifications', 'POST')).status, 405);
  assert.equal((await call('/other')).status, 404);
  r = await call('/api/notifications', 'GET', 'explode'); assert.equal(r.status, 500);
  assert.equal((await r.json()).error, 'Unable to process notifications.');
  assert.equal((await call(`/api/notifications/${own.id}`, 'DELETE')).status, 204);
  assert.equal(s.list('u1').length, 0);
});
