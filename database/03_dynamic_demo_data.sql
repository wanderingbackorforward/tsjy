BEGIN;

-- 清理会影响页面展示的动态数据
DELETE FROM event_log;
DELETE FROM grouting_record;
DELETE FROM slurry_record;
DELETE FROM shield_ring_operation;
DELETE FROM monitoring_reading;
DELETE FROM monitoring_point;

-- 1. 重新生成盾构掘进参数：250~392 环
INSERT INTO shield_ring_operation (
    section_id,
    ring_id,
    ring_no,
    recorded_at,
    advance_speed,
    face_pressure,
    total_thrust,
    cutter_torque,
    cutter_rotation_speed,
    penetration,
    slurry_in_flow,
    slurry_out_flow,
    slurry_in_density,
    slurry_out_density,
    alert_level
)
SELECT
    r.section_id,
    r.ring_id,
    r.ring_no,
    COALESCE(r.work_date, DATE '2024-04-01')::timestamp + interval '10 hours',
    round((3.2 + sin(r.ring_no / 8.0) * 0.8 + CASE WHEN r.ring_no BETWEEN 322 AND 392 THEN -0.4 ELSE 0 END)::numeric, 2),
    round((0.32 + (r.ring_no - 250) * 0.0018 + CASE WHEN r.ring_no BETWEEN 322 AND 392 THEN 0.08 ELSE 0 END)::numeric, 3),
    round((32000 + (r.ring_no - 250) * 85 + CASE WHEN r.ring_no BETWEEN 322 AND 392 THEN 2500 ELSE 0 END)::numeric, 0),
    round((15500 + sin(r.ring_no / 5.0) * 1800 + CASE WHEN r.ring_no BETWEEN 330 AND 350 THEN 2200 ELSE 0 END)::numeric, 0),
    round((0.75 + sin(r.ring_no / 12.0) * 0.12)::numeric, 2),
    round((4.8 + sin(r.ring_no / 7.0) * 0.9)::numeric, 2),
    round((2800 + sin(r.ring_no / 9.0) * 120)::numeric, 0),
    round((2760 + sin(r.ring_no / 10.0) * 130)::numeric, 0),
    round((1.08 + sin(r.ring_no / 6.0) * 0.015)::numeric, 3),
    round((1.15 + sin(r.ring_no / 6.0) * 0.018)::numeric, 3),
    CASE
        WHEN r.ring_no BETWEEN 332 AND 345 THEN 'warning'
        ELSE 'normal'
    END
FROM ring_mileage_map r
WHERE r.section_id = '33333333-3333-3333-3333-333333333333'
  AND r.ring_no BETWEEN 250 AND 392
ORDER BY r.ring_no;

-- 2. 生成监测点
INSERT INTO monitoring_point (
    section_id,
    risk_source_id,
    point_code,
    point_name,
    monitoring_object,
    monitoring_item,
    mileage,
    mileage_m,
    relative_position,
    initial_value,
    unit,
    warning_threshold,
    alarm_threshold
)
VALUES
('33333333-3333-3333-3333-333333333333', (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 0), 'DB-JH-001', '京沪高铁地表沉降点1', '地表', 'surface_settlement', 'DK54+372', 54372, '线路左侧', 0, 'mm', 20, 25),
('33333333-3333-3333-3333-333333333333', (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 0), 'DB-JH-002', '京沪高铁地表沉降点2', '地表', 'surface_settlement', 'DK54+390', 54390, '线路中心', 0, 'mm', 20, 25),
('33333333-3333-3333-3333-333333333333', (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 0), 'GX-JH-001', '京沪高铁管线位移点1', '管线', 'pipeline_vertical_displacement', 'DK54+410', 54410, '线路右侧', 0, 'mm', 15, 20),

('33333333-3333-3333-3333-333333333333', (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 2), 'DB-TYB-001', '亭苑B区沉降点1', '建筑物', 'building_vertical_displacement', 'DK55+675', 55675, '侧穿建筑物', 0, 'mm', 16, 20),
('33333333-3333-3333-3333-333333333333', (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 2), 'DB-TYB-002', '亭苑B区沉降点2', '建筑物', 'building_vertical_displacement', 'DK55+695', 55695, '侧穿建筑物', 0, 'mm', 16, 20),

('33333333-3333-3333-3333-333333333333', (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 3), 'DT3-001', '地铁3号线结构位移点1', '地铁结构', 'tunnel_vertical_displacement', 'DK55+995', 55995, '下穿结构', 0, 'mm', 12, 18),
('33333333-3333-3333-3333-333333333333', (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 3), 'DT3-002', '地铁3号线结构位移点2', '地铁结构', 'tunnel_horizontal_displacement', 'DK56+010', 56010, '下穿结构', 0, 'mm', 8, 12),

('33333333-3333-3333-3333-333333333333', (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m DESC LIMIT 1), 'DSL-001', '东沙湖地表沉降点1', '地表', 'surface_settlement', 'DK58+100', 58100, '湖区范围', 0, 'mm', 20, 25),
('33333333-3333-3333-3333-333333333333', (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m DESC LIMIT 1), 'DSL-002', '东沙湖水域监测点2', '地表', 'surface_settlement', 'DK58+260', 58260, '湖区范围', 0, 'mm', 20, 25);

-- 3. 给每个监测点生成 14 天时序数据
INSERT INTO monitoring_reading (
    point_id,
    ring_id,
    measured_at,
    current_value,
    cumulative_change,
    change_rate,
    alert_level
)
SELECT
    mp.point_id,
    r.ring_id,
    TIMESTAMP '2024-04-01 08:00:00' + (d.day_no || ' days')::interval,
    round((-0.8 * d.day_no - CASE
        WHEN mp.point_code LIKE 'DB-JH%' THEN d.day_no * 0.35
        WHEN mp.point_code LIKE 'DB-TYB%' THEN d.day_no * 0.55
        WHEN mp.point_code LIKE 'DT3%' THEN d.day_no * 0.28
        ELSE d.day_no * 0.22
    END + sin(d.day_no / 2.0) * 0.6)::numeric, 2),
    round((-0.8 * d.day_no - CASE
        WHEN mp.point_code LIKE 'DB-JH%' THEN d.day_no * 0.35
        WHEN mp.point_code LIKE 'DB-TYB%' THEN d.day_no * 0.55
        WHEN mp.point_code LIKE 'DT3%' THEN d.day_no * 0.28
        ELSE d.day_no * 0.22
    END + sin(d.day_no / 2.0) * 0.6)::numeric, 2),
    round((-0.8 - CASE
        WHEN mp.point_code LIKE 'DB-JH%' THEN 0.35
        WHEN mp.point_code LIKE 'DB-TYB%' THEN 0.55
        WHEN mp.point_code LIKE 'DT3%' THEN 0.28
        ELSE 0.22
    END + cos(d.day_no / 2.0) * 0.2)::numeric, 2),
    CASE
        WHEN abs(-0.8 * d.day_no - CASE
            WHEN mp.point_code LIKE 'DB-JH%' THEN d.day_no * 0.35
            WHEN mp.point_code LIKE 'DB-TYB%' THEN d.day_no * 0.55
            WHEN mp.point_code LIKE 'DT3%' THEN d.day_no * 0.28
            ELSE d.day_no * 0.22
        END) >= mp.alarm_threshold THEN 'alarm'
        WHEN abs(-0.8 * d.day_no - CASE
            WHEN mp.point_code LIKE 'DB-JH%' THEN d.day_no * 0.35
            WHEN mp.point_code LIKE 'DB-TYB%' THEN d.day_no * 0.55
            WHEN mp.point_code LIKE 'DT3%' THEN d.day_no * 0.28
            ELSE d.day_no * 0.22
        END) >= mp.warning_threshold THEN 'warning'
        ELSE 'normal'
    END
FROM monitoring_point mp
CROSS JOIN generate_series(0, 13) AS d(day_no)
LEFT JOIN ring_mileage_map r
    ON r.section_id = mp.section_id
   AND r.ring_no = 323 + d.day_no
ORDER BY mp.point_code, d.day_no;

-- 4. 生成泥水记录
INSERT INTO slurry_record (
    section_id,
    ring_id,
    ring_no,
    recorded_at,
    slurry_in_density,
    slurry_out_density,
    viscosity,
    sand_content,
    ph_value,
    water_loss
)
SELECT
    r.section_id,
    r.ring_id,
    r.ring_no,
    COALESCE(r.work_date, DATE '2024-04-01')::timestamp + interval '11 hours',
    round((1.08 + sin(r.ring_no / 9.0) * 0.01)::numeric, 3),
    round((1.16 + sin(r.ring_no / 8.0) * 0.015)::numeric, 3),
    round((22 + sin(r.ring_no / 7.0) * 3)::numeric, 2),
    round((3.5 + sin(r.ring_no / 6.0) * 1.2)::numeric, 2),
    round((8.1 + sin(r.ring_no / 5.0) * 0.3)::numeric, 2),
    round((10 + sin(r.ring_no / 4.0) * 2)::numeric, 2)
FROM ring_mileage_map r
WHERE r.section_id = '33333333-3333-3333-3333-333333333333'
  AND r.ring_no BETWEEN 320 AND 392;

-- 5. 生成注浆记录
INSERT INTO grouting_record (
    section_id,
    ring_id,
    ring_no,
    recorded_at,
    grouting_volume,
    grouting_pressure,
    material_ratio,
    is_secondary_grouting
)
SELECT
    r.section_id,
    r.ring_id,
    r.ring_no,
    COALESCE(r.work_date, DATE '2024-04-01')::timestamp + interval '12 hours',
    round((58 + sin(r.ring_no / 8.0) * 8 + CASE WHEN r.ring_no BETWEEN 332 AND 345 THEN 6 ELSE 0 END)::numeric, 2),
    round((0.35 + sin(r.ring_no / 10.0) * 0.05)::numeric, 2),
    '水泥浆 A:B=1:1',
    CASE WHEN r.ring_no BETWEEN 334 AND 338 THEN TRUE ELSE FALSE END
FROM ring_mileage_map r
WHERE r.section_id = '33333333-3333-3333-3333-333333333333'
  AND r.ring_no BETWEEN 320 AND 392;

-- 6. 生成事件/报警
INSERT INTO event_log (
    section_id,
    ring_id,
    risk_source_id,
    event_time,
    event_type,
    severity,
    description,
    possible_cause,
    handling_action,
    is_shutdown,
    closure_result,
    responsible_party
)
VALUES
(
    '33333333-3333-3333-3333-333333333333',
    (SELECT ring_id FROM ring_mileage_map WHERE section_id='33333333-3333-3333-3333-333333333333' AND ring_no=332),
    (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 0),
    TIMESTAMP '2024-04-02 09:30:00',
    'settlement_warning',
    'warning',
    '接近京沪高铁风险源区间，地表沉降速率上升',
    '盾构进入敏感穿越前段，地层扰动增大',
    '降低推进速度，复核切口压力，加强监测频率',
    FALSE,
    '持续跟踪',
    '监测组'
),
(
    '33333333-3333-3333-3333-333333333333',
    (SELECT ring_id FROM ring_mileage_map WHERE section_id='33333333-3333-3333-3333-333333333333' AND ring_no=336),
    (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 0),
    TIMESTAMP '2024-04-02 14:20:00',
    'face_pressure_abnormal',
    'warning',
    '第336环切口压力短时波动，已触发关注',
    '穿越敏感区段，泥水压力调整频繁',
    '调整进出浆流量，保持压力稳定',
    FALSE,
    '已处理，继续观察',
    '盾构司机'
),
(
    '33333333-3333-3333-3333-333333333333',
    (SELECT ring_id FROM ring_mileage_map WHERE section_id='33333333-3333-3333-3333-333333333333' AND ring_no=338),
    (SELECT risk_source_id FROM risk_source ORDER BY start_mileage_m LIMIT 1 OFFSET 0),
    TIMESTAMP '2024-04-03 10:10:00',
    'grouting_abnormal',
    'info',
    '同步注浆量较计划值偏高，已记录复核',
    '盾尾间隙变化，局部补偿注浆',
    '复核注浆压力与管片姿态',
    FALSE,
    '正常闭环',
    '注浆班组'
);

COMMIT;
