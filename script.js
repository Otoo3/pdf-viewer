// ========== الإعدادات ==========
var GOOGLE_DRIVE_FILE_ID = '1sxY3ePFcEOrEaJFsQ6vI8vX9NS7MEA5V';
var PDF_FILE = 'HS Code 2026.pdf';

// ========== PDF.js ==========
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ========== المتغيرات ==========
var pdfText = [];
var results = [];
var resultIdx = -1;
var totalPages = 0;
var indexed = false;
var history = [];
var debounceTimer = null;

// ========== بدء التطبيق ==========
document.addEventListener('DOMContentLoaded', function() {
    // تحميل التاريخ
    try {
        history = JSON.parse(localStorage.getItem('pdfHistory')) || [];
    } catch(e) {
        history = [];
    }
    
    // إعداد العارض
    setupViewer();
    
    // ربط الأحداث
    setupEvents();
    
    // عرض التاريخ
    showHistory();
    
    // بدء الفهرسة
    indexPDF();
});

// ========== إعداد العارض ==========
function setupViewer() {
    var frame = document.getElementById('pdfFrame');
    var downloadBtn = document.getElementById('downloadBtn');
    
    // عرض PDF عبر Google Drive
    frame.src = 'https://drive.google.com/file/d/' + GOOGLE_DRIVE_FILE_ID + '/preview';
    
    // رابط التحميل
    downloadBtn.href = 'https://drive.google.com/uc?export=download&id=' + GOOGLE_DRIVE_FILE_ID;
}

// ========== ربط الأحداث ==========
function setupEvents() {
    // البحث
    document.getElementById('searchInput').addEventListener('input', onSearchInput);
    document.getElementById('searchInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doSearch();
    });
    
    // مسح البحث
    document.getElementById('clearBtn').addEventListener('click', clearSearch);
    
    // الشريط الجانبي
    document.getElementById('sidebarToggle').addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
    
    // التنقل بين النتائج
    document.getElementById('prevBtn').addEventListener('click', function() { navResult(-1); });
    document.getElementById('nextBtn').addEventListener('click', function() { navResult(1); });
    
    // الثيم
    document.getElementById('themeBtn').addEventListener('click', function() {
        document.body.classList.toggle('light');
        this.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
    });
    
    // اختصارات لوحة المفاتيح
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'ArrowUp') { e.preventDefault(); navResult(-1); }
        if (e.key === 'ArrowDown') { e.preventDefault(); navResult(1); }
    });
}

// ========== فهرسة PDF للبحث ==========
function indexPDF() {
    var status = document.getElementById('searchStatus');
    status.textContent = 'جاري تجهيز البحث...';
    status.className = 'search-status';
    
    // محاولة التحميل من GitHub أولاً
    tryLoadPDF(PDF_FILE)
        .then(function(pdf) {
            return extractText(pdf);
        })
        .catch(function() {
            // محاولة من Google Drive
            status.textContent = 'جاري المحاولة من مصدر آخر...';
            var proxyUrl = 'https://api.allorigins.win/raw?url=' + 
                encodeURIComponent('https://drive.google.com/uc?export=download&id=' + GOOGLE_DRIVE_FILE_ID);
            return tryLoadPDF(proxyUrl).then(extractText);
        })
        .catch(function() {
            // محاولة أخرى
            var proxyUrl2 = 'https://corsproxy.io/?' + 
                encodeURIComponent('https://drive.google.com/uc?export=download&id=' + GOOGLE_DRIVE_FILE_ID);
            return tryLoadPDF(proxyUrl2).then(extractText);
        })
        .then(function() {
            indexed = true;
            status.textContent = '✅ جاهز للبحث (' + totalPages + ' صفحة)';
            status.className = 'search-status ready';
            setTimeout(function() { status.classList.add('hidden'); }, 3000);
        })
        .catch(function(err) {
            console.error('فشل الفهرسة:', err);
            status.textContent = '⚠️ يمكنك البحث بعد رفع الملف يدوياً';
            showManualUpload();
        });
}

function tryLoadPDF(url) {
    return pdfjsLib.getDocument({
        url: url,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
    }).promise;
}

function extractText(pdf) {
    totalPages = pdf.numPages;
    pdfText = [];
    
    var status = document.getElementById('searchStatus');
    var promises = [];
    
    for (var i = 1; i <= totalPages; i++) {
        promises.push(extractPageText(pdf, i, status));
    }
    
    return Promise.all(promises);
}

function extractPageText(pdf, pageNum, status) {
    return pdf.getPage(pageNum).then(function(page) {
        status.textContent = 'فهرسة ' + pageNum + '/' + totalPages + '...';
        return page.getTextContent();
    }).then(function(textContent) {
        var text = textContent.items.map(function(item) { return item.str; }).join(' ');
        pdfText.push({ page: pageNum, text: text });
    }).catch(function() {
        pdfText.push({ page: pageNum, text: '' });
    });
}

function showManualUpload() {
    var status = document.getElementById('searchStatus');
    status.innerHTML = '⚠️ <label style="cursor:pointer;text-decoration:underline;">ارفع الملف للبحث<input type="file" accept=".pdf" style="display:none" onchange="handleManualUpload(event)"></label>';
}

function handleManualUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    var status = document.getElementById('searchStatus');
    status.textContent = 'جاري قراءة الملف...';
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var data = new Uint8Array(e.target.result);
        pdfjsLib.getDocument({
            data: data,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true
        }).promise.then(function(pdf) {
            return extractText(pdf);
        }).then(function() {
            indexed = true;
            status.textContent = '✅ جاهز للبحث (' + totalPages + ' صفحة)';
            status.className = 'search-status ready';
            setTimeout(function() { status.classList.add('hidden'); }, 3000);
        });
    };
    reader.readAsArrayBuffer(file);
}

// ========== البحث ==========
function onSearchInput(e) {
    var value = e.target.value;
    document.getElementById('clearBtn').style.display = value ? 'block' : 'none';
    
    clearTimeout(debounceTimer);
    if (value.length >= 2) {
        debounceTimer = setTimeout(doSearch, 400);
    } else if (value.length === 0) {
        clearSearch();
    }
}

function doSearch() {
    var query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    if (!indexed) {
        showToast('⏳ انتظر اكتمال التجهيز أو ارفع الملف');
        return;
    }
    
    addHistory(query);
    
    results = [];
    var queryLower = query.toLowerCase();
    var queryAr = toArabic(query);
    var queryEn = toEnglish(query);
    
    pdfText.forEach(function(p) {
        if (!p.text) return;
        var textLower = p.text.toLowerCase();
        
        var count = 0;
        [queryLower, queryAr.toLowerCase(), queryEn.toLowerCase()].forEach(function(q) {
            var idx = 0;
            while ((idx = textLower.indexOf(q, idx)) !== -1) {
                count++;
                idx++;
            }
        });
        
        if (count > 0) {
            var idx = textLower.indexOf(queryLower);
            if (idx === -1) idx = 0;
            var start = Math.max(0, idx - 50);
            var end = Math.min(p.text.length, idx + query.length + 50);
            var context = p.text.substring(start, end);
            if (start > 0) context = '...' + context;
            if (end < p.text.length) context += '...';
            
            results.push({ page: p.page, count: count, context: context });
        }
    });
    
    // ترتيب حسب عدد التطابقات
    results.sort(function(a, b) { return b.count - a.count; });
    
    showResults(query);
    
    if (results.length > 0) {
        resultIdx = 0;
        gotoResult(0);
    }
}

function showResults(query) {
    var sidebar = document.getElementById('sidebar');
    var stats = document.getElementById('statsBar');
    var list = document.getElementById('resultsList');
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    var pos = document.getElementById('resultPos');
    
    sidebar.classList.remove('collapsed');
    
    if (results.length === 0) {
        stats.textContent = '';
        list.innerHTML = '<div class="placeholder"><span>😕</span><p>لا نتائج لـ "' + query + '"</p></div>';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        pos.textContent = '-';
        return;
    }
    
    var total = results.reduce(function(s, r) { return s + r.count; }, 0);
    stats.textContent = '✅ ' + total + ' نتيجة في ' + results.length + ' صفحة';
    
    prevBtn.disabled = true;
    nextBtn.disabled = results.length <= 1;
    pos.textContent = '1/' + results.length;
    
    var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('(' + escaped + ')', 'gi');
    
    var html = '';
    results.forEach(function(r, i) {
        var highlighted = r.context.replace(regex, '<span class="hl">$1</span>');
        html += '<div class="result-card' + (i === 0 ? ' active' : '') + '" onclick="gotoResult(' + i + ')">';
        html += '<div class="result-card-header">';
        html += '<span class="page-tag">📄 صفحة ' + r.page + '</span>';
        html += '<span class="match-tag">' + r.count + ' تطابق</span>';
        html += '</div>';
        html += '<div class="result-card-body">' + highlighted + '</div>';
        html += '<button class="go-page-btn" onclick="event.stopPropagation(); gotoResult(' + i + ')">← انتقال للصفحة</button>';
        html += '</div>';
    });
    
    list.innerHTML = html;
}

function gotoResult(index) {
    if (index < 0 || index >= results.length) return;
    resultIdx = index;
    
    // تحديث الكارت النشط
    var cards = document.querySelectorAll('.result-card');
    cards.forEach(function(card, i) {
        card.classList.toggle('active', i === index);
    });
    
    // تحديث الموقع
    document.getElementById('resultPos').textContent = (index + 1) + '/' + results.length;
    document.getElementById('prevBtn').disabled = index === 0;
    document.getElementById('nextBtn').disabled = index === results.length - 1;
    
    // الانتقال للصفحة في العارض
    var pageNum = results[index].page;
    goToPage(pageNum);
    
    // تمرير الكارت
    var activeCard = document.querySelector('.result-card.active');
    if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    showToast('📄 صفحة ' + pageNum);
}

function goToPage(pageNum) {
    var frame = document.getElementById('pdfFrame');
    var pageInfo = document.getElementById('pageInfo');
    
    // تحديث العارض مع رقم الصفحة
    frame.src = 'https://drive.google.com/file/d/' + GOOGLE_DRIVE_FILE_ID + '/preview#page=' + pageNum;
    pageInfo.textContent = 'صفحة ' + pageNum;
}

function navResult(dir) {
    var newIdx = resultIdx + dir;
    if (newIdx >= 0 && newIdx < results.length) {
        gotoResult(newIdx);
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
    try {
        localStorage.setItem('pdfHistory', JSON.stringify(history));
    } catch(e) {}
    showHistory();
}

function showHistory() {
    var container = document.getElementById('historyTags');
    if (!history || history.length === 0) {
        container.innerHTML = '<span style="color:var(--text2);font-size:0.85rem;">لا يوجد</span>';
        return;
    }
    
    var html = '';
    history.forEach(function(h) {
        html += '<span class="history-tag" onclick="useHistory(\'' + h.replace(/'/g, "\\'") + '\')">' + h + '</span>';
    });
    container.innerHTML = html;
}

function useHistory(query) {
    document.getElementById('searchInput').value = query;
    doSearch();
}

// ========== المساعدات ==========
function toArabic(str) {
    var ar = '٠١٢٣٤٥٦٧٨٩';
    return str.replace(/[0-9]/g, function(d) { return ar[d]; });
}

function toEnglish(str) {
    var en = '0123456789';
    var ar = '٠١٢٣٤٥٦٧٨٩';
    return str.replace(/[٠-٩]/g, function(d) { return en[ar.indexOf(d)]; });
}

function showToast(msg) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 2500);
}

// جعل الدوال متاحة عالمياً
window.gotoResult = gotoResult;
window.useHistory = useHistory;
window.handleManualUpload = handleManualUpload;
