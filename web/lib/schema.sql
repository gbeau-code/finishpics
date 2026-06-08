CREATE TABLE meets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE heats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meet_id uuid REFERENCES meets(id) ON DELETE CASCADE,
  event_num text NOT NULL,
  round text NOT NULL,
  heat_num text NOT NULL,
  event_name text,
  image_path text NOT NULL,
  image_width int,
  image_height int,
  first_frame_time float,
  last_frame_time float,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE athletes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  heat_id uuid REFERENCES heats(id) ON DELETE CASCADE,
  bib text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  team text,
  finish_time float,
  place int,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id uuid REFERENCES athletes(id),
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  status text DEFAULT 'pending',
  customer_email text,
  amount_cents int DEFAULT 700,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON athletes(lower(first_name));
CREATE INDEX ON athletes(lower(last_name));
CREATE INDEX ON athletes(bib);
CREATE INDEX ON heats(meet_id);
CREATE INDEX ON athletes(heat_id);
