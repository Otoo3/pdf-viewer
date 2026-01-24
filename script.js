// ========== الإعدادات ==========
const PDF_FILE = 'HS Code 2026.pdf';

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
let debounceTimer = null;

// ========== تهيئة التطبيق ==========
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    // ربط الأحداث
    document.getElementById('searchInput').addEventListener('input', onSearchInput);
    document.getElementById('searchInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doSearch();
    });
    document.getElementById('clearBtn').addEventListener('click', clearSearch);
    document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);
    document.getElementById('prevBtn').addEventListener('click', function() { navResult(-1); });
    document.getElementById('nextBtn').addEventListener('click', function() { navResult(1); });
    document.getElementById('pagePrev').addEventListener('click', function() { goPage(currentPage - 1); });
    document.getElementById('pageNext').addEventListener('click', function() { goPage(currentPage + 1); });
    document.getElementById('pageNum').addEventListener('change', function(e) { goPage(parseInt(e.target.value)); });
    document.getElementById('pageRange').addEventListener('input', function(e) { goPage(parseInt(e.target.value)); });
    document.getElementById('zoomIn').addEventListener('click', function() { setZoom(scale + 0.25); });
    document.getElementById('zoomOut').addEventListener('click', function() { setZoom(scale - 0.25); });
    document.getElementById('zoomFit').addEventListener('click', fitWidth);
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    document.addEventListener('keydown', onKeyDown);

    // عرض التاريخ
    showHistory();
    
    // تحميل PDF
    loadPDF();
}

// ========== تحميل PDF ==========
async function loadPDF() {
    setLoader('جاري تحميل الملف...', 10);
    
    try {
        pdf = await pdfjsLib.getDocument({
            url: PDF_FILE,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
        }).promise;
        
        totalPages = pdf.numPages;
        document.getElementById('pageTotal').textContent = totalPages;
        document.getElementById('pageRange').max = totalPages;
        
        setLoader('جاري عرض الصفحة الأولى...', 30);
        await renderPage(1);
        
        await indexPDF();
        
        document.getElementById('loadingScreen').classList.add('hide');
        document.getElementById('searchInput').focus();
        
    } catch (err) {
        setLoader('❌ خطأ في تحميل الملف: ' + err.message, 0);
        console.error('خطأ:', err);
    }
}

function setLoader(text, percent) {
    document.getElementById('loaderText').textContent = text;
    document.getElementById('loaderProgress').style.width = percent + '%';
}

// ========== فهرسة PDF ==========
async function indexPDF() {
    const status = document.getElementById('searchStatus');
    status.textContent = 'جاري تجهيز البحث...';
    status.className = 'search-status';
    pdfText = [];
    
    for (let i = 1; i <= totalPages; i++) {
        setLoader('فهرسة الصفحة ' + i + ' من ' + totalPages, 30 + (i / totalPages) * 65);
        status.textContent = 'فهرسة ' + i + '/' + totalPages + '...';
        
        try {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(function(item) { return item.str; }).join(' ');
            pdfText.push({ page: i, text: text });
        } catch (e) {
            pdfText.push({ page: i, text: '' });
        }
    }
    
    indexed = true;
    status.textContent = '✅ جاهز للبحث (' + totalPages + ' صفحة)';
    status.className = 'search-status ready';
    
    setTimeout(function() {
        status.textContent = '';
    }, 3000);
}

// ========== عرض الصفحة ==========
async function renderPage(num) {
    if (!pdf || num < 1 || num > totalPages) return;
    currentPage = num;
    
    const page = await pdf.getPage(num);
    const viewport = page.getViewport({ scale: scale });
    
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    
    const ratio = window.devicePixelRatio || 1;
    canvas.width = viewport.width * ratio;
    canvas.height = viewport.height * ratio;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    
    // طبقة النص
    await renderTextLayer(page, viewport);
    
    // تحديث الواجهة
    document.getElementById('pageNum').value = num;
    document.getElementById('pageRange').value = num;
    document.getElementById('pagePrev').disabled = num <= 1;
    document.getElementById('pageNext').disabled = num >= totalPages;
}

async function renderTextLayer(page, viewport) {
    const textContent = await page.getTextContent();
    const textLayer = document.getElementById('textLayer');
    textLayer.innerHTML = '';
    textLayer.style.width = viewport.width + 'px';
    textLayer.style.height = viewport.height + 'px';
    
    textContent.items.forEach(function(item) {
        const span = document.createElement('span');
        const transform = item.transform;
        const fontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
        
        span.textContent = item.str;
        span.style.left = transform[4] + 'px';
        span.style.top = (viewport.height - transform[5]) + 'px';
        span.style.fontSize = fontSize * scale + 'px';
        
        textLayer.appendChild(span);
    });
}

function goPage(num) {
    num = Math.max(1, Math.min(totalPages, num));
    renderPage(num);
}

function setZoom(z) {
    scale = Math.max(0.5, Math.min(3, z));
    document.getElementById('zoomVal').textContent = Math.round(scale * 100) + '%';
    renderPage(currentPage);
}

function fitWidth() {
    const container = document.getElementById('pdfContainer');
    const width = container.clientWidth - 40;
    scale = width / 612;
    document.getElementById('zoomVal').textContent = Math.round(scale * 100) + '%';
    renderPage(currentPage);
}

// ========== البحث ==========
function onSearchInput(e) {
    const value = e.target.value;
    document.getElementById('clearBtn').style.display = value ? 'block' : 'none';
    
    clearTimeout(debounceTimer);
    if (value.length >= 2) {
        debounceTimer = setTimeout(doSearch, 400);
    } else if (value.length === 0) {
        clearSearch();
    }
}

function doSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query || !indexed) return;
    
    addHistory(query);
    
    results = [];
    const queryLower = query.toLowerCase();
    const queryArabic = toArabicNums(query);
    const queryEnglish = toEnglishNums(query);
    
    pdfText.forEach(function(p) {
        if (!p.text) return;
        const textLower = p.text.toLowerCase();
        
        let count = 0;
        [queryLower, queryArabic.toLowerCase(), queryEnglish.toLowerCase()].forEach(function(q) {
            let idx = 0;
            while ((idx = textLower.indexOf(q, idx)) !== -1) {
                count++;
                idx++;
            }
        });
        
        if (count > 0) {
            const idx = textLower.indexOf(queryLower);
            const start = Math.max(0, idx - 50);
            const end = Math.min(p.text.length, idx + query.length + 50);
            let context = p.text.substring(start, end);
            if (start > 0) context = '...' + context;
            if (end < p.text.length) context += '...';
            
            results.push({ page: p.page, count: count, context: context });
        }
    });
    
    showResults(query);
    
    if (results.length > 0) {
        resultIdx = 0;
        gotoResult(0);
    }
}

function showResults(query) {
    const sidebar = document.getElementById('sidebar');
    const stats = document.getElementById('statsBar');
    const list = document.getElementById('resultsList');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pos = document.getElementById('resultPos');
    
    sidebar.classList.remove('collapsed');
    
    if (results.length === 0) {
        stats.textContent = '';
        list.innerHTML = '<div class="placeholder"><span>😕</span><p>لا نتائج لـ "' + query + '"</p></div>';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        pos.textContent = '-';
        return;
    }
    
    const total = results.reduce(function(sum, r) { return sum + r.count; }, 0);
    stats.textContent = '✅ ' + total + ' نتيجة في ' + results.length + ' صفحة';
    
    prevBtn.disabled = true;
    nextBtn.disabled = results.length <= 1;
    pos.textContent = '1/' + results.length;
    
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escapedQuery + ')', 'gi');
    
    let html = '';
    results.forEach(function(r, i) {
        const highlighted = r.context.replace(regex, '<span class="hl">$1</span>');
        html += '<div class="result-card' + (i === 0 ? ' active' : '') + '" data-index="' + i + '">';
        html += '<div class="result-card-header">';
        html += '<span class="page-tag">📄 صفحة ' + r.page + '</span>';
        html += '<span class="match-tag">' + r.count + ' تطابق</span>';
        html += '</div>';
        html += '<div class="result-card-body">' + highlighted + '</div>';
        html += '<button class="go-page-btn" onclick="gotoResult(' + i + ')">← انتقال للصفحة</button>';
        html += '</div>';
    });
    
    list.innerHTML = html;
    
    // ربط النقر على البطاقات
    list.querySelectorAll('.result-card').forEach(function(card) {
        card.addEventListener('click', function() {
            gotoResult(parseInt(card.dataset.index));
        });
    });
}

function gotoResult(index) {
    if (index < 0 || index >= results.length) return;
    resultIdx = index;
    
    // تحديث البطاقة النشطة
    document.querySelectorAll('.result-card').forEach(function(card, i) {
        card.classList.toggle('active', i === index);
    });
    
    // تحديث الموقع
    document.getElementById('resultPos').textContent = (index + 1) + '/' + results.length;
    document.getElementById('prevBtn').disabled = index === 0;
    document.getElementById('nextBtn').disabled = index === results.length - 1;
    
    // الانتقال للصفحة
    goPage(results[index].page);
    
    // تمرير البطاقة للعرض
    const card = document.querySelector('.result-card[data-index="' + index + '"]');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    showToast('📄 صفحة ' + results[index].page);
}

function navResult(direction) {
    const newIndex = resultIdx + direction;
    if (newIndex >= 0 && newIndex < results.length) {
        gotoResult(newIndex);
    }
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearBtn').style.display = 'none';
    document.getElementById('statsBar').textContent = '';
    document.getElementById('resultPos').textContent = '-';
    document.getElementById('prevBtn').disabled = true;
    document.getElementById('nextBtn').disabled = true;
    results = [];
    resultIdx = -1;
    
    document.getElementById('resultsList').innerHTML = 
        '<div class="placeholder"><span>🔍</span><p>اكتب للبحث</p></div>';
}

// ========== التاريخ ==========
function addHistory(query) {
    history = history.filter(function(h) { return h !== query; });
    history.unshift(query);
    history = history.slice(0, 8);
    localStorage.setItem('pdfHistory', JSON.stringify(history));
    showHistory();
}

function showHistory() {
    const container = document.getElementById('historyTags');
    if (history.length === 0) {
        container.innerHTML = '<span style="color:var(--text2);font-size:0.8rem;">لا يوجد</span>';
        return;
    }
    
    let html = '';
    history.forEach(function(h) {
        html += '<span class="history-tag" onclick="useHistory(\'' + h + '\')">' + h + '</span>';
    });
    container.innerHTML = html;
}

function useHistory(query) {
    document.getElementById('searchInput').value = query;
    doSearch();
}

// ========== الواجهة ==========
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function toggleTheme() {
    document.body.classList.toggle('light');
    document.getElementById('themeBtn').textContent = 
        document.body.classList.contains('light') ? '☀️' : '🌙';
}

function onKeyDown(e) {
    if (e.target.tagName === 'INPUT') return;
    
    switch (e.key) {
        case 'ArrowUp':
            e.preventDefault();
            navResult(-1);
            break;
        case 'ArrowDown':
            e.preventDefault();
            navResult(1);
            break;
        case 'ArrowLeft':
            goPage(currentPage + 1);
            break;
        case 'ArrowRight':
            goPage(currentPage - 1);
            break;
        case '+':
        case '=':
            setZoom(scale + 0.25);
            break;
        case '-':
            setZoom(scale - 0.25);
            break;
    }
}

// ========== المساعدات ==========
function toArabicNums(str) {
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    return str.replace(/[0-9]/g, function(d) { return arabic[d]; });
}

function toEnglishNums(str) {
    return str.replace(/[٠-٩]/g, function(d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function() {
        toast.classList.remove('show');
    }, 2500);
}

// جعل الدوال متاحة عالمياً
window.gotoResult = gotoResult;
window.useHistory = useHistory;
