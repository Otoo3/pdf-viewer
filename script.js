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
var searchHistoryList = []; // تغيير الاسم
var debounceTimer = null;

// ========== بدء التطبيق ==========
document.addEventListener('DOMContentLoaded', function() {
    // تحميل التاريخ
    try {
        var saved = localStorage.getItem('pdfSearchHistory');
        searchHistoryList = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(searchHistoryList)) searchHistoryList = [];
    } catch(e) {
        searchHistoryList = [];
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
    
    // عرض PDF عبر Google Docs Viewer
    var pdfUrl = 'https://drive.google.com/uc?export=download&id=' + GOOGLE_DRIVE_FILE_ID;
    frame.src = 'https://docs.google.com/viewer?url=' + encodeURIComponent(pdfUrl) + '&embedded=true';
    
    // رابط التحميل
    downloadBtn.href = pdfUrl;
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
    
    // المحاولات المتعددة
    var attempts = [
        PDF_FILE,
        'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://drive.google.com/uc?export=download&id=' + GOOGLE_DRIVE_FILE_ID),
        'https://corsproxy.io/?' + encodeURIComponent('https://drive.google.com/uc?export=download&id=' + GOOGLE_DRIVE_FILE_ID)
    ];
    
    tryNextAttempt(attempts, 0, status);
}

function tryNextAttempt(attempts, index, status) {
    if (index >= attempts.length) {
        status.textContent = '⚠️ ارفع الملف للبحث';
        showManualUpload(status);
        return;
    }
    
    status.textContent = 'محاولة ' + (index + 1) + ' من ' + attempts.length + '...';
    
    pdfjsLib.getDocument({
        url: attempts[index],
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
    }).promise.then(function(pdf) {
        extractAllText(pdf, status);
    }).catch(function(err) {
        console.log('محاولة ' + (index + 1) + ' فشلت:', err.message);
        tryNextAttempt(attempts, index + 1, status);
    });
}

function extractAllText(pdf, status) {
    totalPages = pdf.numPages;
    pdfText = [];
    var completed = 0;
    
    for (var i = 1; i <= totalPages; i++) {
        (function(pageNum) {
            pdf.getPage(pageNum).then(function(page) {
                return page.getTextContent();
            }).then(function(textContent) {
                var text = textContent.items.map(function(item) { 
                    return item.str; 
                }).join(' ');
                pdfText[pageNum - 1] = { page: pageNum, text: text };
                completed++;
                status.textContent = 'فهرسة ' + completed + '/' + totalPages + '...';
                
                if (completed === totalPages) {
                    finishIndexing(status);
                }
            }).catch(function() {
                pdfText[pageNum - 1] = { page: pageNum, text: '' };
                completed++;
                if (completed === totalPages) {
                    finishIndexing(status);
                }
            });
        })(i);
    }
}

function finishIndexing(status) {
    // ترتيب حسب رقم الصفحة
    pdfText.sort(function(a, b) { return a.page - b.page; });
    
    indexed = true;
    status.textContent = '✅ جاهز للبحث (' + totalPages + ' صفحة)';
    status.className = 'search-status ready';
    
    setTimeout(function() { 
        status.classList.add('hidden'); 
    }, 3000);
}

function showManualUpload(status) {
    status.innerHTML = '⚠️ <label style="cursor:pointer;color:#60a5fa;text-decoration:underline;">اضغط هنا لرفع الملف<input type="file" accept=".pdf" style="display:none" id="manualFileInput"></label>';
    
    document.getElementById('manualFileInput').addEventListener('change', function(e) {
        handleManualUpload(e);
    });
}

function handleManualUpload(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    var status = document.getElementById('searchStatus');
    status.textContent = 'جاري قراءة الملف...';
    status.className = 'search-status';
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var data = new Uint8Array(e.target.result);
        pdfjsLib.getDocument({
            data: data,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true
        }).promise.then(function(pdf) {
            extractAllText(pdf, status);
        }).catch(function(err) {
            status.textContent = '❌ خطأ: ' + err.message;
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
    
    addToHistory(query);
    
    results = [];
    var queryLower = query.toLowerCase();
    var queryAr = toArabic(query);
    var queryEn = toEnglish(query);
    
    pdfText.forEach(function(p) {
        if (!p || !p.text) return;
        var textLower = p.text.toLowerCase();
        
        var count = 0;
        [queryLower, queryAr.toLowerCase(), queryEn.toLowerCase()].forEach(function(q) {
            if (!q) return;
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
    document.getElementById('pageInfo').textContent = 'صفحة ' + pageNum + ' من ' + totalPages;
    
    // تمرير الكارت
    var activeCard = document.querySelector('.result-card.active');
    if (activeCard) activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    showToast('📄 صفحة ' + pageNum + ' - استخدم شريط التمرير في العارض');
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
function addToHistory(query) {
    searchHistoryList = searchHistoryList.filter(function(h) { return h !== query; });
    searchHistoryList.unshift(query);
    searchHistoryList = searchHistoryList.slice(0, 8);
    try {
        localStorage.setItem('pdfSearchHistory', JSON.stringify(searchHistoryList));
    } catch(e) {}
    showHistory();
}

function showHistory() {
    var container = document.getElementById('historyTags');
    if (!searchHistoryList || searchHistoryList.length === 0) {
        container.innerHTML = '<span style="color:var(--text2);font-size:0.85rem;">لا يوجد</span>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < searchHistoryList.length; i++) {
        var h = searchHistoryList[i];
        html += '<span class="history-tag" onclick="useHistory(\'' + h.replace(/'/g, "\\'") + '\')">' + h + '</span>';
    }
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
    setTimeout(function() { toast.classList.remove('show'); }, 3000);
}

// جعل الدوال متاحة عالمياً
window.gotoResult = gotoResult;
window.useHistory = useHistory;
