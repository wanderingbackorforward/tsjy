-- 固定演示 ID，方便前后端调试。

INSERT INTO source_document (
    source_id, file_name, file_type, source_department, owner_name, version_label, document_date, description
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '盾构始发及试掘进专项施工方案0313.pdf',
    'pdf',
    '技术部',
    '待确认',
    'v20240313',
    '2024-03-13',
    '总体方案、风险源、试掘进参数、监测阈值的框架源'
);

INSERT INTO project (
    project_id, project_name, contractor_name, mainline_start_mileage, mainline_end_mileage, mainline_length_km, description, source_id
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    '新建南通至宁波高速铁路站前Ⅰ标',
    '中铁十四局集团有限公司',
    'DK53+017',
    'DK66+121',
    13.104,
    '盾构可视化监控平台 Demo 项目',
    '11111111-1111-1111-1111-111111111111'
);

INSERT INTO tunnel_section (
    section_id, project_id, section_name, start_mileage, end_mileage, start_mileage_m, end_mileage_m, length_m,
    tunnel_form, design_speed_kmh, max_burial_depth_m, source_id
) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    '苏州东隧道盾构区间',
    'DK53+695',
    'DK59+129',
    53695,
    59129,
    5434,
    '单洞双线',
    350,
    58,
    '11111111-1111-1111-1111-111111111111'
);

INSERT INTO shield_machine (
    machine_id, project_id, machine_name, machine_code, shield_type, excavation_diameter_m, length_m, weight_t,
    max_working_pressure_bar, rated_torque_knm, max_thrust_kn, cutter_count, source_id
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    '通甬园梦号',
    'DZ1360',
    '泥水平衡盾构机',
    14.81,
    134,
    4200,
    10,
    42784,
    290943,
    270,
    '11111111-1111-1111-1111-111111111111'
);

INSERT INTO segment_spec (
    segment_spec_id, project_id, outer_diameter_m, inner_diameter_m, ring_width_m, segment_count,
    concrete_grade, impermeability_grade, source_id
) VALUES (
    '55555555-5555-5555-5555-555555555555',
    '22222222-2222-2222-2222-222222222222',
    14.3,
    13.1,
    2,
    10,
    'C60',
    'P12',
    '11111111-1111-1111-1111-111111111111'
);

INSERT INTO risk_source (
    risk_source_id, section_id, risk_name, risk_type, crossing_relation, start_mileage, end_mileage,
    start_mileage_m, end_mileage_m, min_horizontal_distance_m, min_vertical_distance_m, protection_level, risk_level, source_id
) VALUES
    ('60111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','京沪高铁','railway','下穿','DK54+370','DK54+450',54370,54450,NULL,10.84,'专项保护','high','11111111-1111-1111-1111-111111111111'),
    ('60222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','亭苑A区','building','侧穿','DK55+540','DK55+580',55540,55580,14.52,13.53,'重点监测','medium','11111111-1111-1111-1111-111111111111'),
    ('60333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333','亭苑B区','building','侧穿','DK55+670','DK55+710',55670,55710,2.55,16.36,'重点监测','high','11111111-1111-1111-1111-111111111111'),
    ('60444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','轨道交通3号线葑亭大道站','metro','下穿','DK55+990','DK56+025',55990,56025,NULL,1.81,'专项保护','high','11111111-1111-1111-1111-111111111111'),
    ('60555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','沪宁城际/京沪铁路','railway','下穿','DK56+620','DK56+705',56620,56705,NULL,51,'专项保护','medium','11111111-1111-1111-1111-111111111111'),
    ('60666666-6666-6666-6666-666666666666','33333333-3333-3333-3333-333333333333','梦达驰厂房','factory','下穿','DK57+440','DK57+560',57440,57560,NULL,26.434,'重点监测','medium','11111111-1111-1111-1111-111111111111'),
    ('60777777-7777-7777-7777-777777777777','33333333-3333-3333-3333-333333333333','罗斯蒂厂房','factory','下穿','DK57+640','DK57+940',57640,57940,NULL,22.15,'重点监测','medium','11111111-1111-1111-1111-111111111111'),
    ('60888888-8888-8888-8888-888888888888','33333333-3333-3333-3333-333333333333','东沙湖','river_lake','下穿','DK58+030','DK59+280',58030,59280,NULL,9.38,'水文监测','medium','11111111-1111-1111-1111-111111111111');

-- 环号-里程-日期映射。这里用 2m/环生成演示数据。
WITH rings AS (
    SELECT
        gs AS ring_no,
        (53695 + (gs - 1) * 2)::numeric AS start_m,
        (53695 + gs * 2)::numeric AS end_m,
        (DATE '2024-03-15' + ((gs - 1) / 8)::int) AS work_date
    FROM generate_series(1, 392) AS gs
)
INSERT INTO ring_mileage_map (
    section_id, ring_no, work_date, start_mileage, end_mileage, start_mileage_m, end_mileage_m,
    construction_stage, is_actual, source_id
)
SELECT
    '33333333-3333-3333-3333-333333333333',
    ring_no,
    work_date,
    'DK' || floor(start_m / 1000)::int || '+' || lpad((start_m::int % 1000)::text, 3, '0'),
    'DK' || floor(end_m / 1000)::int || '+' || lpad((end_m::int % 1000)::text, 3, '0'),
    start_m,
    end_m,
    CASE
        WHEN ring_no <= 50 THEN '试掘进'
        WHEN ring_no BETWEEN 322 AND 392 THEN '下穿京沪高铁及阳澄环路'
        ELSE '正常掘进'
    END,
    TRUE,
    '11111111-1111-1111-1111-111111111111'
FROM rings;

-- 监测点。
INSERT INTO monitoring_point (
    point_id, section_id, risk_source_id, point_code, point_name, monitoring_object, monitoring_item,
    mileage, mileage_m, relative_position, initial_value, unit, warning_threshold, alarm_threshold, source_id
) VALUES
    ('70111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','60111111-1111-1111-1111-111111111111','DB-001','京沪高铁地表沉降1','地表','surface_settlement','DK54+372',54372,'线路左侧',0,'mm',20,25,'11111111-1111-1111-1111-111111111111'),
    ('70222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333','60111111-1111-1111-1111-111111111111','DB-002','京沪高铁地表沉降2','地表','surface_settlement','DK54+420',54420,'线路右侧',0,'mm',20,25,'11111111-1111-1111-1111-111111111111'),
    ('70333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333','60333333-3333-3333-3333-333333333333','JZ-001','亭苑B区建筑物竖向位移','建筑物','building_vertical_displacement','DK55+680',55680,'亭苑B区',0,'mm',15,20,'11111111-1111-1111-1111-111111111111'),
    ('70444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','60444444-4444-4444-4444-444444444444','DT-001','地铁3号线车站沉降','地铁车站','surface_settlement','DK55+998',55998,'葑亭大道站',0,'mm',15,20,'11111111-1111-1111-1111-111111111111'),
    ('70555555-5555-5555-5555-555555555555','33333333-3333-3333-3333-333333333333','60888888-8888-8888-8888-888888888888','HS-001','东沙湖岸线沉降','水体岸线','surface_settlement','DK58+150',58150,'东沙湖岸线',0,'mm',20,25,'11111111-1111-1111-1111-111111111111');

-- 监测读数，给每个测点生成 12 天时序。
WITH days AS (
    SELECT generate_series(0, 11) AS d
), points AS (
    SELECT point_id, point_code FROM monitoring_point
)
INSERT INTO monitoring_reading (
    point_id, measured_at, current_value, cumulative_change, change_rate, alert_level, source_id
)
SELECT
    p.point_id,
    TIMESTAMP '2024-04-01 08:00:00' + (d.d || ' days')::interval,
    0,
    ROUND((-(d.d * 0.9 + (ascii(substr(p.point_code, 1, 1)) % 3) * 0.6))::numeric, 2),
    ROUND((-(0.6 + (d.d % 4) * 0.15))::numeric, 2),
    CASE
        WHEN d.d >= 10 AND p.point_code IN ('JZ-001') THEN 'warning'
        ELSE 'normal'
    END,
    '11111111-1111-1111-1111-111111111111'
FROM days d CROSS JOIN points p;

-- 盾构每环参数，围绕当前风险源段生成演示数据。
INSERT INTO shield_ring_operation (
    section_id, ring_id, ring_no, recorded_at, advance_speed, face_pressure, total_thrust,
    cutter_torque, cutter_rotation_speed, penetration, slurry_in_flow, slurry_out_flow,
    slurry_in_density, slurry_out_density, alert_level, source_id
)
SELECT
    r.section_id,
    r.ring_id,
    r.ring_no,
    r.work_date + TIME '10:00:00',
    ROUND((3.4 + (r.ring_no % 8) * 0.18)::numeric, 2),
    ROUND((0.32 + (r.ring_no % 12) * 0.015)::numeric, 2),
    ROUND((34000 + (r.ring_no % 30) * 210)::numeric, 0),
    ROUND((16500 + (r.ring_no % 25) * 120)::numeric, 0),
    ROUND((0.7 + (r.ring_no % 5) * 0.05)::numeric, 2),
    ROUND((4.8 + (r.ring_no % 6) * 0.25)::numeric, 2),
    ROUND((2600 + (r.ring_no % 10) * 30)::numeric, 0),
    ROUND((2580 + (r.ring_no % 10) * 28)::numeric, 0),
    ROUND((1.08 + (r.ring_no % 3) * 0.01)::numeric, 2),
    ROUND((1.15 + (r.ring_no % 4) * 0.01)::numeric, 2),
    CASE WHEN r.ring_no IN (334, 335, 336) THEN 'warning' ELSE 'normal' END,
    '11111111-1111-1111-1111-111111111111'
FROM ring_mileage_map r
WHERE r.ring_no BETWEEN 300 AND 392;

INSERT INTO slurry_record (
    section_id, ring_id, ring_no, recorded_at, slurry_in_density, slurry_out_density, viscosity,
    sand_content, ph_value, water_loss, source_id
)
SELECT
    section_id, ring_id, ring_no, work_date + TIME '11:00:00',
    1.09, 1.17, 22 + (ring_no % 4), 3.2 + (ring_no % 3) * 0.2, 8.1, 12 + (ring_no % 5),
    '11111111-1111-1111-1111-111111111111'
FROM ring_mileage_map
WHERE ring_no BETWEEN 320 AND 340;

INSERT INTO grouting_record (
    section_id, ring_id, ring_no, recorded_at, grouting_volume, grouting_pressure, material_ratio, is_secondary_grouting, source_id
)
SELECT
    section_id, ring_id, ring_no, work_date + TIME '12:30:00',
    12.5 + (ring_no % 4) * 0.6, 0.28 + (ring_no % 3) * 0.02, 'A:B=1:1', FALSE,
    '11111111-1111-1111-1111-111111111111'
FROM ring_mileage_map
WHERE ring_no BETWEEN 320 AND 340;

-- 事件。
INSERT INTO event_log (
    event_id, section_id, ring_id, risk_source_id, event_time, event_type, severity, description,
    possible_cause, handling_action, is_shutdown, closure_result, responsible_party, source_id
) VALUES
    ('80111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',
     (SELECT ring_id FROM ring_mileage_map WHERE ring_no = 334 LIMIT 1),
     '60111111-1111-1111-1111-111111111111',
     '2024-04-25 09:20:00','face_pressure_abnormal','warning','下穿高铁前切口压力波动接近控制范围上限',
     '地层扰动与泥水循环状态波动','降低推进速度，复核泥水比重和切口压力设定',FALSE,'已复核，持续观察','盾构班组','11111111-1111-1111-1111-111111111111'),
    ('80222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
     (SELECT ring_id FROM ring_mileage_map WHERE ring_no = 336 LIMIT 1),
     '60111111-1111-1111-1111-111111111111',
     '2024-04-25 14:10:00','settlement_alarm','warning','京沪高铁附近地表沉降测点变化速率上升',
     '下穿敏感区施工扰动','提高监测频率，控制推进速度和同步注浆量',FALSE,'未超报警值，继续跟踪','监测单位','11111111-1111-1111-1111-111111111111'),
    ('80333333-3333-3333-3333-333333333333','33333333-3333-3333-3333-333333333333',
     (SELECT ring_id FROM ring_mileage_map WHERE ring_no = 338 LIMIT 1),
     '60111111-1111-1111-1111-111111111111',
     '2024-04-26 10:05:00','grouting_abnormal','info','同步注浆压力短时偏低',
     '浆液供应波动','检查注浆泵状态并补充注浆记录',FALSE,'已恢复','施工单位','11111111-1111-1111-1111-111111111111');

-- 标准字段与别名。
INSERT INTO standard_field (data_category, field_key, field_name_cn, data_type, unit, is_required, description) VALUES
('shield_operation','ring_no','环号','integer',NULL,TRUE,'盾构环号'),
('shield_operation','recorded_at','时间戳','timestamp',NULL,TRUE,'记录时间'),
('shield_operation','advance_speed','推进速度','numeric','mm/min',TRUE,'盾构推进速度'),
('shield_operation','face_pressure','切口压力','numeric','bar',TRUE,'掌子面/切口压力'),
('shield_operation','total_thrust','总推力','numeric','kN',TRUE,'盾构总推力'),
('shield_operation','cutter_torque','刀盘扭矩','numeric','kN.m',TRUE,'刀盘扭矩'),
('shield_operation','cutter_rotation_speed','刀盘转速','numeric','r/min',FALSE,'刀盘转速'),
('shield_operation','penetration','贯入度','numeric','mm/r',FALSE,'贯入度'),
('monitoring_reading','point_code','测点编号','text',NULL,TRUE,'监测点编号'),
('monitoring_reading','measured_at','监测时间','timestamp',NULL,TRUE,'监测时间'),
('monitoring_reading','cumulative_change','累计变化','numeric','mm',TRUE,'累计沉降/位移'),
('monitoring_reading','change_rate','变化速率','numeric','mm/d',FALSE,'日变化速率');

INSERT INTO field_alias (data_category, standard_field_key, alias_name, priority) VALUES
('shield_operation','ring_no','环号',1),
('shield_operation','ring_no','施工环',2),
('shield_operation','recorded_at','时间',1),
('shield_operation','recorded_at','时间戳',1),
('shield_operation','recorded_at','施工日期',2),
('shield_operation','advance_speed','推进速度',1),
('shield_operation','advance_speed','掘进速度',2),
('shield_operation','face_pressure','切口压力',1),
('shield_operation','face_pressure','仓压',2),
('shield_operation','face_pressure','掌子面压力',3),
('shield_operation','face_pressure','泥水压力',4),
('shield_operation','total_thrust','总推力',1),
('shield_operation','total_thrust','推进力',2),
('shield_operation','cutter_torque','刀盘扭矩',1),
('shield_operation','cutter_torque','扭矩',2),
('shield_operation','cutter_rotation_speed','刀盘转速',1),
('shield_operation','penetration','贯入度',1),
('monitoring_reading','point_code','测点编号',1),
('monitoring_reading','measured_at','日期',1),
('monitoring_reading','measured_at','监测时间',1),
('monitoring_reading','cumulative_change','累计变化',1),
('monitoring_reading','cumulative_change','累计沉降',2),
('monitoring_reading','change_rate','变化速率',1);

INSERT INTO unit_conversion (physical_quantity, unit_from, unit_to, multiplier, offset) VALUES
('force','T','kN',9.80665,0),
('force','t','kN',9.80665,0),
('pressure','kPa','bar',0.01,0),
('pressure','MPa','bar',10,0),
('length','mm','m',0.001,0),
('length','m','mm',1000,0);
