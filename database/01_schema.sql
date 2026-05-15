CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE source_document (
    source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    source_department TEXT,
    owner_name TEXT,
    version_label TEXT,
    document_date DATE,
    is_latest BOOLEAN DEFAULT TRUE,
    storage_path TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE extraction_evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES source_document(source_id),
    page_no INTEGER,
    section_title TEXT,
    table_title TEXT,
    row_index INTEGER,
    cell_text TEXT,
    extracted_text TEXT,
    confidence NUMERIC(5, 4),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE import_batch (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES source_document(source_id),
    data_category TEXT NOT NULL,
    original_sheet_name TEXT,
    header_row_index INTEGER DEFAULT 1,
    status TEXT DEFAULT 'uploaded',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT now(),
    committed_at TIMESTAMP
);

CREATE TABLE import_raw_row (
    raw_row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES import_batch(batch_id),
    row_no INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    normalized_data JSONB,
    validation_status TEXT DEFAULT 'pending',
    validation_errors JSONB,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE standard_field (
    field_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_category TEXT NOT NULL,
    field_key TEXT NOT NULL,
    field_name_cn TEXT NOT NULL,
    data_type TEXT NOT NULL,
    unit TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    description TEXT,
    UNIQUE(data_category, field_key)
);

CREATE TABLE field_alias (
    alias_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_category TEXT NOT NULL,
    standard_field_key TEXT NOT NULL,
    alias_name TEXT NOT NULL,
    priority INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(data_category, alias_name)
);

CREATE TABLE field_mapping (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES import_batch(batch_id),
    source_field_name TEXT NOT NULL,
    standard_field_key TEXT NOT NULL,
    unit_from TEXT,
    unit_to TEXT,
    transform_rule TEXT,
    confidence NUMERIC(5, 4),
    confirmed_by_user BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE unit_conversion (
    conversion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    physical_quantity TEXT NOT NULL,
    unit_from TEXT NOT NULL,
    unit_to TEXT NOT NULL,
    multiplier NUMERIC NOT NULL,
    offset NUMERIC DEFAULT 0,
    UNIQUE(physical_quantity, unit_from, unit_to)
);

CREATE TABLE project (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    contractor_name TEXT,
    mainline_start_mileage TEXT,
    mainline_end_mileage TEXT,
    mainline_length_km NUMERIC,
    description TEXT,
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE tunnel_section (
    section_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES project(project_id),
    section_name TEXT NOT NULL,
    start_mileage TEXT NOT NULL,
    end_mileage TEXT NOT NULL,
    start_mileage_m NUMERIC,
    end_mileage_m NUMERIC,
    length_m NUMERIC,
    tunnel_form TEXT,
    design_speed_kmh NUMERIC,
    max_burial_depth_m NUMERIC,
    geom GEOMETRY(LineString, 4326),
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE shield_machine (
    machine_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES project(project_id),
    machine_name TEXT NOT NULL,
    machine_code TEXT,
    shield_type TEXT,
    excavation_diameter_m NUMERIC,
    length_m NUMERIC,
    weight_t NUMERIC,
    max_working_pressure_bar NUMERIC,
    rated_torque_knm NUMERIC,
    max_thrust_kn NUMERIC,
    cutter_count INTEGER,
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE segment_spec (
    segment_spec_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES project(project_id),
    outer_diameter_m NUMERIC,
    inner_diameter_m NUMERIC,
    ring_width_m NUMERIC,
    segment_count INTEGER,
    concrete_grade TEXT,
    impermeability_grade TEXT,
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE ring_mileage_map (
    ring_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES tunnel_section(section_id),
    ring_no INTEGER NOT NULL,
    work_date DATE,
    start_mileage TEXT,
    end_mileage TEXT,
    start_mileage_m NUMERIC,
    end_mileage_m NUMERIC,
    construction_stage TEXT,
    is_actual BOOLEAN DEFAULT FALSE,
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(section_id, ring_no)
);

CREATE TABLE risk_source (
    risk_source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES tunnel_section(section_id),
    risk_name TEXT NOT NULL,
    risk_type TEXT,
    crossing_relation TEXT,
    start_mileage TEXT,
    end_mileage TEXT,
    start_mileage_m NUMERIC,
    end_mileage_m NUMERIC,
    min_horizontal_distance_m NUMERIC,
    min_vertical_distance_m NUMERIC,
    protection_level TEXT,
    risk_level TEXT DEFAULT 'medium',
    geom GEOMETRY(Geometry, 4326),
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE monitoring_point (
    point_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES tunnel_section(section_id),
    risk_source_id UUID REFERENCES risk_source(risk_source_id),
    point_code TEXT NOT NULL,
    point_name TEXT,
    monitoring_object TEXT,
    monitoring_item TEXT NOT NULL,
    mileage TEXT,
    mileage_m NUMERIC,
    relative_position TEXT,
    initial_value NUMERIC,
    unit TEXT,
    warning_threshold NUMERIC,
    alarm_threshold NUMERIC,
    geom GEOMETRY(Point, 4326),
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(section_id, point_code)
);

CREATE TABLE monitoring_reading (
    reading_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID REFERENCES monitoring_point(point_id),
    ring_id UUID REFERENCES ring_mileage_map(ring_id),
    measured_at TIMESTAMP NOT NULL,
    current_value NUMERIC,
    cumulative_change NUMERIC,
    change_rate NUMERIC,
    alert_level TEXT DEFAULT 'normal',
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE shield_ring_operation (
    operation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES tunnel_section(section_id),
    ring_id UUID REFERENCES ring_mileage_map(ring_id),
    ring_no INTEGER NOT NULL,
    recorded_at TIMESTAMP,
    advance_speed NUMERIC,
    face_pressure NUMERIC,
    total_thrust NUMERIC,
    cutter_torque NUMERIC,
    cutter_rotation_speed NUMERIC,
    penetration NUMERIC,
    slurry_in_flow NUMERIC,
    slurry_out_flow NUMERIC,
    slurry_in_density NUMERIC,
    slurry_out_density NUMERIC,
    alert_level TEXT DEFAULT 'normal',
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE slurry_record (
    slurry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES tunnel_section(section_id),
    ring_id UUID REFERENCES ring_mileage_map(ring_id),
    ring_no INTEGER,
    recorded_at TIMESTAMP,
    slurry_in_density NUMERIC,
    slurry_out_density NUMERIC,
    viscosity NUMERIC,
    sand_content NUMERIC,
    ph_value NUMERIC,
    water_loss NUMERIC,
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE grouting_record (
    grouting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES tunnel_section(section_id),
    ring_id UUID REFERENCES ring_mileage_map(ring_id),
    ring_no INTEGER,
    recorded_at TIMESTAMP,
    grouting_volume NUMERIC,
    grouting_pressure NUMERIC,
    material_ratio TEXT,
    is_secondary_grouting BOOLEAN DEFAULT FALSE,
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE event_log (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID REFERENCES tunnel_section(section_id),
    ring_id UUID REFERENCES ring_mileage_map(ring_id),
    risk_source_id UUID REFERENCES risk_source(risk_source_id),
    event_time TIMESTAMP NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    description TEXT,
    possible_cause TEXT,
    handling_action TEXT,
    is_shutdown BOOLEAN DEFAULT FALSE,
    closure_result TEXT,
    responsible_party TEXT,
    source_id UUID REFERENCES source_document(source_id),
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_ring_section_no ON ring_mileage_map(section_id, ring_no);
CREATE INDEX idx_ring_mileage_m ON ring_mileage_map(start_mileage_m, end_mileage_m);
CREATE INDEX idx_risk_section_mileage ON risk_source(section_id, start_mileage_m, end_mileage_m);
CREATE INDEX idx_monitoring_reading_point_time ON monitoring_reading(point_id, measured_at);
CREATE INDEX idx_operation_section_ring ON shield_ring_operation(section_id, ring_no);
CREATE INDEX idx_event_section_time ON event_log(section_id, event_time DESC);
