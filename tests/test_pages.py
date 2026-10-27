"""Test the actual static build under a GitHub project path without a backend."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

class PagesTests(unittest.TestCase):
    def test_static_build_edit_backup_restore_and_isolation(self):
        with tempfile.TemporaryDirectory() as temp:
            destination = Path(temp) / 'Test_codex_v1.1'
            subprocess.run([sys.executable, str(ROOT/'scripts/build_pages.py'), str(destination)],check=True,capture_output=True)
            with socket.socket() as sock:
                sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
            process=subprocess.Popen([sys.executable,'-m','http.server',str(port),'--bind','127.0.0.1','--directory',temp],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            base=f'http://127.0.0.1:{port}/Test_codex_v1.1/'
            try:
                for _ in range(50):
                    try:
                        with urlopen(base) as response: self.assertEqual(response.status,200)
                        break
                    except OSError:time.sleep(.1)
                with sync_playwright() as p:
                    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True)
                    context=browser.new_context()
                    page=context.new_page();errors=[]
                    page.on('pageerror',lambda e:errors.append(str(e)))
                    page.goto(base,wait_until='networkidle')
                    expect(page.locator('.kpi-value').nth(0)).to_contain_text('387')
                    expect(page.locator('#storage-banner')).to_be_visible()
                    page.locator('#add').click()
                    page.locator('[name="tag"]').fill('PAGES-001')
                    page.locator('[name="description"]').fill('Static instrument')
                    page.locator('[name="type"]').fill('Pressure')
                    page.locator('#save').click()
                    expect(page.locator('#editor')).not_to_be_visible()
                    page.reload()
                    expect(page.locator('.kpi-value').nth(0)).to_contain_text('388')
                    page.locator('#search').fill('PAGES-001')
                    page.locator('.edit-button').click()
                    page.locator('[name="remarks"]').fill('Saved in browser')
                    page.locator('#save').click()
                    expect(page.locator('#editor')).not_to_be_visible()
                    with page.expect_download() as download:page.locator('#backup').click()
                    backup=Path(temp)/'backup.json';download.value.save_as(backup)
                    self.assertEqual(len(json.loads(backup.read_text())['records']),499)
                    second=browser.new_context();other=second.new_page();other.goto(base)
                    expect(other.locator('.kpi-value').nth(0)).to_contain_text('387')
                    other.locator('#restore-file').set_input_files(str(backup))
                    expect(other.locator('.kpi-value').nth(0)).to_contain_text('388')
                    other.reload();other.locator('#search').fill('PAGES-001');other.locator('.edit-button').click()
                    expect(other.locator('[name="remarks"]')).to_have_value('Saved in browser')
                    other.locator('[name="tag"]').fill('A1J07A9');other.locator('#save').click()
                    expect(other.locator('#form-error')).to_contain_text('TAG นี้มีอยู่แล้ว')
                    other.locator('#close').click()
                    bad=Path(temp)/'bad.json';bad.write_text('{"year":2026}')
                    other.locator('#restore-file').set_input_files(str(bad))
                    expect(other.locator('#toast')).to_contain_text('นำเข้าไม่สำเร็จ')
                    expect(other.locator('.kpi-value').nth(0)).to_contain_text('388')
                    page.set_viewport_size({'width':390,'height':844})
                    self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'),390)
                    self.assertEqual(errors,[])
                    browser.close()
            finally:
                process.terminate();process.wait(timeout=5)

if __name__=='__main__':unittest.main()
