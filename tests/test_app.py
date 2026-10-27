"""HTTP persistence and real-browser checks against an isolated temporary dataset."""
import copy
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]


class DashboardTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        shutil.copy(ROOT / 'data/source.json', cls.temp.name)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            cls.port = sock.getsockname()[1]
        cls.base = f'http://127.0.0.1:{cls.port}'
        cls.process = subprocess.Popen([sys.executable, str(ROOT / 'server.py'), '--port', str(cls.port), '--host', '127.0.0.1'], env={**os.environ, 'CALIBRATION_DATA_DIR': cls.temp.name}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                cls.get()
                return
            except OSError:
                time.sleep(.1)
        raise RuntimeError('Test server did not start')

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=5)
        cls.temp.cleanup()

    @classmethod
    def get(cls):
        with urlopen(cls.base + '/api/data') as response:
            return json.load(response)

    def post(self, record):
        request = Request(self.base + '/api/records', data=json.dumps(record).encode(), headers={'Content-Type': 'application/json'}, method='POST')
        try:
            with urlopen(request) as response:
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, json.load(error)

    def setUp(self):
        (Path(self.temp.name) / 'working.json').unlink(missing_ok=True)

    def test_source_totals_and_special_cells(self):
        data = self.get()['records']
        for scope, count, plan, actual in [('all', 387, 726, 431), ('critical', 111, 327, 154)]:
            rows = [r for r in data if r['scope'] == scope]
            self.assertEqual(len(rows), count)
            self.assertEqual(sum(sum(r['plan']) for r in rows), plan)
            self.assertEqual(sum(sum(r['actual']) for r in rows), actual)
        self.assertEqual(sum(not r['tag'] for r in data), 2)
        self.assertEqual(sum(n == 'No cal.' for r in data for n in r['sourceNotes']), 8)
        for r in data:
            if r['scope'] == 'critical':
                for i, value in enumerate(r['errors']):
                    if value is not None:
                        self.assertEqual(r['actual'][i], 1)
                    if r['sourceNotes'][i] == 'No cal.':
                        self.assertEqual(r['actual'][i], 0)

    def test_update_persists_and_rejects_stale_edits(self):
        record = self.get()['records'][0]
        stale = copy.deepcopy(record)
        record['remarks'] = 'ทดสอบการบันทึก'
        record['actual'][9] = 2
        status, saved = self.post(record)
        self.assertEqual(status, 200)
        self.assertEqual(self.get()['records'][0]['actual'][9], 2)
        persisted = json.loads((Path(self.temp.name) / 'working.json').read_text())
        self.assertEqual(persisted['records'][0]['remarks'], record['remarks'])
        self.assertEqual(self.post(stale)[0], 409)
        saved['sourceNotes'][0] = 'tampered'
        self.assertEqual(self.post(saved)[1]['sourceNotes'][0], '')

    def test_add_and_duplicate_tag(self):
        record = self.get()['records'][0]
        del record['id']
        self.assertEqual(self.post(record)[0], 400)
        record['tag'] = 'NEW-001'
        status, saved = self.post(record)
        self.assertEqual(status, 200)
        self.assertTrue(saved['id'])
        self.assertEqual(len(self.get()['records']), 499)
        self.assertIsNone(saved['sourceRow'])

    def test_invalid_counts_and_readings(self):
        record = self.get()['records'][0]
        for value in [-1, .5, True, 1001]:
            with self.subTest(value=value):
                record['actual'][0] = value
                self.assertEqual(self.post(record)[0], 400)
        record['actual'][0] = 0
        record['errors'][0] = float('nan')
        self.assertEqual(self.post(record)[0], 400)
        self.assertEqual(self.post([])[0], 400)

    def test_missing_tag_can_be_repaired(self):
        record = next(r for r in self.get()['records'] if not r['tag'])
        record['remarks'] = 'awaiting TAG'
        status, saved = self.post(record)
        self.assertEqual(status, 200)
        saved['tag'] = 'SCANNER-K3'
        self.assertEqual(self.post(saved)[0], 200)

    def test_browser_workflow(self):
        from playwright.sync_api import sync_playwright, expect
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True)
            page = browser.new_page(viewport={'width': 1440, 'height': 1100})
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(self.base, wait_until='networkidle')
            expect(page.locator('.kpi-value').nth(0)).to_contain_text('387')
            expect(page.locator('.kpi-value').nth(1)).to_contain_text('726')
            expect(page.locator('.kpi-value').nth(3)).to_contain_text('100.0')
            page.locator('#month').select_option('10')
            expect(page.locator('.kpi-foot').nth(1)).to_contain_text('678')
            page.locator('#scope').select_option('critical')
            expect(page.locator('.kpi-value').nth(0)).to_contain_text('111')
            expect(page.locator('.kpi-value').nth(1)).to_contain_text('327')
            page.locator('#search').fill('Z1B01F1')
            page.locator('.edit-button').click()
            expect(page.locator('#monthly-fields')).to_contain_text('No cal.')
            expect(page.locator('[name="a3"]')).to_have_value('0')
            page.locator('#close').click()
            page.locator('#scope').select_option('all')
            page.locator('#month').select_option('8')
            page.locator('#search').fill('A1J07A9')
            expect(page.locator('#rows tr')).to_have_count(1)
            page.locator('.edit-button').click()
            page.locator('[name="remarks"]').fill('บันทึกจาก browser test')
            page.locator('[name="a7"]').fill('0')
            page.locator('#save').click()
            expect(page.locator('#editor')).not_to_be_visible()
            expect(page.locator('.kpi-value').nth(2)).to_contain_text('430')
            page.reload()
            page.locator('#search').fill('A1J07A9')
            page.locator('.edit-button').click()
            expect(page.locator('[name="remarks"]')).to_have_value('บันทึกจาก browser test')
            page.locator('#close').click()
            page.locator('#add').click()
            page.locator('[name="tag"]').fill('BROWSER-NEW')
            page.locator('[name="description"]').fill('New pressure instrument')
            page.locator('[name="type"]').fill('Pressure')
            page.locator('[name="p0"]').fill('1')
            page.locator('#save').click()
            expect(page.locator('#editor')).not_to_be_visible()
            expect(page.locator('.kpi-value').nth(0)).to_contain_text('388')
            page.locator('#search').fill('BROWSER-NEW')
            with page.expect_download() as event:
                page.locator('#export').click()
            content = Path(event.value.path()).read_text(encoding='utf-8-sig')
            self.assertIn('BROWSER-NEW', content)
            self.assertEqual(len(content.splitlines()), 2)
            page.locator('#search').fill('')
            page.locator('#workshop').select_option('WHR')
            expect(page.locator('.kpi-value').nth(0)).to_contain_text('69')
            page.locator('[data-view="quality"]').click()
            expect(page.locator('#quality')).to_be_visible()
            page.locator('[data-view="overview"]').click()
            page.locator('#workshop').select_option('')
            page.set_viewport_size({'width': 390, 'height': 844})
            self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'), 390)
            page.screenshot(path='/tmp/calibration-mobile.png', full_page=True)
            self.assertEqual(errors, [])
            browser.close()


if __name__ == '__main__':
    unittest.main()
