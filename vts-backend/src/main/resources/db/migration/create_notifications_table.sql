-- Table: public.notifications
-- Stores fleet alerts to prevent duplicate notifications
-- Only creates notification when alert value changes from No to Yes

CREATE SEQUENCE IF NOT EXISTS public.notifications_id_seq;

CREATE TABLE IF NOT EXISTS public.notifications
(
    id bigint NOT NULL DEFAULT nextval('public.notifications_id_seq'),
    vehicle_id character varying(50) NOT NULL,
    driver_name character varying(100),
    alert_type character varying(50) NOT NULL,
    description text,
    lat numeric(38,2),
    lng numeric(38,2),
    event_timestamp timestamp without time zone NOT NULL,
    is_resolved boolean DEFAULT false,
    resolved_at timestamp without time zone,
    client_id bigint,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

-- Index for querying active notifications
CREATE INDEX IF NOT EXISTS idx_notifications_vehicle_alert
    ON public.notifications (vehicle_id, alert_type, is_resolved);

-- Index for querying by client
CREATE INDEX IF NOT EXISTS idx_notifications_client
    ON public.notifications (client_id);

-- Index for querying by timestamp
CREATE INDEX IF NOT EXISTS idx_notifications_event_timestamp
    ON public.notifications (event_timestamp DESC);
