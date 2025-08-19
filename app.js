// ======= Helpers =======
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => r.querySelectorAll(s);
const fmt2 = n => String(n).padStart(2, '0');

function nowText(){
  const d = new Date();
  return `${fmt2(d.getDate())}/${fmt2(d.getMonth()+1)}/${d.getFullYear()} ${fmt2(d.getHours())}:${fmt2(d.getMinutes())}:${fmt2(d.getSeconds())}`;
}
function todayISO(d=new Date()){
  return `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}`;
}
function dataURLToBlob(dataURL) {
  const [meta, data] = dataURL.split(',');
  const mime = meta.match(/:(.*?);/)[1];
  const bin = atob(data);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i=0;i<len;i++) u8[i]=bin.charCodeAt(i);
  return new Blob([u8], {type:mime});
}

// Resize image to maxWidth 1280px (keep EXIF orientation is skipped for simplicity)
async function readAndResize(file, maxW=1280){
  if(!file) return null;
  const img = new Image();
  const fr = new FileReader();
  const data = await new Promise(res=>{
    fr.onload = () => res(fr.result);
    fr.readAsDataURL(file);
  });
  return await new Promise(resolve=>{
    img.onload = () => {
      const ratio = img.width > maxW ? maxW / img.width : 1;
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,w,h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.src = data;
  });
}

// ======= Tabs =======
for(const btn of $$('.tab')){
  btn.addEventListener('click', ()=>{
    $$('.tab').forEach(b=>b.classList.remove('active'));
    $$('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    $('#'+id).classList.add('active');
  });
}

// Clock
setInterval(()=>{$('#nowText').textContent = nowText();}, 1000);

// ======= Form Elements =======
const els = {
  product: $('#product'),
  spec: $('#spec'),
  diaCu: $('#diaCu'),
  diaOD: $('#diaOD'),
  weight: $('#weight'),
  meters: $('#meters'),
  operator: $('#operator'),
  signerName: $('#signerName'),
  photoConcentric: $('#photoConcentric'),
  previewConcentric: $('#previewConcentric'),
  photoOD: $('#photoOD'),
  previewOD: $('#previewOD'),
  photoLot: $('#photoLot'),
  previewLot: $('#previewLot'),
  photoScale: $('#photoScale'),
  previewScale: $('#previewScale'),
  saveBtn: $('#saveBtn'),
  resetBtn: $('#resetBtn'),
};

// Previews
async function handlePreview(inputEl, imgEl){
  const file = inputEl.files?.[0];
  const data = await readAndResize(file);
  if(data){
    imgEl.src = data;
    imgEl.style.display = 'block';
    inputEl.dataset.dataurl = data; // keep resized dataURL
  }else{
    imgEl.src = '';
    imgEl.style.display = 'none';
    inputEl.dataset.dataurl = '';
  }
}
els.photoConcentric.addEventListener('change', ()=>handlePreview(els.photoConcentric, els.previewConcentric));
els.photoOD.addEventListener('change', ()=>handlePreview(els.photoOD, els.previewOD));
els.photoLot.addEventListener('change', ()=>handlePreview(els.photoLot, els.previewLot));
els.photoScale.addEventListener('change', ()=>handlePreview(els.photoScale, els.previewScale));

// ======= Signature Pad =======
const sig = {
  canvas: $('#sigPad'),
  drawing: false,
  lastX: 0, lastY: 0
};
const ctx = sig.canvas.getContext('2d');
function resizeSig(){
  // scale to CSS size while keeping drawing scale crisp
  const rect = sig.canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  sig.canvas.width = Math.round(rect.width * ratio);
  sig.canvas.height = Math.round(rect.height * ratio);
  ctx.scale(ratio, ratio);
  ctx.fillStyle = '#111'; ctx.fillRect(0,0,rect.width,rect.height);
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = '#fff';
}
new ResizeObserver(resizeSig).observe(sig.canvas);

function pos(e){
  if(e.touches?.length){ const t = e.touches[0]; const r = sig.canvas.getBoundingClientRect(); return {x:t.clientX - r.left, y:t.clientY - r.top}; }
  const r = sig.canvas.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top};
}
sig.canvas.addEventListener('mousedown', e=>{sig.drawing=true; const p=pos(e); sig.lastX=p.x; sig.lastY=p.y;});
sig.canvas.addEventListener('mousemove', e=>{
  if(!sig.drawing) return; const p=pos(e); ctx.beginPath(); ctx.moveTo(sig.lastX, sig.lastY); ctx.lineTo(p.x, p.y); ctx.stroke(); sig.lastX=p.x; sig.lastY=p.y;
});
['mouseup','mouseleave'].forEach(ev=>sig.canvas.addEventListener(ev, ()=>sig.drawing=false));
sig.canvas.addEventListener('touchstart', e=>{sig.drawing=true; const p=pos(e); sig.lastX=p.x; sig.lastY=p.y;});
sig.canvas.addEventListener('touchmove', e=>{if(!sig.drawing) return; e.preventDefault(); const p=pos(e); ctx.beginPath(); ctx.moveTo(sig.lastX, sig.lastY); ctx.lineTo(p.x, p.y); ctx.stroke(); sig.lastX=p.x; sig.lastY=p.y;}, {passive:false});
sig.canvas.addEventListener('touchend', ()=>sig.drawing=false);

$('#clearSig').addEventListener('click', ()=>{
  const r = sig.canvas.getBoundingClientRect();
  ctx.fillStyle = '#111'; ctx.fillRect(0,0,r.width,r.height);
});

// ======= Storage =======
const KEY = 'entries_v1';

function getEntries(){
  try{ return JSON.parse(localStorage.getItem(KEY) || '[]'); }catch(e){ return []; }
}
function setEntries(arr){
  localStorage.setItem(KEY, JSON.stringify(arr));
}

// ======= Save Form =======
els.saveBtn.addEventListener('click', async ()=>{
  // Basic validation
  if(!els.product.value.trim() || !els.operator.value.trim() || !els.signerName.value.trim()){
    alert('Vui lòng nhập Sản phẩm, Tên người chạy và Họ tên người ký.');
    return;
  }
  if(!els.diaCu.value || !els.diaOD.value){
    alert('Vui lòng nhập ĐK đồng và ĐK cách điện.');
    return;
  }

  // Signature data
  const sigData = sig.canvas.toDataURL('image/png');

  const d = new Date();
  const entry = {
    id: Date.now(),
    ts: d.toISOString(),
    date: todayISO(d),
    time: `${fmt2(d.getHours())}:${fmt2(d.getMinutes())}:${fmt2(d.getSeconds())}`,
    product: els.product.value.trim(),
    spec: els.spec.value.trim(),
    diaCu: parseFloat(els.diaCu.value),
    diaOD: parseFloat(els.diaOD.value),
    weight: els.weight.value ? parseFloat(els.weight.value) : null,
    meters: els.meters.value ? parseFloat(els.meters.value) : null,
    operator: els.operator.value.trim(),
    signerName: els.signerName.value.trim(),
    photos: {
      concentric: els.photoConcentric.dataset.dataurl || null,
      od: els.photoOD.dataset.dataurl || null,
      lot: els.photoLot.dataset.dataurl || null,
      scale: els.photoScale.dataset.dataurl || null,
    },
    signature: sigData
  };

  const arr = getEntries();
  arr.unshift(entry);
  setEntries(arr);
  alert('Đã lưu phiếu.');
  renderList(); // update list count
});

els.resetBtn.addEventListener('click', ()=>{
  for (const k of ['product','spec','diaCu','diaOD','weight','meters','operator','signerName']){
    els[k].value = '';
  }
  for (const id of ['previewConcentric','previewOD','previewLot','previewScale']){
    const img = $('#'+id); img.src=''; img.style.display='none';
  }
  for (const id of ['photoConcentric','photoOD','photoLot','photoScale']){
    const input = $('#'+id); input.value=''; input.dataset.dataurl='';
  }
  $('#clearSig').click();
});

// ======= List & Filter =======
const listWrap = $('#listWrap');
const countBadge = $('#countBadge');

function applyCurrentFilter(arr){
  const from = $('#fromDate').value ? new Date($('#fromDate').value) : null;
  const to = $('#toDate').value ? new Date($('#toDate').value) : null;
  const op = $('#filterOperator').value.trim().toLowerCase();
  const prod = $('#filterProduct').value.trim().toLowerCase();

  return arr.filter(e=>{
    const d = new Date(e.date);
    if(from && d < from) return false;
    if(to){ const end = new Date(to); end.setHours(23,59,59,999); if(d > end) return false; }
    if(op && !e.operator.toLowerCase().includes(op)) return false;
    if(prod && !e.product.toLowerCase().includes(prod)) return false;
    return true;
  });
}

function renderList(){
  const all = getEntries();
  const filtered = applyCurrentFilter(all);
  countBadge.textContent = filtered.length;
  listWrap.innerHTML = '';

  filtered.forEach(e=>{
    const row = document.createElement('div');
    row.className = 'card-row';

    const left = document.createElement('div');
    left.innerHTML = `
      <div class="row-title">${e.product} • ${e.spec || ''}</div>
      <div class="row-sub">${e.date} ${e.time} • Người chạy: <b>${e.operator}</b> • ĐK Cu: ${e.diaCu} • ĐK OD: ${e.diaOD}${e.meters?` • ${e.meters} m`:''}${e.weight?` • ${e.weight} kg`:''}</div>
      <div class="thumb-row">
        ${['concentric','od','lot','scale'].map(k => e.photos[k] ? `<img class="thumb" src="${e.photos[k]}">` : '').join('')}
      </div>
    `;
    const right = document.createElement('div');
    right.innerHTML = `
      <button class="btn ghost" data-view="${e.id}">Xem</button>
      <button class="btn danger" data-del="${e.id}">Xóa</button>
    `;
    row.appendChild(left); row.appendChild(right);
    listWrap.appendChild(row);

    right.querySelector('[data-view]').addEventListener('click', ()=>previewReport(e));
    right.querySelector('[data-del]').addEventListener('click', ()=>{
      const ok = confirm('Xóa phiếu này?');
      if(!ok) return;
      const arr = getEntries().filter(x=>x.id!==e.id);
      setEntries(arr); renderList();
    });
  });
}

$('#applyFilter').addEventListener('click', renderList);
$('#clearFilter').addEventListener('click', ()=>{
  $('#fromDate').value = ''; $('#toDate').value=''; $('#filterOperator').value=''; $('#filterProduct').value='';
  renderList();
});

window.addEventListener('load', ()=>{
  // default filter today
  $('#fromDate').value = todayISO();
  $('#toDate').value = todayISO();
  renderList();
});

// ======= Render Report to Image (Canvas) =======
function drawLabel(ctx, x, y, text, bold=false){
  ctx.font = (bold?'700 ':'400 ')+ '22px Inter, Arial';
  ctx.fillStyle = '#e9eaec';
  ctx.fillText(text, x, y);
}
function drawLine(ctx, x1, y1, x2, y2, color='#2a2b31', w=2){
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
}

async function generateReportImage(entry){
  const W = 1200, H = 1700;
  const c = $('#renderCanvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Background
  const g = ctx.createLinearGradient(0,0,W,0);
  g.addColorStop(0,'#ff6a00'); g.addColorStop(1,'#ff8533');
  ctx.fillStyle = '#0f1013'; ctx.fillRect(0,0,W,H);
  // Header
  ctx.fillStyle = g; ctx.fillRect(0,0,W,140);
  ctx.fillStyle = '#111';
  ctx.globalAlpha = 0.08; ctx.fillRect(0,0,W,140); ctx.globalAlpha = 1;
  ctx.fillStyle = '#0f1013'; ctx.fillRect(0,140,W,30);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 42px Inter, Arial';
  ctx.fillText('BÁO CÁO LÔ SẢN XUẤT (ẢNH)', 32, 90);

  // Info
  let y = 210; const x = 32;
  drawLabel(ctx, x, y, `Thời gian: ${entry.date} ${entry.time}`, true); y+=40;
  drawLine(ctx, x, y, W-32, y, '#2a2b31', 2); y+=24;

  drawLabel(ctx, x, y, `Sản phẩm: ${entry.product}`, true); y+=32;
  drawLabel(ctx, x, y, `Quy cách: ${entry.spec || '-'}`); y+=32;
  drawLabel(ctx, x, y, `ĐK đồng: ${entry.diaCu} mm • ĐK cách điện: ${entry.diaOD} mm`); y+=32;
  drawLabel(ctx, x, y, `Số mét: ${entry.meters ?? '-'} • Trọng lượng: ${entry.weight ?? '-'} kg`); y+=32;
  drawLabel(ctx, x, y, `Người chạy: ${entry.operator}`); y+=26;
  drawLabel(ctx, x, y, `Người ký: ${entry.signerName}`); y+=24;
  drawLine(ctx, x, y+8, W-32, y+8, '#2a2b31', 2); y+=30;

  // Photos grid (2 x 2)
  const slots = [
    {label:'Đồng tâm', key:'concentric'},
    {label:'OD cách điện', key:'od'},
    {label:'Số lô', key:'lot'},
    {label:'Số cân', key:'scale'},
  ];
  const imgW = (W - 32*3)/2;
  const imgH = imgW*0.75;

  for(let i=0;i<slots.length;i++){
    const col = i%2, row = Math.floor(i/2);
    const px = x + col*(imgW+32);
    const py = y + row*(imgH+50);

    // frame
    ctx.fillStyle = '#111317'; ctx.fillRect(px, py, imgW, imgH);
    ctx.strokeStyle = '#2a2b31'; ctx.strokeRect(px, py, imgW, imgH);
    // image
    const data = entry.photos[slots[i].key];
    if(data){
      const img = await new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.src=data; });
      // fit center
      const ratio = Math.min(imgW/img.width, imgH/img.height);
      const w = img.width*ratio, h = img.height*ratio;
      const ox = px + (imgW - w)/2, oy = py + (imgH - h)/2;
      ctx.drawImage(img, ox, oy, w, h);
    }
    ctx.font = '600 20px Inter, Arial'; ctx.fillStyle = '#cfd3d8';
    ctx.fillText(slots[i].label.toUpperCase(), px, py+imgH+28);
  }
  y += imgH*2 + 100;

  // Signature
  drawLabel(ctx, x, y, 'Chữ ký:', true);
  if(entry.signature){
    const s = await new Promise(res=>{ const im=new Image(); im.onload=()=>res(im); im.src=entry.signature; });
    const sw = 380, sh = 120;
    ctx.drawImage(s, x+120, y-40, sw, sh);
  }
  drawLine(ctx, x, y+10, x+500, y+10, '#2a2b31', 2);

  return c.toDataURL('image/png');
}

function previewReport(entry){
  generateReportImage(entry).then(data=>{
    const w = window.open('');
    w.document.write(`<title>Xem ảnh báo cáo</title>`);
    w.document.write(`<img style="max-width:100%;height:auto" src="${data}">`);
  });
}

// Export filtered → ZIP
$('#exportImgs').addEventListener('click', async ()=>{
  const all = getEntries();
  const filtered = applyCurrentFilter(all).filter(e=>!!e.signature); // chỉ xuất phiếu có ký
  if(!filtered.length){ alert('Không có phiếu (đã ký) nào trong bộ lọc.'); return; }

  const zip = new JSZip();
  for(let i=0;i<filtered.length;i++){
    const e = filtered[i];
    const pngDataURL = await generateReportImage(e);
    const blob = dataURLToBlob(pngDataURL);
    const name = `baocao_${e.date}_${e.time.replaceAll(':','')}_${e.operator.replaceAll(' ','-')}.png`;
    zip.file(name, blob);
  }
  const content = await zip.generateAsync({type:'blob'});
  const today = todayISO();
  saveAs(content, `BaoCao_Anh_${today}.zip`);
});

// Delete all
$('#deleteAll').addEventListener('click', ()=>{
  const ok = confirm('Bạn chắc chắn muốn xóa TẤT CẢ dữ liệu?');
  if(!ok) return;
  setEntries([]); renderList();
});
