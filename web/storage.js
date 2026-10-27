/* Storage adapter for the Python server and a repository-scoped GitHub Pages site. */
(() => {
  const isStatic = window.CALIBRATION_STATIC === true;
  const key = 'plant2-calibration:2026:' + location.pathname.replace(/index\.html$/, '');
  let baseline;
  function validateRecord(r) {
    if (!r || typeof r !== 'object') throw Error('ข้อมูลเครื่องมือไม่ถูกต้อง');
    for (const k of ['tag','description','workshop','type','frequency','owner','remarks'])
      if (typeof r[k] !== 'string' || r[k].length > 1000) throw Error('ข้อมูลไม่ถูกต้อง: ' + k);
    for (const k of ['description','workshop','type']) if (!r[k].trim()) throw Error('กรุณาระบุ ' + k);
    if (!['all','critical'].includes(r.scope)) throw Error('ขอบเขตไม่ถูกต้อง');
    for (const k of ['plan','actual']) if (!Array.isArray(r[k]) || r[k].length !== 12 || r[k].some(x => !Number.isInteger(x) || x < 0 || x > 1000)) throw Error('จำนวนงานรายเดือนต้องเป็นจำนวนเต็ม 0–1000');
    if (!Array.isArray(r.errors) || r.errors.length !== 12 || r.errors.some(x => x !== null && (!Number.isFinite(x) || Math.abs(x) >= 1e9))) throw Error('ค่าอ่านไม่ถูกต้อง');
    if (r.sourceNotes && (!Array.isArray(r.sourceNotes) || r.sourceNotes.length !== 12 || r.sourceNotes.some(x => typeof x !== 'string' || x.length > 1000))) throw Error('หมายเหตุต้นฉบับไม่ถูกต้อง');
    if (r.revision !== undefined && (!Number.isInteger(r.revision) || r.revision < 0)) throw Error('Revision ไม่ถูกต้อง');
  }
  function validateDataset(d) {
    if (!d || d.year !== 2026 || !Number.isInteger(d.reportMonth) || d.reportMonth < 0 || d.reportMonth > 11 || !Array.isArray(d.records) || d.records.length > 10000) throw Error('ไฟล์ต้องเป็นข้อมูลสำรอง Plant 2 ปี 2026');
    const ids = new Set(), tags = new Set();
    for (const r of d.records) {
      validateRecord(r);
      if (typeof r.id !== 'string' || !r.id || ids.has(r.id)) throw Error('ID ของข้อมูลซ้ำหรือไม่ถูกต้อง');
      ids.add(r.id);
      const tag = r.scope + ':' + r.tag.toLowerCase();
      if (r.tag && tags.has(tag)) throw Error('TAG ซ้ำในขอบเขตเดียวกัน');
      if (r.tag) tags.add(tag);
    }
    return d;
  }
  async function request(path, body) {
    const response = await fetch(path, body ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : undefined);
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'HTTP ' + response.status);
    return result;
  }
  function current() {
    const raw = localStorage.getItem(key);
    return raw ? validateDataset(JSON.parse(raw)) : structuredClone(baseline);
  }
  async function locked(action) {
    // Web Locks serialize edits across tabs on HTTPS and localhost.
    if (navigator.locks) return navigator.locks.request(key, action);
    return action();
  }
  window.calibrationStorage = {
    isStatic,
    async load() {
      if (!isStatic) return request('/api/data');
      baseline = validateDataset(await request('./data/source.json'));
      return current();
    },
    async save(record) {
      if (!isStatic) return request('/api/records', record);
      return locked(() => {
        validateRecord(record);
        const d = current(), index = d.records.findIndex(x => x.id === record.id), old = d.records[index];
        if (record.id && !old) throw Error('ไม่พบรายการ กรุณารีเฟรชหน้า');
        if (old && (old.revision || 0) !== (record.revision || 0)) throw Error('รายการนี้มีการแก้ไขแล้ว กรุณารีเฟรชหน้า');
        if (old && old.scope !== record.scope) throw Error('ไม่สามารถเปลี่ยนขอบเขตของรายการเดิม');
        if (!record.tag.trim() && (!old || old.tag)) throw Error('กรุณาระบุ TAG');
        if (record.tag && d.records.some(x => x.id !== record.id && x.scope === record.scope && x.tag.toLowerCase() === record.tag.toLowerCase())) throw Error('TAG นี้มีอยู่แล้วในขอบเขตที่เลือก');
        const saved = {...structuredClone(record),id:old?.id || crypto.randomUUID(),revision:(old?.revision || 0)+1,sourceRow:old?.sourceRow || null,sourceNotes:old?.sourceNotes || Array(12).fill('')};
        if (old) d.records[index] = saved; else d.records.push(saved);
        // setItem can fail (e.g. storage full); propagate before showing a success message.
        localStorage.setItem(key, JSON.stringify(d));
        return saved;
      });
    },
    async backup() { return isStatic ? current() : request('/api/data'); },
    async restore(incoming) {
      if (!isStatic) throw Error('การนำเข้าข้อมูลสำรองนี้ใช้กับ GitHub Pages');
      validateDataset(incoming);
      return locked(() => {
        // Preserve all records already in this browser; the chosen backup replaces matching IDs only.
        const d = current(), records = new Map(d.records.map(r => [r.id,r]));
        for (const r of incoming.records) records.set(r.id,{...r,revision:Math.max(records.get(r.id)?.revision || 0,r.revision || 0)+1});
        d.records = [...records.values()];
        validateDataset(d);
        localStorage.setItem(key,JSON.stringify(d));
        return d;
      });
    }
  };
})();
