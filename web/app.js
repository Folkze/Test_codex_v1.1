const $=id=>document.getElementById(id);
const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const short=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sum=a=>a.reduce((a,b)=>a+b,0), fmt=n=>n.toLocaleString('en-US'), pct=(a,b)=>b?100*a/b:0;
let data, page=0, editing=null, view='overview';
const selected=()=>data.records.filter(r=>r.scope===$('scope').value&&(!$('workshop').value||r.workshop===$('workshop').value));
const metric=(rs,end=Number($('month').value))=>{
 const p=Array(12).fill(0),a=Array(12).fill(0);let matched=0,annualMatched=0,unplanned=0,gap=0;
 for(const r of rs)for(let m=0;m<12;m++){p[m]+=r.plan[m];a[m]+=r.actual[m];annualMatched+=Math.min(r.plan[m],r.actual[m]);if(m<=end){matched+=Math.min(r.plan[m],r.actual[m]);unplanned+=Math.max(0,r.actual[m]-r.plan[m]);gap+=Math.max(0,r.plan[m]-r.actual[m]);}}
 return {p,a,plan:sum(p),actual:sum(a),yp:sum(p.slice(0,end+1)),ya:sum(a.slice(0,end+1)),matched,annualMatched,unplanned,gap};
};
function options(){const prior=$('workshop').value;const ws=[...new Set(data.records.filter(r=>r.scope===$('scope').value).map(r=>r.workshop))].sort();$('workshop').innerHTML='<option value="">ทุกหน่วยงาน</option>'+ws.map(w=>`<option>${esc(w)}</option>`).join('');if(ws.includes(prior))$('workshop').value=prior;}
function render(){
 const rs=selected(),m=metric(rs),month=Number($('month').value),ratio=pct(m.matched,m.yp);
 $('asof').textContent=`${months[month]} 2026`;
 $('kpis').innerHTML=[['เครื่องมือในขอบเขต',fmt(rs.length),'รายการ','▥',`${rs.filter(r=>!r.tag).length} รายการไม่มี TAG`,''],['แผนสอบเทียบทั้งปี',fmt(m.plan),'งาน','▦',`แผนสะสมถึงเดือนรายงาน ${fmt(m.yp)} งาน`,''],['ผลจริงสะสม (YTD)',fmt(m.ya),'งาน','✓',`นอกแผนรายเดือน ${fmt(m.unplanned)} งาน`,''],['บันทึกผลตรงเดือนแผน',m.yp?ratio.toFixed(1):'—',m.yp?'%':'','◉',`ตรงแผน ${fmt(m.matched)} / ${fmt(m.yp)} งาน`,'feature']].map(([label,value,unit,icon,foot,cls])=>`<div class="kpi ${cls}"><div class="kpi-label">${label}<span class="kpi-icon">${icon}</span></div><div class="kpi-value">${value}<small>${unit}</small></div><div class="kpi-foot">${cls?'<span class="pill">MONTH MATCH</span>':''}${foot}</div></div>`).join('');
 chart(m,month);
 const progress=pct(m.annualMatched,m.plan),circ=452.39;
 $('donut').innerHTML=`<div class="donut-wrap"><svg viewBox="0 0 180 180" role="img" aria-label="ความคืบหน้าทั้งปี ${progress.toFixed(1)} เปอร์เซ็นต์"><circle cx="90" cy="90" r="72" fill="none" stroke="#edf2e9" stroke-width="17"/><circle cx="90" cy="90" r="72" fill="none" stroke="#298774" stroke-width="17" stroke-linecap="round" stroke-dasharray="${circ*progress/100} ${circ}"/></svg><div class="donut-label"><strong>${m.plan?progress.toFixed(1)+'%':'—'}</strong><span>ANNUAL PLAN COMPLETED</span></div></div>`;
 $('done').textContent=fmt(m.annualMatched)+' งาน';$('remaining').textContent=fmt(m.plan-m.annualMatched)+' งาน';
 $('workshops').innerHTML=[...new Set(rs.map(r=>r.workshop))].map(w=>{const x=metric(rs.filter(r=>r.workshop===w));return `<div class="workshop-row"><span>${esc(w)}</span><div class="track" title="${x.matched} / ${x.yp} งาน"><div style="width:${pct(x.matched,x.yp)}%"></div></div><strong>${x.yp?pct(x.matched,x.yp).toFixed(0)+'%':'—'}</strong><small>${x.matched}/${x.yp}</small></div>`;}).join('')||'<p class="empty">ไม่มีข้อมูล</p>';
 const peak=Math.max(...m.p),peakM=m.p.indexOf(peak);
 $('insights').innerHTML=[['↗',`แผนสูงสุด: ${months[peakM]}`,`${fmt(peak)} งาน · ${pct(peak,m.plan).toFixed(1)}% ของแผนทั้งปีในขอบเขตที่เลือก`],['◷',`ยังไม่มีผลตรงแผนสะสม ${fmt(m.gap)} งาน`,'เป็นช่องว่างจากข้อมูลรายเดือน ไม่ยืนยันว่าล่าช้าหรือไม่ผ่านการสอบเทียบ'],['◇','พบความแตกต่างของสูตรสรุป Excel','Data: 726 vs 724 งาน · Critical: 327 vs 304 งาน ดูรายละเอียดใน Data insights']].map(([icon,title,body])=>`<div class="insight-item"><span class="insight-symbol">${icon}</span><div><strong>${title}</strong><p>${body}</p></div></div>`).join('');
 renderTable();
}
function chart(m,month){
 const width=700,height=235,left=38,right=12,top=15,bottom=35,plotH=height-top-bottom,step=(width-left-right)/12,max=Math.max(10,Math.ceil(Math.max(...m.p,...m.a)/40)*40);
 let svg=`<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="กราฟแผนและผลจริงรายเดือน ปี 2026"><rect class="selected" x="${left+month*step}" y="5" width="${step}" height="${height-12}" rx="5"/>`;
 for(let i=0;i<=4;i++){const y=top+plotH*i/4;svg+=`<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" stroke="#edf1e9" stroke-dasharray="3 4"/><text x="${left-9}" y="${y+3}" text-anchor="end">${max*(4-i)/4}</text>`;}
 for(let i=0;i<12;i++){const x=left+i*step+step/2;for(const [val,offset,cls] of [[m.p[i],-12,'plan'],[m.a[i],2,'actual']]){const h=plotH*val/max;svg+=`<rect class="bar-${cls}" x="${x+offset}" y="${top+plotH-h}" width="10" height="${h}" rx="2"><title>${months[i]} ${cls==='plan'?'แผน':'ผลจริง'} ${val} งาน</title></rect>`;}svg+=`<text x="${x}" y="${height-12}" text-anchor="middle">${short[i]}</text>`;}
 $('chart').innerHTML=svg+'</svg>';
}
function filteredRows(){const q=$('search').value.toLowerCase().trim();return selected().filter(r=>[r.tag,r.description,r.type,r.workshop].some(v=>v.toLowerCase().includes(q)));}
function renderTable(all=false){
 const rows=filteredRows(),size=8;page=Math.min(page,Math.max(0,Math.ceil(rows.length/size)-1));
 $('record-count').textContent=rows.length;
 $('rows').innerHTML=(all?rows:rows.slice(page*size,(page+1)*size)).map(r=>{const x=metric([r]);const status=!r.tag?'TAG ไม่ครบ':!x.yp?'ไม่มีแผนสะสม':x.gap?'ยังไม่มีผลครบ':'บันทึกครบแผน';return `<tr><td><strong>${esc(r.description)}</strong><small class="tag">${esc(r.tag)||'— ยังไม่มี TAG —'}</small></td><td>${esc(r.workshop)}</td><td>${esc(r.type)}<small>${esc(r.frequency)}</small></td><td>${x.yp}</td><td>${x.ya}</td><td><span class="badge ${!r.tag||x.gap?'pending':!x.yp?'neutral':''}">${status}</span></td><td><button class="edit-button" data-id="${esc(r.id)}" aria-label="แก้ไข ${esc(r.tag||r.description)}">แก้ไข ↗</button></td></tr>`;}).join('')||'<tr><td colspan="7" class="empty">ไม่พบข้อมูลที่ตรงกับการค้นหา</td></tr>';
 $('page-info').textContent=rows.length?`แสดง ${page*size+1}–${Math.min(rows.length,(page+1)*size)} จาก ${rows.length} รายการ`:'0 รายการ';$('prev').disabled=page===0;$('next').disabled=(page+1)*size>=rows.length;
}
function quality(){
 const cards=[['01 / ขอบเขตข้อมูล','Data มี 387 รายการ (385 รายการมี TAG และ 2 รายการไม่มี TAG: Kiln Shell Scanner K3 / K4) ส่วน SSCC Master Plan และ List Critical Instrument มี 111 รายการ ชื่อ workshop และประเภทบาง TAG ต่างกัน จึงแสดงเป็นคนละขอบเขตและไม่รวมยอดเข้าด้วยกัน พบรายการไม่มีแผนรายเดือนทั้งปี 84 รายการใน Data และ 58 รายการใน Critical ต้องตรวจสอบกับเจ้าของแผน'],['02 / สูตรสรุปข้ามแถวข้อมูล','Data!S390 รวมเฉพาะ S3:S387 ข้าม S388:S389 ทำให้แผนพฤศจิกายนแสดง 181 แทน 183 งาน และทั้งปี 724 แทน 726 งาน ส่วน SSCC Master Plan!Y2:AB2 รวมถึงแถว 188 จึงได้แผน 304 / ผล 145 แทนยอดครบทุกแถว 327 / 154 เว็บไซต์คำนวณจากแถวเครื่องมือทั้งหมด'],['03 / วิธีนับผลและข้อจำกัด','Data ใช้จำนวนงานรายเดือน ส่วน Critical ใช้จำนวนเซลล์ตัวเลขตาม Excel COUNT: ค่า 0 และค่าติดลบนับ 1 งานต่อเซลล์ แต่ข้อความ “No cal.” ทั้ง 8 ช่องไม่นับ ข้อความต้นฉบับเก็บไว้ในหน้ารายละเอียด ไม่มี tolerance จึงไม่ประเมินว่าผ่านหรือไม่ผ่าน ค่า 1 อาจเป็นเครื่องหมายทำแล้ว ไม่ยืนยันว่าเป็น error 1%'],['04 / ช่วงเวลาและนิยาม KPI','Excel เลือกเดือนกันยายน 2026 เป็นเดือนรายงาน ผลจริง Data มีถึงกันยายน ส่วน Critical มีถึงมิถุนายน ผลสะสมรวมถึงเดือนที่เลือก; บันทึกตรงแผน = Σ min(แผน, ผลจริง) ของเครื่องมือแต่ละเดือน ÷ แผนสะสม; นอกแผน = Σ max(ผลจริง − แผน, 0); ความคืบหน้าทั้งปีใช้ผลตรงแผนครบ 12 เดือน ช่องว่างไม่ใช่การยืนยันงานล่าช้า กราฟและความคืบหน้าทั้งปีรวมเดือนหลังเดือนรายงานด้วย ไม่มีข้อมูลปริมาณผลิตหรือ OEE ในไฟล์']];
 $('quality-content').innerHTML=cards.map(([h,p])=>`<div class="quality-card"><h3>${h}</h3><p>${p}</p></div>`).join('')+'<p class="fineprint">ข้อสังเกตด้านบนอ้างอิงไฟล์ที่นำเข้าครั้งแรก KPI และทะเบียนคำนวณใหม่จากข้อมูลปัจจุบันหลังการแก้ไข</p>';
}
function openEditor(id){
 editing=id?structuredClone(data.records.find(r=>r.id===id)):{scope:$('scope').value,tag:'',description:'',workshop:$('workshop').value||'Kiln',type:'',frequency:'Once',owner:'Instrumentation',remarks:'',plan:Array(12).fill(0),actual:Array(12).fill(0),errors:Array(12).fill(null),sourceNotes:Array(12).fill('')};
 $('modal-title').textContent=id?'แก้ไขเครื่องมือ · '+(editing.tag||'ยังไม่มี TAG'):'เพิ่มเครื่องมือใหม่';
 $('fields').innerHTML=[['tag','TAG'],['description','ชื่อเครื่องมือ'],['workshop','Workshop'],['type','ประเภทเครื่องมือ'],['frequency','ความถี่'],['owner','ผู้รับผิดชอบ'],['remarks','หมายเหตุ']].map(([key,label])=>`<label>${label}<input name="${key}" value="${esc(editing[key])}" maxlength="1000" ${['description','workshop','type'].includes(key)||(key==='tag'&&!id)?'required':''}></label>`).join('');
 $('monthly-fields').innerHTML=months.map((m,i)=>`<tr><td>${m}${editing.sourceNotes?.[i]?`<small class="source-note">ต้นฉบับ: ${esc(editing.sourceNotes[i])}</small>`:''}</td><td><input aria-label="แผน ${m}" name="p${i}" type="number" min="0" max="1000" step="1" value="${editing.plan[i]}" required></td><td><input aria-label="ผลจริง ${m}" name="a${i}" type="number" min="0" max="1000" step="1" value="${editing.actual[i]}" required></td><td><input aria-label="ค่าอ่าน ${m}" name="e${i}" type="number" step="any" value="${editing.errors[i]??''}" ${editing.scope==='all'?'disabled':''}></td></tr>`).join('');
 $('form-error').textContent='';$('editor').showModal();
}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),3200);}
async function save(e){e.preventDefault();const f=new FormData(e.target),r={...editing};for(const k of ['tag','description','workshop','type','frequency','owner','remarks'])r[k]=f.get(k).trim();for(let i=0;i<12;i++){r.plan[i]=Number(f.get('p'+i));r.actual[i]=Number(f.get('a'+i));r.errors[i]=f.get('e'+i)?Number(f.get('e'+i)):null;}
 $('save').disabled=true;try{const out=await calibrationStorage.save(r);const index=data.records.findIndex(x=>x.id===out.id);if(index>=0)data.records[index]=out;else data.records.push(out);options();render();$('editor').close();toast('บันทึกข้อมูลแล้ว · อัปเดต KPI เรียบร้อย');}catch(err){$('form-error').textContent=err.message;}finally{$('save').disabled=false;}}
function exportCSV(){
 const cell=v=>typeof v==='number'?String(v):'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"';
 const head=['Scope','Report month','TAG','Description','Workshop','Type','Frequency','Owner','Remarks',...short.flatMap(m=>[m+' Plan',m+' Actual',m+' Reading',m+' Source note'])];
 const rows=filteredRows().map(r=>[r.scope,months[Number($('month').value)]+' 2026',r.tag,r.description,r.workshop,r.type,r.frequency,r.owner,r.remarks,...short.flatMap((_,i)=>[r.plan[i],r.actual[i],r.errors[i],r.sourceNotes?.[i]||''])]);
 const blob=new Blob(['\ufeff'+[head,...rows].map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`plant2-calibration-${$('scope').value}-2026.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`ส่งออก ${rows.length} รายการตามตัวกรองแล้ว`);
}
$('month').innerHTML=months.map((m,i)=>`<option value="${i}">${m}</option>`).join('');
$('scope').onchange=()=>{options();page=0;render();};$('workshop').onchange=$('month').onchange=()=>{page=0;render();};$('search').oninput=()=>{page=0;renderTable();};$('prev').onclick=()=>{page--;renderTable();};$('next').onclick=()=>{page++;renderTable();};$('rows').onclick=e=>{const b=e.target.closest('[data-id]');if(b)openEditor(b.dataset.id);};$('add').onclick=()=>openEditor();$('close').onclick=()=>$('editor').close();$('edit-form').onsubmit=save;$('export').onclick=exportCSV;$('print').onclick=()=>window.print();
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n===b));$('overview').hidden=view!=='overview';$('quality').hidden=view!=='quality';$('register').hidden=view==='quality';$('crumb').textContent={overview:'Overview',register:'Instrument register',quality:'Data insights'}[view];$('title').innerHTML={overview:'Calibration overview<span>.</span>',register:'Instrument register<span>.</span>',quality:'Data insights<span>.</span>'}[view];});
calibrationStorage.load().then(d=>{data=d;$('month').value=d.reportMonth;options();quality();render();}).catch(e=>{$('overview').innerHTML='<div class="quality-card"><h2>โหลดข้อมูลไม่สำเร็จ</h2><p>ตรวจสอบการเชื่อมต่อและแหล่งข้อมูล แล้วรีเฟรชหน้าอีกครั้ง</p></div>';$('add').disabled=$('export').disabled=true;console.error(e);});

window.addEventListener('beforeprint',()=>{document.body.dataset.view=view;const context=document.createElement('p');context.id='print-context';context.className='print-context';context.textContent=`${$('scope').selectedOptions[0].text} · ${$('workshop').value||'ทุกหน่วยงาน'} · ${months[Number($('month').value)]} 2026${$('search').value?' · ค้นหา: '+$('search').value:''}`;$('title').after(context);if(view==='register')renderTable(true);});
window.addEventListener('afterprint',()=>{$('print-context')?.remove();renderTable();});

if (calibrationStorage.isStatic) {
 $('storage-banner').hidden=false;
 $('storage-label').textContent='Browser data';
 $('save-location').textContent='บันทึกเฉพาะเบราว์เซอร์นี้';
}
$('backup').onclick=async()=>{
 try {
  const d=await calibrationStorage.backup(),url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='plant2-calibration-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('สำรองข้อมูลครบทุกขอบเขตแล้ว');
 } catch(e){toast(e.message);}
};
$('restore').onclick=()=>$('restore-file').click();
$('restore-file').onchange=async(e)=>{
 const file=e.target.files[0];if(!file)return;
 try {
  if(file.size>6000000)throw Error('ไฟล์ใหญ่เกิน 6 MB');
  data=await calibrationStorage.restore(JSON.parse(await file.text()));options();render();toast('นำเข้าข้อมูลแล้ว');
 } catch(error){toast('นำเข้าไม่สำเร็จ: '+error.message);}
 finally {e.target.value='';}
};
