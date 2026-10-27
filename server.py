"""Small internal dashboard server. Run behind authenticated ingress for shared use."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import os
import threading
import uuid

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get('CALIBRATION_DATA_DIR', ROOT / 'data'))
LOCK = threading.Lock()


def load():
    working = DATA_DIR / 'working.json'
    return json.loads((working if working.exists() else DATA_DIR / 'source.json').read_text())


def validate(record):
    if not isinstance(record, dict):
        raise ValueError('ข้อมูลต้องเป็น object')
    for key in ['tag', 'description', 'workshop', 'type', 'frequency', 'owner', 'remarks']:
        if not isinstance(record.get(key), str) or len(record[key]) > 1000:
            raise ValueError('ข้อมูลไม่ถูกต้อง: ' + key)
    for key in ['description', 'workshop', 'type']:
        if not record[key].strip():
            raise ValueError('กรุณาระบุ ' + key)
    if record.get('scope') not in ['all', 'critical']:
        raise ValueError('ขอบเขตไม่ถูกต้อง')
    for key in ['plan', 'actual']:
        values = record.get(key)
        if not isinstance(values, list) or len(values) != 12 or any(type(v) is not int or not 0 <= v <= 1000 for v in values):
            raise ValueError('จำนวนงานรายเดือนต้องเป็นจำนวนเต็ม 0–1000')
    values = record.get('errors')
    if not isinstance(values, list) or len(values) != 12 or any(v is not None and (type(v) not in [int, float] or not -1e9 < v < 1e9) for v in values):
        raise ValueError('ค่าอ่านไม่ถูกต้อง')


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'web'), **kwargs)

    def reply(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/api/data':
            return self.reply(200, load())
        return super().do_GET()

    def do_POST(self):
        if self.path != '/api/records':
            return self.reply(404, {'error': 'Not found'})
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            return self.reply(403, {'error': 'Cross-site request denied'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length < 100000:
                raise ValueError('ขนาดคำขอไม่ถูกต้อง')
            record = json.loads(self.rfile.read(length))
            validate(record)
            with LOCK:
                dataset = load()
                old = next((x for x in dataset['records'] if x['id'] == record.get('id')), None)
                if record.get('id') and not old:
                    return self.reply(404, {'error': 'ไม่พบรายการ'})
                if old and old['scope'] != record['scope']:
                    raise ValueError('ไม่สามารถเปลี่ยนขอบเขตของรายการเดิม')
                if old and old.get('revision', 0) != record.get('revision', 0):
                    return self.reply(409, {'error': 'มีการแก้ไขรายการนี้แล้ว กรุณารีเฟรชหน้าและเปิดรายการใหม่'})
                if not record['tag'].strip() and (not old or old['tag']):
                    raise ValueError('กรุณาระบุ TAG')
                if record['tag'] and any(x['id'] != record.get('id') and x['scope'] == record['scope'] and x['tag'].casefold() == record['tag'].casefold() for x in dataset['records']):
                    raise ValueError('TAG นี้มีอยู่แล้วในขอบเขตที่เลือก')
                # Keep workbook provenance immutable across manual updates.
                record['sourceRow'] = old.get('sourceRow') if old else None
                record['sourceNotes'] = old.get('sourceNotes', [''] * 12) if old else [''] * 12
                record['revision'] = old.get('revision', 0) + 1 if old else 1
                if old:
                    record['id'] = old['id']
                    dataset['records'][dataset['records'].index(old)] = record
                else:
                    record['id'] = str(uuid.uuid4())
                    dataset['records'].append(record)
                path = DATA_DIR / 'working.json'
                temporary = path.with_suffix('.tmp')
                with temporary.open('w') as handle:
                    json.dump(dataset, handle, ensure_ascii=False, indent=2)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary, path)
            self.reply(200, record)
        except (ValueError, KeyError, TypeError) as error:
            self.reply(400, {'error': str(error)})


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=3000)
    parser.add_argument('--host', default='0.0.0.0')
    args = parser.parse_args()
    print(f'Calibration dashboard running on port {args.port}', flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
