// ========== الإعدادات ==========
const PDF_FILE = 'HS Code 2026.pdf'; // ← غيّر هذا لاسم ملفك

// ========== PDF.js ==========
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ========== المتغيرات ==========
let pdf = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5;
let pdfText = [];
let results = [];
let resultIdx = -1;
let indexed = false;
let history = JSON.parse(localStorage.getItem('pdfHistory') || '[]');
let debounce = null;

// ========== العناصر ==========
const $ = id => document.getElementById(id);
const el = {
    loader: $('loadingScreen'),
    loaderProg: $('loaderProgress'),
    loaderTxt: $('loaderText'),
    searchIn: $('searchInput'),
    clearBtn: $('clearBtn'),
    status: $('searchStatus'),
    sidebar: $('sidebar'),
    sidebarToggle: $('sidebarToggle'),
    stats: $('statsBar'),
    prevBtn: $('prevBtn'),
    nextBtn: $('nextBtn'),
    resultPos: $('resultPos'),
    resultsList: $('resultsList'),
    historyTags: $('historyTags'),
    canvas: $('pdfCanvas'),
    textLayer: $('textLayer'),
    container: $('pdfContainer'),
    pageNum: $('pageNum'),
    pageTotal: $('pageTotal'),
    pageRange: $('pageRange'),
    pagePrev: $('pagePrev'),
    pageNext: $('pageNext'),
    zoomIn: $('zoomIn'),
    zoomOut: $('zoomOut'),
    zoomFit: $('zoomFit'),
    zoomVal: $('zoomVal'),
    themeBtn: $('themeBtn'),
};
const ctx = el.canvas.getContext('2d');

// ========== التهيئة ==========
async function init() {
    bindEvents();
    showHistory();
    await loadPDF();
}

function bindEvents() {
    // البحث
    el.searchIn.oninput = onSearchInput;
    el.searchIn.onkeydown = e => e.key === 'Enter' && doSearch();
    el.clearBtn.onclick = clearSearch;
    
    // النتائج
    el.sidebarToggle.onclick = () => el.sidebar.classList.toggle('collapsed');
    el.prevBtn.onclick = () => navResult(-1);
    el.nextBtn.onclick = () => navResult(1);
    
    // الصفحات
    el.pagePrev.onclick = () => goPage(currentPage - 1);
    el.pageNext.onclick = () => goPage(currentPage + 1);
    el.pageNum.onchange = e => goPage(+e.target.value);
    el.pageRange.oninput = e => goPage(+e.target.value);
    
    // التكبير
    el.zoomIn.onclick = () => setZoom(scale + 0.25);
    el.zoomOut.onclick = () => setZoom(scale - 0.25);
    el.zoomFit.onclick = fitWidth;
    
    // الثيم
    el.themeBtn.onclick = toggleTheme;
    
    // اختصارات
    document.onkeydown = onKey;
}

// ========== تحميل PDF ==========
async function loadPDF() {
    setLoader('جاري تحميل الملف...', 5);
    
    try {
        pdf = await pdfjsLib.getDocument({
            url: PDF_FILE,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
        }).promise;
        
        totalPages = pdf.numPages;
        el.pageTotal.textContent = totalPages;
        el.pageRange.max = totalPages;
        
        await renderPage(1);
        await indexPDF();
        
        el.loader.classList.add('hide');
        el.searchIn.focus();
        
    } catch (err) {
        setLoader('❌ خطأ: ' + err.message, 0);
        console.error(err);
    }
}

function setLoader(txt, pct) {
    el.loaderTxt.textContent = txt;
    el.loaderProg.style.width = pct + '%';
}

// ========== الفهرسة ==========
async function indexPDF() {
    el.status.textContent = 'جاري تجهيز البحث...';
    el.status.className = 'search-status';
    pdfText = [];
    
    for (let i = 1; i <= totalPages; i++) {
        setLoader(`فهرسة ${i}/${totalPages}`, 20 + (i/totalPages)*75);
        el.status.textContent = `فهرسة ${i}/${totalPages}...`;
        
        try {
            const pg = await pdf.getPage(i);
            const txt = await pg.getTextContent();
            const str = txt.items.map(t => t.str).join(' ');
            pdfText.push({ page: i, text: str, items: txt.items });
        } catch {
            pdfText.push({ page: i, text: '', items: [] });
        }
    }
    
    indexed = true;
    el.status.textContent = `✅ جاهز (${totalPages} صفحة)`;
    el.status.className = 'search-status ready';
    setTimeout(() => el.status.classList.add('hide'), 3000);
}

// ========== العرض ==========
async function renderPage(num) {
    if (!pdf || num < 1 || num > totalPages) return;
    currentPage = num;
    
    const pg = await pdf.getPage(num);
    const vp = pg.getViewport({ scale });
    
    const ratio = window.devicePixelRatio || 1;
    el.canvas.width = vp.width * ratio;
    el.canvas.height = vp.height * ratio;
    el.canvas.style.width = vp.width + 'px';
    el.canvas.style.height = vp.height + 'px';
    
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    
    // طبقة النص
    await renderTextLayer(pg, vp);
    
    // تحديث UI
    el.pageNum.value = num;
    el.pageRange.value = num;
    el.pagePrev.disabled = num <= 1;
    el.pageNext.disabled = num >= totalPages;
}

async function renderTextLayer(pg, vp) {
    const txt = await pg.getTextContent();
    el.textLayer.innerHTML = '';
    el.textLayer.style.width = vp.width + 'px';
    el.textLayer.style.height = vp.height + 'px';
    
    txt.items.forEach(item => {
        const span = document.createElement('span');
        const [a,b,c,d,e,f] = item.transform;
        const fs = Math.hypot(a, b);
        
        span.textContent = item.str;
        span.style.left = e + 'px';
        span.style.top = (vp.height - f) + 'px';
        span.style.fontSize = fs * scale + 'px';
        span.style.transform = `scaleX(${a/fs})`;
        
        el.textLayer.appendChild(span);
    });
}

function goPage(n) {
    n = Math.max(1, Math.min(totalPages, n));
    renderPage(n);
}

function setZoom(z) {
    scale = Math.max(0.5, Math.min(3, z));
    el.zoomVal.textContent = Math.round(scale * 100) + '%';
    renderPage(currentPage);
}

function fitWidth() {
    const w = el.container.clientWidth - 40;
    scale = w / 612;
    el.zoomVal.textContent = Math.round(scale * 100) + '%';
    renderPage(currentPage);
}

// ========== البحث ==========
function onSearchInput(e) {
    const v = e.target.value;
    el.clearBtn.style.display = v ? 'block' : 'none';
    
    clearTimeout(debounce);
    if (v.length >= 2) {
        debounce = setTimeout(doSearch, 350);
    } else if (v.length === 0) {
        clearSearch();
    }
}

function doSearch() {
    const q = el.searchIn.value.trim();
    if (!q || !indexed) return;
    
    addHistory(q);
    
    results = [];
    const qLow = q.toLowerCase();
    const qAr = toAr(q);
    const qEn = toEn(q);
    
    pdfText.forEach(p => {
        if (!p.text) return;
        const tLow = p.text.toLowerCase();
        
        let cnt = 0;
        [qLow, qAr.toLowerCase(), qEn.toLowerCase()].forEach(qx => {
            let i = 0;
            while ((i = tLow.indexOf(qx, i)) !== -1) { cnt++; i++; }
        });
        
        if (cnt) {
            const i = tLow.indexOf(qLow);
            const s = Math.max(0, i - 50);
            const e = Math.min(p.text.length, i + q.length + 50);
            let ctx = p.text.slice(s, e);
            if (s > 0) ctx = '...' + ctx;
            if (e < p.text.length) ctx += '...';
            
            results.push({ page: p.page, count: cnt, ctx });
        }
    });
    
    showResults(q);
    if (results.length) { resultIdx = 0; gotoResult(0); }
}

function showResults(q) {
    el.sidebar.classList.remove('collapsed');
    
    if (!results.length) {
        el.stats.classList.remove('show');
        el.resultsList.innerHTML = `
            <div class="placeholder">
                <span>😕</span>
                <p>لا نتائج لـ "${q}"</p>
            </div>`;
        el.prevBtn.disabled = el.nextBtn.disabled = true;
        el.resultPos.textContent = '-';
        return;
    }
    
    const total = results.reduce((s,r) => s + r.count, 0);
    el.stats.textContent = `✅ ${total} نتيجة في ${results.length} صفحة`;
    el.stats.classList.add('show');
    
    el.prevBtn.disabled = true;
    el.nextBtn.disabled = results.length <= 1;
    el.resultPos.textContent = `1/${results.length}`;
    
    const rx = new RegExp(`(${escRx(q)})`, 'gi');
    el.resultsList.innerHTML = results.map((r, i) => `
        <div class="result-card ${i===0?'active':''}" data-i="${i}">
            <div class="result-card-header">
                <span class="page-tag">📄 ${r.page}</span>
                <span class="match-tag">${r.count} تطابق</span>
            </div>
            <div class="result-card-body">
                ${r.ctx.replace(rx, '<span class="hl">$1</span>')}
            </div>
            <button class="go-page-btn" onclick="gotoResult(${i})">← انتقال للصفحة</button>
        </div>
    `).join('');
    
    // ربط النقر
    el.resultsList.querySelectorAll('.result-card').forEach(c => {
        c.onclick = () => gotoResult(+c.dataset.i);
    });
}

window.gotoResult = function(i) {
    if (i < 0 || i >= results.length) return;
    resultIdx = i;
    
    el.resultsList.querySelectorAll('.result-card').forEach((c, j) => {
        c.classList.toggle('active', j === i);
    });
    
    el.resultPos.textContent = `${i+1}/${results.length}`;
    el.prevBtn.disabled = i === 0;
    el.nextBtn.disabled = i === results.length - 1;
    
    goPage(results[i].page);
    
    const card = el.resultsList.querySelector(`.result-card[data-i="${i}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    toast(`📄 صفحة ${results[i].page}`);
};

function navResult(d) {
    const n = resultIdx + d;
    if (n >= 0 && n < results.length) gotoResult(n);
}

function clearSearch() {
    el.searchIn.value = '';
    el.clearBtn.style.display = 'none';
    el.stats.classList.remove('show');
    results = [];
    resultIdx = -1;
    el.prevBtn.disabled = el.nextBtn.disabled = true;
    el.resultPos.textContent = '-';
    el.resultsList.innerHTML = `
        <div class="placeholder">
            <span>🔍</span>
            <p>اكتب للبحث</p>
        </div>`;
}

// ========== التاريخ ==========
function addHistory(q) {
    history = history.filter(h => h !== q);
    history.unshift(q);
    history = history.slice(0, 8);
    localStorage.setItem('pdfHistory', JSON.stringify(history));
    showHistory();
}

function showHistory() {
    if (!history.length) {
        el.historyTags.innerHTML = '<span style="color:var(--text2);font-size:0.8rem;">لا يوجد</span>';
        return;
    }
    el.historyTags.innerHTML = history.map(h => 
        `<span class="history-tag" onclick="useHistory('${h}')">${h}</span>`
    ).join('');
}

window.useHistory = function(q) {
    el.searchIn.value = q;
    doSearch();
};

// ========== الثيم ==========
function toggleTheme() {
    document.body.classList.toggle('light');
    el.themeBtn.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
}

// ========== الاختصارات ==========
function onKey(e) {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.key) {
        case 'ArrowUp': e.preventDefault(); navResult(-1); break;
        case 'ArrowDown': e.preventDefault(); navResult(1); break;
        case 'ArrowLeft': goPage(currentPage + 1); break;
        case 'ArrowRight': goPage(currentPage - 1); break;
        case '+': case '=': setZoom(scale + 0.25); break;
        case '-': setZoom(scale - 0.25); break;
        case 'f': case 'F':
            if (e.ctrlKey) { e.preventDefault(); el.searchIn.focus(); }
            break;
    }
}

// ========== المساعدات ==========
function toAr(s) {
    const ar = '٠١٢٣٤٥٦٧٨٩';
    return s.replace(/[0-9]/g, d => ar[d]);
}

function toEn(s) {
    return s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function escRx(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

// ========== البدء ==========
init();
