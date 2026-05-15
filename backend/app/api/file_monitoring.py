import json, os, urllib.parse, urllib.request
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import psycopg2, psycopg2.extras
from fastapi import APIRouter, Query

router = APIRouter()
_COLS: Dict[str, List[str]] = {}

def _env_files() -> Dict[str, str]:
    out: Dict[str, str] = {}
    for path in [Path('/root/shield-monitor-platform-v2/backend/.env'), Path('/root/shield-monitor-platform-v2/.env'), Path('.env')]:
        if not path.exists():
            continue
        for line in path.read_text(encoding='utf-8', errors='ignore').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out

def _dsn() -> str:
    fenv = _env_files()
    for k in ['DATABASE_URL', 'POSTGRES_DSN', 'PG_DSN', 'DB_URL']:
        v = os.getenv(k) or fenv.get(k)
        if v:
            return v.replace('postgresql+psycopg2://', 'postgresql://')
    host = os.getenv('POSTGRES_HOST') or fenv.get('POSTGRES_HOST') or os.getenv('PGHOST') or '127.0.0.1'
    port = os.getenv('POSTGRES_PORT') or fenv.get('POSTGRES_PORT') or os.getenv('PGPORT') or '5432'
    db = os.getenv('POSTGRES_DB') or fenv.get('POSTGRES_DB') or os.getenv('PGDATABASE') or 'shield_monitor'
    user = os.getenv('POSTGRES_USER') or fenv.get('POSTGRES_USER') or os.getenv('PGUSER') or 'postgres'
    pwd = os.getenv('POSTGRES_PASSWORD') or fenv.get('POSTGRES_PASSWORD') or os.getenv('PGPASSWORD') or ''
    parts = [f'host={host}', f'port={port}', f'dbname={db}', f'user={user}']
    if pwd:
        parts.append(f'password={pwd}')
    return ' '.join(parts)

def _conn():
    return psycopg2.connect(_dsn(), cursor_factory=psycopg2.extras.RealDictCursor)

def _safe(v: Any) -> Any:
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dict):
        return {k: _safe(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_safe(x) for x in v]
    return v

def _ok(data: Any, source: str = 'file', message: Optional[str] = None):
    if isinstance(data, dict):
        data.setdefault('source', source)
    resp = {'code': 0, 'data': _safe(data)}
    if message:
        resp['message'] = message
    return resp

def _err(msg: str, code: int = 500):
    return {'code': code, 'data': None, 'message': msg}

def _cols(table: str) -> List[str]:
    if table in _COLS:
        return _COLS[table]
    try:
        with _conn() as c, c.cursor() as cur:
            cur.execute("select column_name from information_schema.columns where table_schema='public' and table_name=%s order by ordinal_position", (table,))
            _COLS[table] = [r['column_name'] for r in cur.fetchall()]
    except Exception:
        _COLS[table] = []
    return _COLS[table]

def _exists(t: str) -> bool:
    return bool(_cols(t))

def _pick(t: str, names: List[str]) -> Optional[str]:
    cs = set(_cols(t))
    for n in names:
        if n in cs:
            return n
    return None

def _sel(t: str, a: str, names: List[str], out: str) -> str:
    col = _pick(t, names)
    return f'{a}."{col}" AS "{out}"' if col else f'NULL AS "{out}"'

def _page(page: int, page_size: int) -> Tuple[int, int, int]:
    p = max(1, int(page or 1)); ps = min(max(1, int(page_size or 50)), 500)
    return p, ps, (p - 1) * ps

def _rows(sql: str, params: List[Any]) -> List[Dict[str, Any]]:
    with _conn() as c, c.cursor() as cur:
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]

def _one(sql: str, params: List[Any]) -> Optional[Dict[str, Any]]:
    rows = _rows(sql, params)
    return rows[0] if rows else None

def _count(t: str) -> int:
    if not _exists(t):
        return 0
    try:
        return int((_one(f'SELECT count(*) AS c FROM "{t}"', []) or {}).get('c') or 0)
    except Exception:
        return 0

def _where_date(where: List[str], params: List[Any], expr: Optional[str], a: Optional[str], b: Optional[str]):
    if not expr: return
    if a: where.append(f'{expr} >= %s'); params.append(a)
    if b: where.append(f'{expr} <= %s'); params.append(b)

def _where_eq(where: List[str], params: List[Any], expr: Optional[str], v: Optional[str]):
    if expr and v is not None: where.append(f'{expr} = %s'); params.append(v)

def _where_like(where: List[str], params: List[Any], expr: Optional[str], v: Optional[str]):
    if expr and v: where.append(f'{expr} ILIKE %s'); params.append(f'%{v}%')

@router.get('/api/file-health')
def file_health():
    try:
        return _ok({'database': 'shield_monitor', 'tables': {
            'source_document': _count('source_document'), 'monitoring_point': _count('monitoring_point'),
            'monitoring_reading': _count('monitoring_reading'), 'extraction_evidence': _count('extraction_evidence'),
            'stg_file_daily_report_meta': _count('stg_file_daily_report_meta'),
            'stg_file_extracted_page': _count('stg_file_extracted_page'),
            'stg_file_data_quality_issue': _count('stg_file_data_quality_issue')}}, 'file')
    except Exception as e:
        return _err(str(e))

@router.get('/api/documents')
def documents(type: Optional[str] = None, dateFrom: Optional[str] = None, dateTo: Optional[str] = None, keyword: Optional[str] = None, page: int = 1, pageSize: int = 50):
    t = 'source_document'
    if not _exists(t): return _err('source_document table not found')
    p, ps, off = _page(page, pageSize); where: List[str] = []; params: List[Any] = []
    file_type = _pick(t, ['file_type','document_type','type']); doc_date = _pick(t, ['document_date','report_date','date','created_at']); file_name = _pick(t, ['file_name','filename','name','original_name'])
    _where_eq(where, params, f'd."{file_type}"' if file_type else None, type)
    _where_date(where, params, f'd."{doc_date}"' if doc_date else None, dateFrom, dateTo)
    _where_like(where, params, f'd."{file_name}"' if file_name else None, keyword)
    w = 'WHERE ' + ' AND '.join(where) if where else ''; order = f'ORDER BY d."{doc_date or file_name}" DESC NULLS LAST' if (doc_date or file_name) else ''
    select = [_sel(t,'d',['source_id','source_document_id','id'],'sourceId'), _sel(t,'d',['file_name','filename','name','original_name'],'fileName'), _sel(t,'d',['file_type','document_type','type'],'fileType'), _sel(t,'d',['document_date','report_date','date'],'documentDate'), _sel(t,'d',['storage_path','file_path','path'],'storagePath'), _sel(t,'d',['description','summary','remark'],'description'), _sel(t,'d',['created_at','create_time','imported_at'],'createdAt')]
    return _ok({'items': _rows(f'SELECT {", ".join(select)} FROM "{t}" d {w} {order} LIMIT %s OFFSET %s', params + [ps, off]), 'page': p, 'pageSize': ps}, 'file')

@router.get('/api/documents/{sourceId}')
def document_detail(sourceId: str):
    t = 'source_document'; id_col = _pick(t, ['source_id','source_document_id','id'])
    if not id_col: return _err('source_document id column not found')
    return _ok(_one(f'SELECT * FROM "{t}" WHERE "{id_col}"::text=%s LIMIT 1', [sourceId]), 'file')

@router.get('/api/documents/{sourceId}/pages')
def document_pages(sourceId: str, page: int = 1, pageSize: int = 100):
    t = 'stg_file_extracted_page'
    if not _exists(t): return _ok({'items': []}, 'file_staging', 'stg_file_extracted_page table not found')
    p, ps, off = _page(page, pageSize); sid = _pick(t, ['source_document_id','source_id','document_id'])
    w = f'WHERE e."{sid}"::text=%s' if sid else ''; params = [sourceId] if sid else []
    select = [_sel(t,'e',['page_no','page_number','page'],'pageNo'), _sel(t,'e',['sheet_name','sheet'],'sheetName'), _sel(t,'e',['content_type','type'],'contentType'), _sel(t,'e',['raw_text','text','page_text'],'rawText'), _sel(t,'e',['table_json','tables_json'],'tableJson'), _sel(t,'e',['extraction_status','status'],'extractionStatus'), _sel(t,'e',['extraction_error','error'],'extractionError')]
    order_col = _pick(t, ['page_no','page_number','id']); order = f'ORDER BY e."{order_col}" NULLS LAST' if order_col else ''
    return _ok({'items': _rows(f'SELECT {", ".join(select)} FROM "{t}" e {w} {order} LIMIT %s OFFSET %s', params + [ps, off]), 'page': p, 'pageSize': ps}, 'file_staging')

@router.get('/api/reports/daily')
def daily_reports(dateFrom: Optional[str] = None, dateTo: Optional[str] = None, page: int = 1, pageSize: int = 50):
    t = 'stg_file_daily_report_meta'
    if not _exists(t): return _ok({'items': []}, 'file_staging', 'stg_file_daily_report_meta table not found')
    p, ps, off = _page(page, pageSize); rd = _pick(t, ['report_date','document_date','date']); where: List[str] = []; params: List[Any] = []
    _where_date(where, params, f'r."{rd}"' if rd else None, dateFrom, dateTo); w = 'WHERE ' + ' AND '.join(where) if where else ''; order = f'ORDER BY r."{rd}" DESC NULLS LAST' if rd else ''
    select = [_sel(t,'r',['source_document_id','source_id'],'sourceDocumentId'), _sel(t,'r',['file_name','filename'],'fileName'), _sel(t,'r',['report_no','report_number'],'reportNo'), _sel(t,'r',['report_date','document_date'],'reportDate'), _sel(t,'r',['project_name'],'projectName'), _sel(t,'r',['section_name'],'sectionName'), _sel(t,'r',['weather'],'weather'), _sel(t,'r',['shield_ring_no','ring_no','current_ring'],'shieldRingNo'), _sel(t,'r',['construction_mileage','mileage'],'constructionMileage'), _sel(t,'r',['evidence_text'],'evidenceText'), _sel(t,'r',['evidence_page_no','page_no'],'evidencePageNo')]
    return _ok({'items': _rows(f'SELECT {", ".join(select)} FROM "{t}" r {w} {order} LIMIT %s OFFSET %s', params + [ps, off]), 'page': p, 'pageSize': ps}, 'file_staging')

@router.get('/api/reports/latest')
def latest_report():
    t = 'stg_file_daily_report_meta'
    if not _exists(t): return _ok(None, 'file_staging')
    order_col = _pick(t, ['report_date','document_date','date','id']); order = f'ORDER BY "{order_col}" DESC NULLS LAST' if order_col else ''
    return _ok(_one(f'SELECT * FROM "{t}" {order} LIMIT 1', []), 'file_staging')

@router.get('/api/monitoring/points')
def monitoring_points(object: Optional[str] = None, item: Optional[str] = None, keyword: Optional[str] = None, page: int = 1, pageSize: int = 100):
    t = 'monitoring_point'
    if not _exists(t): return _err('monitoring_point table not found')
    p, ps, off = _page(page, pageSize); obj = _pick(t, ['monitoring_object','object','target_object']); itm = _pick(t, ['monitoring_item','item','measure_item']); code = _pick(t, ['point_code','code']); name = _pick(t, ['point_name','name'])
    where: List[str] = []; params: List[Any] = []; _where_eq(where, params, f'p."{obj}"' if obj else None, object); _where_eq(where, params, f'p."{itm}"' if itm else None, item)
    if keyword:
        ors=[]
        for c in [code,name,obj,itm]:
            if c: ors.append(f'p."{c}" ILIKE %s'); params.append(f'%{keyword}%')
        if ors: where.append('(' + ' OR '.join(ors) + ')')
    w = 'WHERE ' + ' AND '.join(where) if where else ''; order = f'ORDER BY p."{code or name}"' if (code or name) else ''
    select = [_sel(t,'p',['point_id','monitoring_point_id','id'],'pointId'), _sel(t,'p',['point_code','code'],'pointCode'), _sel(t,'p',['point_name','name'],'pointName'), _sel(t,'p',['monitoring_object','object','target_object'],'monitoringObject'), _sel(t,'p',['monitoring_item','item','measure_item'],'monitoringItem'), _sel(t,'p',['mileage'],'mileage'), _sel(t,'p',['mileage_m','mileage_value'],'mileageM'), _sel(t,'p',['relative_position','position'],'relativePosition'), _sel(t,'p',['unit'],'unit'), _sel(t,'p',['warning_threshold'],'warningThreshold'), _sel(t,'p',['alarm_threshold'],'alarmThreshold'), _sel(t,'p',['source_id','source_document_id'],'sourceId')]
    return _ok({'items': _rows(f'SELECT {", ".join(select)} FROM "{t}" p {w} {order} LIMIT %s OFFSET %s', params + [ps, off]), 'page': p, 'pageSize': ps}, 'file')

@router.get('/api/monitoring/points/{pointCode}')
def monitoring_point_detail(pointCode: str, item: Optional[str] = None):
    t='monitoring_point'; code=_pick(t,['point_code','code']); itm=_pick(t,['monitoring_item','item','measure_item'])
    if not code: return _err('monitoring_point point_code column not found')
    where=[f'"{code}"=%s']; params=[pointCode]
    if item and itm: where.append(f'"{itm}"=%s'); params.append(item)
    return _ok(_rows(f'SELECT * FROM "{t}" WHERE {" AND ".join(where)} LIMIT 20', params), 'file')

def _reading_select_join():
    rt='monitoring_reading'; pt='monitoring_point'; rc=set(_cols(rt)); pc=set(_cols(pt))
    if 'point_id' in rc and 'point_id' in pc: join='LEFT JOIN "monitoring_point" p ON r."point_id"=p."point_id"'
    elif 'monitoring_point_id' in rc and 'point_id' in pc: join='LEFT JOIN "monitoring_point" p ON r."monitoring_point_id"=p."point_id"'
    elif 'point_code' in rc and 'point_code' in pc: join='LEFT JOIN "monitoring_point" p ON r."point_code"=p."point_code"'
    else: join='LEFT JOIN "monitoring_point" p ON false'
    def co(rn, pn, out):
        expr=[f'r."{c}"' for c in rn if c in rc] + [f'p."{c}"' for c in pn if c in pc]
        return ('COALESCE(' + ', '.join(expr) + f') AS "{out}"') if expr else f'NULL AS "{out}"'
    date_col = next((c for c in ['measured_at','measure_date','reading_time'] if c in rc), None)
    select=[co(['reading_id','id'],[],'readingId'), co(['point_code'],['point_code','code'],'pointCode'), co(['monitoring_item','item'],['monitoring_item','item','measure_item'],'monitoringItem'), co(['measured_at','measure_date','reading_time'],[],'measuredAt'), co(['current_value'],[],'currentValue'), co(['cumulative_change','accumulated_change'],[],'cumulativeChange'), co(['change_rate','daily_change','single_change'],[],'changeRate'), co(['alert_level','status_code','level'],[],'alertLevel'), co(['source_id','source_document_id'],[],'sourceId')]
    return ', '.join(select), join, date_col

@router.get('/api/monitoring/readings')
def monitoring_readings(pointCode: Optional[str] = None, item: Optional[str] = None, dateFrom: Optional[str] = None, dateTo: Optional[str] = None, page: int = 1, pageSize: int = 500):
    rt='monitoring_reading'
    if not _exists(rt): return _err('monitoring_reading table not found')
    p, ps, off=_page(page,pageSize); select, join, date_col=_reading_select_join(); rc=set(_cols(rt)); pc=set(_cols('monitoring_point')); where=[]; params=[]
    if pointCode:
        where.append('r."point_code"=%s' if 'point_code' in rc else 'p."point_code"=%s'); params.append(pointCode)
    if item:
        if 'monitoring_item' in rc: where.append('r."monitoring_item"=%s')
        elif 'item' in rc: where.append('r."item"=%s')
        elif 'monitoring_item' in pc: where.append('p."monitoring_item"=%s')
        params.append(item)
    _where_date(where, params, f'r."{date_col}"' if date_col else None, dateFrom, dateTo); w='WHERE '+' AND '.join(where) if where else ''; order=f'ORDER BY r."{date_col}" ASC NULLS LAST' if date_col else ''
    return _ok({'items': _rows(f'SELECT {select} FROM "{rt}" r {join} {w} {order} LIMIT %s OFFSET %s', params+[ps,off]), 'page': p, 'pageSize': ps}, 'file')

@router.get('/api/monitoring/latest-readings')
def latest_readings(limit: int = 100):
    return monitoring_readings(page=1, pageSize=min(max(1, int(limit)), 500))

@router.get('/api/monitoring/alerts')
def monitoring_alerts(level: Optional[str] = None, page: int = 1, pageSize: int = 200):
    rt='monitoring_reading'
    if not _exists(rt): return _err('monitoring_reading table not found')
    p, ps, off=_page(page,pageSize); select, join, date_col=_reading_select_join(); lvl=_pick(rt,['alert_level','status_code','level']); where=[]; params=[]
    if level and lvl: where.append(f'r."{lvl}"=%s'); params.append(level)
    elif lvl: where.append(f'COALESCE(r."{lvl}"::text, \'\') NOT IN (\'\', \'normal\', \'正常\')')
    w='WHERE '+' AND '.join(where) if where else ''; order=f'ORDER BY r."{date_col}" DESC NULLS LAST' if date_col else ''
    return _ok({'items': _rows(f'SELECT {select} FROM "{rt}" r {join} {w} {order} LIMIT %s OFFSET %s', params+[ps,off]), 'page': p, 'pageSize': ps}, 'file')

@router.get('/api/evidence')
def evidence(sourceId: Optional[str] = None, readingId: Optional[str] = None, page: int = 1, pageSize: int = 100):
    t='extraction_evidence'
    if not _exists(t): return _ok({'items': []}, 'file', 'extraction_evidence table not found')
    p, ps, off=_page(page,pageSize); sid=_pick(t,['source_id','source_document_id']); rid=_pick(t,['reading_id','monitoring_reading_id']); where=[]; params=[]
    if sourceId and sid: where.append(f'e."{sid}"::text=%s'); params.append(sourceId)
    if readingId and rid: where.append(f'e."{rid}"::text=%s'); params.append(readingId)
    w='WHERE '+' AND '.join(where) if where else ''
    select=[_sel(t,'e',['evidence_id','id'],'evidenceId'), _sel(t,'e',['source_id','source_document_id'],'sourceId'), _sel(t,'e',['page_no','page_number'],'pageNo'), _sel(t,'e',['section_title'],'sectionTitle'), _sel(t,'e',['table_title'],'tableTitle'), _sel(t,'e',['row_index','row_no'],'rowIndex'), _sel(t,'e',['cell_text'],'cellText'), _sel(t,'e',['extracted_text','evidence_text'],'extractedText'), _sel(t,'e',['confidence'],'confidence'), _sel(t,'e',['created_at'],'createdAt')]
    return _ok({'items': _rows(f'SELECT {", ".join(select)} FROM "{t}" e {w} LIMIT %s OFFSET %s', params+[ps,off]), 'page': p, 'pageSize': ps}, 'file')

@router.get('/api/data-quality/issues')
def data_quality_issues(severity: Optional[str] = None, category: Optional[str] = None, sourceDocumentId: Optional[str] = None, page: int = 1, pageSize: int = 100):
    t='stg_file_data_quality_issue'
    if not _exists(t): return _ok({'items': []}, 'file_staging')
    p, ps, off=_page(page,pageSize); sev=_pick(t,['severity']); cat=_pick(t,['category','issue_category']); src=_pick(t,['source_document_id','source_id']); where=[]; params=[]
    _where_eq(where, params, f'q."{sev}"' if sev else None, severity); _where_eq(where, params, f'q."{cat}"' if cat else None, category); _where_eq(where, params, f'q."{src}"::text' if src else None, sourceDocumentId)
    w='WHERE '+' AND '.join(where) if where else ''
    return _ok({'items': _rows(f'SELECT * FROM "{t}" q {w} LIMIT %s OFFSET %s', params+[ps,off]), 'page': p, 'pageSize': ps}, 'file_staging')

@router.get('/api/data-quality/summary')
def data_quality_summary():
    t='stg_file_data_quality_issue'
    if not _exists(t): return _ok({'totalIssueCount':0,'severityCount':{},'categoryCount':{},'affectedDocumentCount':0}, 'file_staging')
    total=_count(t); sev=_pick(t,['severity']); cat=_pick(t,['category','issue_category']); src=_pick(t,['source_document_id','source_id']); sev_count={}; cat_count={}; affected=0
    with _conn() as c, c.cursor() as cur:
        if sev:
            cur.execute(f'SELECT COALESCE("{sev}"::text, \'unknown\') AS k, count(*) AS c FROM "{t}" GROUP BY COALESCE("{sev}"::text, \'unknown\')')
            sev_count={str(r['k']): int(r['c']) for r in cur.fetchall()}
        if cat:
            cur.execute(f'SELECT COALESCE("{cat}"::text, \'unknown\') AS k, count(*) AS c FROM "{t}" GROUP BY COALESCE("{cat}"::text, \'unknown\')')
            cat_count={str(r['k']): int(r['c']) for r in cur.fetchall()}
        if src:
            cur.execute(f'SELECT count(DISTINCT "{src}") AS c FROM "{t}"')
            affected=int(cur.fetchone()['c'] or 0)
    return _ok({'totalIssueCount': total, 'severityCount': sev_count, 'categoryCount': cat_count, 'affectedDocumentCount': affected}, 'file_staging')

def _tbm(device_id: str):
    try:
        url='http://127.0.0.1:8100/api/tbm/frontend-summary?' + urllib.parse.urlencode({'deviceId': device_id})
        with urllib.request.urlopen(url, timeout=3) as resp:
            return json.loads(resp.read().decode('utf-8')).get('data')
    except Exception:
        return None

@router.get('/api/dashboard/overview')
def dashboard_overview(deviceId: str = 'DZ1360'):
    lvl=_pick('monitoring_reading',['alert_level','status_code','level']); summary={}
    if lvl and _exists('monitoring_reading'):
        with _conn() as c, c.cursor() as cur:
            cur.execute(f'SELECT COALESCE("{lvl}"::text, \'unknown\') AS k, count(*) AS c FROM "monitoring_reading" GROUP BY COALESCE("{lvl}"::text, \'unknown\')')
            summary={str(r['k']): int(r['c']) for r in cur.fetchall()}
    return _ok({'tbm': _tbm(deviceId), 'latestReport': latest_report().get('data'), 'monitoringSummary': {'pointCount': _count('monitoring_point'), 'readingCount': _count('monitoring_reading'), 'alertSummary': summary}, 'documentSummary': {'sourceDocumentCount': _count('source_document'), 'dailyReportCount': _count('stg_file_daily_report_meta')}, 'dataQualitySummary': data_quality_summary().get('data')}, 'aggregate')
