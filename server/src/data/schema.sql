-- QueueSmart PostgreSQL schema (14+). Run once in an empty database.
-- Setup: npm run db:setup. Details: docs/database-schema.md.

BEGIN;

-- Login credentials and account roles.
CREATE TABLE user_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email varchar(100) NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'user',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_credentials_email_normalized
        CHECK (email = lower(btrim(email))),
    CONSTRAINT user_credentials_email_format
        CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
    CONSTRAINT user_credentials_email_unique UNIQUE (email),
    CONSTRAINT user_credentials_password_hash_nonblank
        CHECK (password_hash ~ '[^[:space:]]'),
    CONSTRAINT user_credentials_role_valid CHECK (role IN ('user', 'admin'))
);

-- One profile per account; email comes from credentials.
CREATE TABLE user_profiles (
    user_id uuid PRIMARY KEY,
    full_name varchar(60) NOT NULL,
    phone varchar(30),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_profiles_user_fk FOREIGN KEY (user_id)
        REFERENCES user_credentials (id) ON DELETE CASCADE,
    CONSTRAINT user_profiles_full_name_nonblank CHECK (full_name ~ '[^[:space:]]'),
    CONSTRAINT user_profiles_phone_nonblank
        CHECK (phone IS NULL OR phone ~ '[^[:space:]]')
);

-- Available services and queue priority.
CREATE TABLE services (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    description varchar(500) NOT NULL,
    expected_duration_minutes double precision NOT NULL,
    priority integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT services_name_nonblank CHECK (name ~ '[^[:space:]]'),
    CONSTRAINT services_description_nonblank CHECK (description ~ '[^[:space:]]'),
    CONSTRAINT services_duration_positive_finite CHECK (
        expected_duration_minutes > 0
        AND expected_duration_minutes < 'Infinity'::double precision
    ),
    CONSTRAINT services_priority_nonnegative CHECK (priority >= 0)
);

-- One reusable open/closed queue per service.
CREATE TABLE queues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'open',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT queues_service_fk FOREIGN KEY (service_id)
        REFERENCES services (id) ON DELETE RESTRICT,
    CONSTRAINT queues_service_unique UNIQUE (service_id),
    CONSTRAINT queues_status_valid CHECK (status IN ('open', 'closed'))
);

-- Visit records; retain finished visits for history.
CREATE TABLE queue_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id uuid NOT NULL,
    user_id uuid NOT NULL,
    arrival_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
    priority integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'queued',
    joined_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    service_started_at timestamptz,
    completed_at timestamptz,
    ended_at timestamptz,
    service_name_snapshot varchar(100) NOT NULL,
    CONSTRAINT queue_entries_queue_fk FOREIGN KEY (queue_id)
        REFERENCES queues (id) ON DELETE RESTRICT,
    CONSTRAINT queue_entries_user_fk FOREIGN KEY (user_id)
        REFERENCES user_credentials (id) ON DELETE RESTRICT,
    CONSTRAINT queue_entries_id_user_unique UNIQUE (id, user_id),
    CONSTRAINT queue_entries_priority_nonnegative CHECK (priority >= 0),
    CONSTRAINT queue_entries_service_name_nonblank
        CHECK (service_name_snapshot ~ '[^[:space:]]'),
    CONSTRAINT queue_entries_status_valid
        CHECK (status IN ('queued', 'serving', 'served', 'left')),
    CONSTRAINT queue_entries_timestamp_order CHECK (
        (service_started_at IS NULL OR service_started_at >= joined_at)
        AND (ended_at IS NULL OR ended_at >= joined_at)
        AND (completed_at IS NULL OR completed_at >= service_started_at)
    ),
    CONSTRAINT queue_entries_state_timestamps CHECK (
        (status = 'queued' AND service_started_at IS NULL
            AND completed_at IS NULL AND ended_at IS NULL)
        OR (status = 'serving' AND service_started_at IS NOT NULL
            AND completed_at IS NULL AND ended_at IS NULL)
        OR (status = 'served' AND service_started_at IS NOT NULL
            AND completed_at IS NOT NULL AND ended_at IS NOT NULL
            AND ended_at = completed_at)
        OR (status = 'left' AND service_started_at IS NULL
            AND completed_at IS NULL AND ended_at IS NOT NULL)
    )
);

-- One waiting or in-service visit per user.
CREATE UNIQUE INDEX queue_entries_one_active_visit_per_user
    ON queue_entries (user_id) WHERE status IN ('queued', 'serving');

CREATE INDEX queue_entries_waiting_order_idx
    ON queue_entries (queue_id, priority DESC, joined_at, arrival_sequence)
    WHERE status = 'queued';
CREATE INDEX queue_entries_queue_idx ON queue_entries (queue_id);
CREATE INDEX queue_entries_user_history_idx
    ON queue_entries (user_id, ended_at DESC) WHERE status IN ('served', 'left');

-- Keep dismissed alerts to prevent duplicate events.
CREATE TABLE notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    queue_entry_id uuid NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'sent',
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    viewed_at timestamptz,
    dismissed_at timestamptz,
    CONSTRAINT notifications_user_fk FOREIGN KEY (user_id)
        REFERENCES user_credentials (id) ON DELETE RESTRICT,
    CONSTRAINT notifications_visit_owner_fk FOREIGN KEY (queue_entry_id, user_id)
        REFERENCES queue_entries (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT notifications_event_unique UNIQUE (user_id, queue_entry_id, type),
    CONSTRAINT notifications_type_valid CHECK (type IN ('joined', 'near_turn')),
    CONSTRAINT notifications_message_nonblank CHECK (message ~ '[^[:space:]]'),
    CONSTRAINT notifications_status_valid CHECK (status IN ('sent', 'viewed')),
    CONSTRAINT notifications_viewed_state CHECK (
        (status = 'sent' AND viewed_at IS NULL)
        OR (status = 'viewed' AND viewed_at IS NOT NULL)
    ),
    CONSTRAINT notifications_timestamp_order CHECK (
        (viewed_at IS NULL OR viewed_at >= created_at)
        AND (dismissed_at IS NULL OR dismissed_at >= created_at)
    )
);

CREATE INDEX notifications_visible_user_idx
    ON notifications (user_id, created_at DESC) WHERE dismissed_at IS NULL;
CREATE INDEX notifications_visit_owner_idx ON notifications (queue_entry_id, user_id);

-- Store SHA-256 token digests; passwords use salted hashing.
CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamptz NOT NULL,
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id)
        REFERENCES user_credentials (id) ON DELETE CASCADE,
    CONSTRAINT sessions_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT sessions_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

-- Refresh timestamps on account, profile, service, and queue edits.
CREATE FUNCTION queuesmart_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := statement_timestamp();
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_credentials_set_updated_at
    BEFORE UPDATE ON user_credentials FOR EACH ROW
    EXECUTE FUNCTION queuesmart_set_updated_at();
CREATE TRIGGER user_profiles_set_updated_at
    BEFORE UPDATE ON user_profiles FOR EACH ROW
    EXECUTE FUNCTION queuesmart_set_updated_at();
CREATE TRIGGER services_set_updated_at
    BEFORE UPDATE ON services FOR EACH ROW
    EXECUTE FUNCTION queuesmart_set_updated_at();
CREATE TRIGGER queues_set_updated_at
    BEFORE UPDATE ON queues FOR EACH ROW
    EXECUTE FUNCTION queuesmart_set_updated_at();

-- Number waiting visits by priority, join time, then arrival sequence.
CREATE VIEW queue_positions AS
SELECT
    entry.*,
    queue.service_id,
    row_number() OVER (
        PARTITION BY entry.queue_id
        ORDER BY entry.priority DESC, entry.joined_at, entry.arrival_sequence
    ) AS position
FROM queue_entries AS entry
JOIN queues AS queue ON queue.id = entry.queue_id
WHERE entry.status = 'queued';

-- Finished visits; API queries must filter by the authenticated user.
CREATE VIEW user_queue_history AS
SELECT
    entry.*,
    queue.service_id,
    entry.service_name_snapshot AS service_name,
    CASE WHEN entry.status = 'served' THEN
        extract(epoch FROM (entry.service_started_at - entry.joined_at)) / 60.0
    ELSE NULL END AS wait_minutes
FROM queue_entries AS entry
JOIN queues AS queue ON queue.id = entry.queue_id
WHERE entry.status IN ('served', 'left');


COMMIT;
