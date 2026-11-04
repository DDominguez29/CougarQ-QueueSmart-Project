-- Run in a disposable PostgreSQL database AFTER schema.sql, for example:
--   psql -v ON_ERROR_STOP=1 -d queuesmart_test -f server/src/data/schema.sql -f server/tests/schema.test.sql
-- Fixture records and the temporary assertion helper are rolled back.
-- Identity sequences may advance; this is intentionally not a production test.
BEGIN;

CREATE FUNCTION pg_temp.expect_error(statement text, expected_state text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    BEGIN
        EXECUTE statement;
    EXCEPTION WHEN OTHERS THEN
        IF NOT (SQLSTATE = ANY (string_to_array(expected_state, ','))) THEN
            RAISE EXCEPTION 'Expected SQLSTATE %, got %: %', expected_state, SQLSTATE, SQLERRM;
        END IF;
        RETURN;
    END;
    RAISE EXCEPTION 'Expected SQLSTATE %, but statement succeeded: %', expected_state, statement;
END;
$$;

DO $schema_tests$
DECLARE
    users uuid[] := ARRAY[]::uuid[];
    user_id uuid;
    service_id uuid;
    queue_id uuid;
    other_queue_id uuid;
    first_entry uuid;
    second_entry uuid;
    third_entry uuid;
    left_entry uuid;
    notification_id uuid;
    ordered_ids uuid[];
    i integer;
BEGIN
    -- Account/profile relationship and existing field limits.
    FOR i IN 1..4 LOOP
        INSERT INTO user_credentials (email, password_hash)
            VALUES ('schema-test-' || i || '@cougarnet.uh.edu', 'test-salt:test-hash')
            RETURNING id INTO user_id;
        users := array_append(users, user_id);
        INSERT INTO user_profiles (user_id, full_name) VALUES (user_id, 'Test User');
    END LOOP;

    PERFORM pg_temp.expect_error(
        $$INSERT INTO user_credentials (email, password_hash)
          VALUES ('schema-test-1@cougarnet.uh.edu', 'hash')$$, '23505');
    PERFORM pg_temp.expect_error(
        $$INSERT INTO user_credentials (email, password_hash)
          VALUES ('SCHEMA-TEST-1@cougarnet.uh.edu', 'hash')$$, '23514');
    PERFORM pg_temp.expect_error(
        $$INSERT INTO user_credentials (email, password_hash) VALUES ('bad-email', 'hash')$$,
        '23514');
    PERFORM pg_temp.expect_error(
        $$INSERT INTO user_credentials (email, password_hash, role)
          VALUES ('invalid-role@uh.edu', 'hash', 'owner')$$, '23514');
    PERFORM pg_temp.expect_error(
        $$INSERT INTO user_credentials (email, password_hash) VALUES ('blank-hash@uh.edu', ' ')$$,
        '23514');
    PERFORM pg_temp.expect_error(
        $$INSERT INTO user_credentials (email, password_hash)
          VALUES (repeat('a', 101) || '@uh.edu', 'hash')$$, '22001');
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO user_profiles (user_id, full_name) VALUES (%L, %L)', users[1], 'Duplicate'),
        '23505');
    PERFORM pg_temp.expect_error(
        $$INSERT INTO user_profiles (user_id, full_name) VALUES (gen_random_uuid(), 'Orphan')$$,
        '23503');
    PERFORM pg_temp.expect_error(format(
        'UPDATE user_profiles SET full_name = %L WHERE user_id = %L', ' ', users[1]), '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE user_profiles SET full_name = repeat(''a'', 61) WHERE user_id = %L', users[1]),
        '22001');

    INSERT INTO services (name, description, expected_duration_minutes, priority)
        VALUES ('Original Service', 'A test service.', 2.5, 1) RETURNING id INTO service_id;
    PERFORM pg_temp.expect_error(
        $$INSERT INTO services (name, description, expected_duration_minutes)
          VALUES (NULL, 'Description', 5)$$, '23502');
    PERFORM pg_temp.expect_error(format(
        'UPDATE services SET name = %L WHERE id = %L', ' ', service_id), '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE services SET description = chr(9) || chr(10) WHERE id = %L', service_id), '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE services SET name = repeat(''a'', 101) WHERE id = %L', service_id), '22001');
    PERFORM pg_temp.expect_error(format(
        'UPDATE services SET description = repeat(''a'', 501) WHERE id = %L', service_id), '22001');
    PERFORM pg_temp.expect_error(format(
        'UPDATE services SET expected_duration_minutes = 0 WHERE id = %L', service_id), '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE services SET expected_duration_minutes = ''Infinity'' WHERE id = %L', service_id),
        '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE services SET expected_duration_minutes = ''NaN'' WHERE id = %L', service_id),
        '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE services SET priority = -1 WHERE id = %L', service_id), '23514');

    INSERT INTO queues (service_id) VALUES (service_id) RETURNING id INTO queue_id;
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO queues (service_id) VALUES (%L)', service_id), '23505');
    PERFORM pg_temp.expect_error(
        'INSERT INTO queues (service_id) VALUES (gen_random_uuid())', '23503');
    PERFORM pg_temp.expect_error(format(
        'UPDATE queues SET status = %L WHERE id = %L', 'paused', queue_id), '23514');
    INSERT INTO services (name, description, expected_duration_minutes)
        VALUES ('Other Service', 'Another service.', 5) RETURNING id INTO user_id;
    INSERT INTO queues (service_id) VALUES (user_id) RETURNING id INTO other_queue_id;

    -- Same timestamps intentionally exercise the generated arrival tie-breaker.
    INSERT INTO queue_entries (queue_id, user_id, priority, joined_at, service_name_snapshot)
        VALUES (queue_id, users[1], 1, '2026-11-04 12:00:00+00', 'Original Service')
        RETURNING id INTO first_entry;
    INSERT INTO queue_entries (queue_id, user_id, priority, joined_at, service_name_snapshot)
        VALUES (queue_id, users[2], 2, '2026-11-04 12:00:00+00', 'Original Service')
        RETURNING id INTO second_entry;
    INSERT INTO queue_entries (queue_id, user_id, priority, joined_at, service_name_snapshot)
        VALUES (queue_id, users[3], 2, '2026-11-04 12:00:00+00', 'Original Service')
        RETURNING id INTO third_entry;

    SELECT array_agg(id ORDER BY position) INTO ordered_ids FROM queue_positions;
    IF ordered_ids IS DISTINCT FROM ARRAY[second_entry, third_entry, first_entry] THEN
        RAISE EXCEPTION 'Queue priority/arrival ordering is incorrect: %', ordered_ids;
    END IF;
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO queue_entries (queue_id, user_id, service_name_snapshot) VALUES (%L, %L, %L)',
        other_queue_id, users[1], 'Other Service'), '23505');
    PERFORM pg_temp.expect_error(format(
        'UPDATE queue_entries SET queue_id = gen_random_uuid() WHERE id = %L', first_entry),
        '23503');
    PERFORM pg_temp.expect_error(format(
        'UPDATE queue_entries SET status = %L WHERE id = %L', 'invalid', first_entry), '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE queue_entries SET status = ''serving'' WHERE id = %L', first_entry), '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE queue_entries SET status = ''served'', completed_at = joined_at, ended_at = joined_at WHERE id = %L',
        first_entry), '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE queue_entries SET status = ''left'', ended_at = joined_at - interval ''1 minute'' WHERE id = %L',
        first_entry), '23514');

    -- Starting service removes a visit from positions but still blocks rejoining.
    UPDATE queue_entries SET status = 'serving', service_started_at = joined_at + interval '5 minutes'
        WHERE id = second_entry;
    IF EXISTS (SELECT 1 FROM queue_positions WHERE id = second_entry)
        OR NOT EXISTS (SELECT 1 FROM queue_positions WHERE id = third_entry AND position = 1) THEN
        RAISE EXCEPTION 'Positions did not update after starting service';
    END IF;
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO queue_entries (queue_id, user_id, service_name_snapshot) VALUES (%L, %L, %L)',
        other_queue_id, users[2], 'Other Service'), '23505');
    PERFORM pg_temp.expect_error(format(
        'UPDATE queue_entries SET status = ''served'', completed_at = joined_at, ended_at = joined_at WHERE id = %L',
        second_entry), '23514');
    UPDATE queue_entries SET status = 'served',
        completed_at = service_started_at + interval '2 minutes',
        ended_at = service_started_at + interval '2 minutes' WHERE id = second_entry;
    UPDATE queue_entries SET status = 'left', ended_at = joined_at + interval '3 minutes'
        WHERE id = first_entry;
    INSERT INTO queue_entries (queue_id, user_id, service_name_snapshot)
        VALUES (other_queue_id, users[1], 'Other Service') RETURNING id INTO left_entry;

    UPDATE services SET name = 'Renamed Service', updated_at = '2000-01-01' WHERE id = service_id;
    IF NOT EXISTS (SELECT 1 FROM user_queue_history
        WHERE id = second_entry AND service_name = 'Original Service' AND wait_minutes = 5)
        OR NOT EXISTS (SELECT 1 FROM user_queue_history
        WHERE id = first_entry AND wait_minutes IS NULL)
        OR EXISTS (SELECT 1 FROM user_queue_history WHERE id = third_entry) THEN
        RAISE EXCEPTION 'History snapshot, terminal filtering, or wait calculation is incorrect';
    END IF;
    IF EXISTS (SELECT 1 FROM services WHERE id = service_id AND updated_at = '2000-01-01') THEN
        RAISE EXCEPTION 'updated_at trigger did not run';
    END IF;

    -- Closure retains existing entries; backend transactions enforce admission.
    UPDATE queues SET status = 'closed' WHERE id = queue_id;
    IF NOT EXISTS (SELECT 1 FROM queue_positions WHERE id = third_entry AND position = 1) THEN
        RAISE EXCEPTION 'Closing a queue must retain its existing waiting visits';
    END IF;
    -- PostgreSQL versions may report RESTRICT as restrict_violation (23001)
    -- or foreign_key_violation (23503); both must reject the deletion.
    PERFORM pg_temp.expect_error(format('DELETE FROM services WHERE id = %L', service_id), '23001,23503');
    PERFORM pg_temp.expect_error(format('DELETE FROM queues WHERE id = %L', queue_id), '23001,23503');
    PERFORM pg_temp.expect_error(format('DELETE FROM user_credentials WHERE id = %L', users[2]), '23001,23503');

    INSERT INTO notifications (user_id, queue_entry_id, type, message)
        VALUES (users[3], third_entry, 'joined', 'You joined.') RETURNING id INTO notification_id;
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO notifications (user_id, queue_entry_id, type, message) VALUES (%L, %L, ''near_turn'', ''Wrong owner'')',
        users[1], third_entry), '23503');
    PERFORM pg_temp.expect_error(format(
        'UPDATE notifications SET status = ''viewed'' WHERE id = %L', notification_id), '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE notifications SET viewed_at = created_at WHERE id = %L', notification_id), '23514');
    PERFORM pg_temp.expect_error(format(
        'UPDATE notifications SET status = ''viewed'', viewed_at = created_at - interval ''1 second'' WHERE id = %L',
        notification_id), '23514');
    UPDATE notifications SET status = 'viewed', viewed_at = created_at, dismissed_at = created_at
        WHERE id = notification_id;
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO notifications (user_id, queue_entry_id, type, message) VALUES (%L, %L, ''joined'', ''Duplicate dismissed event'')',
        users[3], third_entry), '23505');

    INSERT INTO sessions (token_hash, user_id, expires_at)
        VALUES (repeat('a', 64), users[4], CURRENT_TIMESTAMP + interval '8 hours');
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (''raw-token'', %L, CURRENT_TIMESTAMP + interval ''8 hours'')',
        users[4]), '23514');
    PERFORM pg_temp.expect_error(format(
        'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (repeat(''b'', 64), %L, CURRENT_TIMESTAMP)',
        users[4]), '23514');
    DELETE FROM user_credentials WHERE id = users[4];
    IF EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.user_id = users[4])
        OR EXISTS (SELECT 1 FROM sessions WHERE sessions.user_id = users[4]) THEN
        RAISE EXCEPTION 'Unused account deletion did not cascade to profile/session';
    END IF;
END;
$schema_tests$;

SELECT 'Schema constraint, relationship, position, history, notification, session, and trigger checks passed.' AS result;
ROLLBACK;
