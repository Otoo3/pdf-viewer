// ============ الإعدادات ============
const CONFIG = {
    GOOGLE_DRIVE_FILE_ID: '1sxY3ePFcEOrEaJFsQ6vI8vX9NS7MEA5V',
    DEBOUNCE_DELAY: 300,
    MAX_HISTORY: 10,
    HIGHLIGHT_ENABLED: true
};

// ============ PDF.js ============
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============ المتغيرات ============
let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5;
let pdfText = [];
let searchResults = [];
let currentResultIndex = -1;
let isIndexReady = false;
let searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
let debounceTimer = null;

// ============ العناصر ============
const elements = {
    loadingScreen: document.getElementById('loadingScreen'),
    loadingProgress: document.getElementById('loadingProgress'),
    loadingStatus: document.getElementById('loadingStatus'),
    loadingPercent: document.getElementById('loadingPercent'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    clearSearch: document.getElementById('clearSearch'),
    advancedToggle: document.getElementById('advancedToggle'),
    advancedSearch: document.getElementById('advancedSearch'),
    suggestions: document.getElementById('suggestions'),
    indexStatus: document.getElementById('indexStatus'),
    statusText: document.getElementById('statusText'),
    resultsPanel: document.getElementById('resultsPanel'),
    toggleResults: document.getElementById('toggleResults'),
    searchStats: document.getElementById('searchStats'),
    totalResults: document.getElementById('totalResults'),
    currentResult: document.getElementById('currentResult'),
    prevResult: document.getElementById('prevResult'),
    nextResult: document.getElementById('nextResult'),
    resultsList: document.getElementById('resultsList'),
    historyList: document.getElementById('historyList'),
    pdfCanvas: document.getElementById('pdfCanvas'),
    textLayer: document.getElementById('textLayer'),
    highlightLayer: document.getElementById('highlightLayer'),
    pdfContainer: document.getElementById('pdfContainer'),
    currentPageInput: document.getElementById('currentPage'),
    totalPagesSpan: document.getElementById('totalPages'),
    pageSlider: document.getElementById('pageSlider'),
    zoomLevel: document.getElementById('zoomLevel'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    zoomIn: document.getElementById('zoomIn'),
    zoomOut: document.getElementById('zoomOut'),
    zoomFit: document.getElementById('zoomFit'),
    highlightToggle: document.getElementById('highlightToggle'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    fullscreenToggle: document.getElementById('fullscreenToggle'),
    downloadPdf: document.getElementById('downloadPdf')
};

const ctx = elements.pdfCanvas.getContext('2d');

// ============ التهيئة ============
async function init() {
    setupEventListeners();
    renderHistory();
    await loadPDF();
}

function setupEventListeners() {
    // البحث
    elements.searchInput.addEventListener('input', handleSearchInput);
    elements.searchInput.addEventListener('keydown', handleSearchKeydown);
    elements.searchBtn.addEventListener('click', performSearch);
    elements.clearSearch.addEventListener('click', clearSearch);
    
    // البحث المتقدم
    elements.advancedToggle.addEventListener('click', toggleAdvanced);
    
    // التنقل بين النتائج
    elements.prevResult.addEventListener('click', () => navigateResults(-1));
    elements.nextResult.addEventListener('click', () => navigateResults(1));
    
    // لوحة النتائج
    elements.toggleResults.addEventListener('click', toggleResultsPanel);
    
    // التنقل بالصفحات
    elements.prevPage.addEventListener('click', () => changePage(-1));
    elements.nextPage.addEventListener('click', () => changePage(1));
    elements.currentPageInput.addEventListener('change', handlePageInput);
    elements.pageSlider.addEventListener('input', handleSlider);
    
    // التكبير
    elements.zoomIn.addEventListener('click', () => changeZoom(0.25));
    elements.zoomOut.addEventListener('click', () => changeZoom(-0.25));
    elements.zoomFit.addEventListener('click', fitToWidth);
    
    // خيارات
    elements.highlightToggle.addEventListener('click', toggleHighlight);
    elements.darkModeToggle.addEventListener('click', toggleDarkMode);
    elements.fullscreenToggle.addEventListener('click', toggleFullscreen);
    elements.downloadPdf.addEventListener('click', downloadPDF);
    
    // اختصارات لوحة المفاتيح
    document.addEventListener('keydown', handleGlobalKeydown);
    
    // إغلاق الاقتراحات عند النقر خارجها
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            elements.suggestions.classList.remove('active');
        }
    });
}

// ============ تحميل PDF ============
async function loadPDF() {
    updateLoadingStatus('جاري الاتصال...', 5);
    
    const driveUrl = `https://drive.google.com/uc?export=download&id=${CONFIG.GOOGLE_DRIVE_FILE_ID}`;
    
    const attempts = [
        { name: 'Direct', url: driveUrl },
        { name: 'Proxy 1', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(driveUrl)}` },
        { name: 'Proxy 2', url: `https://corsproxy.io/?${encodeURIComponent(driveUrl)}` },
    ];
    
    for (let i = 0; i < attempts.length; i++) {
        updateLoadingStatus(`محاولة ${i + 1} من ${attempts.length}...`, 10 + i * 10);
        
        try {
            const loadingTask = pdfjsLib.getDocument({
                url: attempts[i].url,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
            });
            
            loadingTask.onProgress = (progress) => {
                if (progress.total > 0) {
                    const percent = Math.round((progress.loaded / progress.total) * 50);
                    updateLoadingStatus('جاري التحميل...', 30 + percent);
                }
            };
            
            pdfDoc = await loadingTask.promise;
            totalPages = pdfDoc.numPages;
            
            elements.totalPagesSpan.textContent = totalPages;
            elements.pageSlider.max = totalPages;
            elements.currentPageInput.max = totalPages;
            
            await renderPage(1);
            await indexPDF();
            
            elements.loadingScreen.classList.add('hidden');
            return;
            
        } catch (e) {
            console.log(`❌ فشل ${attempts[i].name}:`, e.message);
        }
    }
    
    showManualUpload();
}

function updateLoadingStatus(text, percent) {
    elements.loadingStatus.textContent = text;
    elements.loadingPercent.textContent = percent + '%';
    elements.loadingProgress.style.width = percent + '%';
}

function showManualUpload() {
    elements.loadingScreen.innerHTML = `
        <div class="loading-content">
            <div class="loading-icon">⚠️</div>
            <h2>تعذر التحميل التلقائي</h2>
            <p>يرجى رفع الملف يدوياً</p>
            <label style="display: inline-block; margin-top: 20px; padding: 15px 30px; 
                          background: linear-gradient(135deg, #3b82f6, #8b5cf6); 
                          color: white; border-radius: 12px; cursor: pointer; font-weight: 600;">
                📁 اختر ملف PDF
                <input type="file" accept=".pdf" onchange="handleFileUpload(event)" style="display:none">
            </label>
        </div>
    `;
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        elements.loadingScreen.innerHTML = `
            <div class="loading-content">
                <div class="loading-icon">📚</div>
                <h2>HS Code 2026</h2>
                <p id="loadingStatus">جاري القراءة...</p>
                <div class="loading-bar">
                    <div id="loadingProgress" class="loading-progress"></div>
                </div>
                <p id="loadingPercent">0%</p>
            </div>
        `;
        
        // إعادة تعيين العناصر
        Object.assign(elements, {
            loadingProgress: document.getElementById('loadingProgress'),
            loadingStatus: document.getElementById('loadingStatus'),
            loadingPercent: document.getElementById('loadingPercent'),
        });
        
        updateLoadingStatus('جاري تحليل الملف...', 20);
        
        const arrayBuffer = await file.arrayBuffer();
        
        pdfDoc = await pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
        }).promise;
        
        totalPages = pdfDoc.numPages;
        elements.totalPagesSpan.textContent = totalPages;
        elements.pageSlider.max = totalPages;
        
        await renderPage(1);
        await indexPDF();
        
        elements.loadingScreen.classList.add('hidden');
        
    } catch (error) {
        showToast('خطأ في قراءة الملف: ' + error.message, 'error');
    }
}

// ============ فهرسة PDF ============
async function indexPDF() {
    const statusDiv = elements.indexStatus;
    statusDiv.classList.remove('hidden', 'ready');
    
    pdfText = [];
    
    for (let i = 1; i <= totalPages; i++) {
        const percent = 50 + Math.round((i / totalPages) * 45);
        updateLoadingStatus(`فهرسة ${i}/${totalPages}...`, percent);
        elements.statusText.textContent = `فهرسة ${i} من ${totalPages}...`;
        
        try {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            
            const items = textContent.items.map(item => ({
                str: item.str,
                transform: item.transform,
                width: item.width,
                height: item.height
            }));
            
            const text = items.map(item => item.str).join(' ');
            
            pdfText.push({
                pageNum: i,
                text: text,
                items: items
            });
        } catch (e) {
            pdfText.push({ pageNum: i, text: '', items: [] });
        }
    }
    
    isIndexReady = true;
    updateLoadingStatus('جاهز!', 100);
    elements.statusText.textContent = `✅ جاهز للبحث (${totalPages} صفحة)`;
    statusDiv.classList.add('ready');
    statusDiv.querySelector('.status-icon').textContent = '✅';
    
    setTimeout(() => statusDiv.classList.add('hidden'), 3000);
}

// ============ عرض الصفحة ============
async function renderPage(num) {
    if (!pdfDoc || num < 1 || num > totalPages) return;
    
    currentPage = num;
    
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale });
    
    const pixelRatio = window.devicePixelRatio || 1;
    const scaledViewport = page.getViewport({ scale: scale * pixelRatio });
    
    elements.pdfCanvas.width = scaledViewport.width;
    elements.pdfCanvas.height = scaledViewport.height;
    elements.pdfCanvas.style.width = viewport.width + 'px';
    elements.pdfCanvas.style.height = viewport.height + 'px';
    
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    
    await page.render({
        canvasContext: ctx,
        viewport: viewport
    }).promise;
    
    // طبقة النص للنسخ
    await renderTextLayer(page, viewport);
    
    // تحديث التظليل
    if (searchResults.length > 0 && CONFIG.HIGHLIGHT_ENABLED) {
        highlightMatches(num);
    }
    
    // تحديث واجهة المستخدم
    elements.currentPageInput.value = num;
    elements.pageSlider.value = num;
    elements.prevPage.disabled = num <= 1;
    elements.nextPage.disabled = num >= totalPages;
}

async function renderTextLayer(page, viewport) {
    const textContent = await page.getTextContent();
    
    elements.textLayer.innerHTML = '';
    elements.textLayer.style.width = viewport.width + 'px';
    elements.textLayer.style.height = viewport.height + 'px';
    
    textContent.items.forEach(item => {
        const div = document.createElement('span');
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        
        div.textContent = item.str;
        div.style.left = tx[4] + 'px';
        div.style.top = tx[5] + 'px';
        div.style.fontSize = Math.abs(tx[0]) + 'px';
        div.style.fontFamily = item.fontName || 'sans-serif';
        
        elements.textLayer.appendChild(div);
    });
}

// ============ البحث ============
function handleSearchInput(e) {
    const query = e.target.value;
    
    // إظهار/إخفاء زر المسح
    elements.clearSearch.style.display = query ? 'block' : 'none';
    
    // إظهار الاقتراحات
    if (query.length >= 2) {
        showSuggestions(query);
    } else {
        elements.suggestions.classList.remove('active');
    }
    
    // بحث تلقائي مع debounce
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        if (query.length >= 2) {
            performSearch();
        }
    }, CONFIG.DEBOUNCE_DELAY);
}

function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
        elements.suggestions.classList.remove('active');
    } else if (e.key === 'Escape') {
        elements.suggestions.classList.remove('active');
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSuggestions(e.key === 'ArrowDown' ? 1 : -1);
    }
}

function showSuggestions(query) {
    const queryLower = query.toLowerCase();
    
    // البحث في التاريخ
    const historySuggestions = searchHistory
        .filter(h => h.toLowerCase().includes(queryLower))
        .slice(0, 5);
    
    if (historySuggestions.length === 0) {
        elements.suggestions.classList.remove('active');
        return;
    }
    
    elements.suggestions.innerHTML = historySuggestions.map((item, i) => `
        <div class="suggestion-item" data-index="${i}" onclick="selectSuggestion('${item}')">
            <span class="icon">🕐</span>
            <span>${item}</span>
        </div>
    `).join('');
    
    elements.suggestions.classList.add('active');
}

function selectSuggestion(text) {
    elements.searchInput.value = text;
    elements.suggestions.classList.remove('active');
    performSearch();
}

function navigateSuggestions(direction) {
    const items = elements.suggestions.querySelectorAll('.suggestion-item');
    if (items.length === 0) return;
    
    const current = elements.suggestions.querySelector('.suggestion-item.selected');
    let index = current ? parseInt(current.dataset.index) + direction : (direction > 0 ? 0 : items.length - 1);
    
    index = Math.max(0, Math.min(index, items.length - 1));
    
    items.forEach(item => item.classList.remove('selected'));
    items[index].classList.add('selected');
    
    elements.searchInput.value = items[index].textContent.trim();
}

function performSearch() {
    const query = elements.searchInput.value.trim();
    
    if (!query || !isIndexReady) return;
    
    // إضافة للتاريخ
    addToHistory(query);
    
    // الحصول على خيارات البحث المتقدم
    const pageFrom = parseInt(document.getElementById('pageFrom').value) || 1;
    const pageTo = parseInt(document.getElementById('pageTo').value) || totalPages;
    const searchType = document.getElementById('searchType').value;
    
    searchResults = [];
    const queryLower = query.toLowerCase();
    const queryArabic = convertNumbers(query, 'ar');
    const queryEnglish = convertNumbers(query, 'en');
    
    pdfText.forEach(page => {
        if (page.pageNum < pageFrom || page.pageNum > pageTo) return;
        if (!page.text) return;
        
        const textLower = page.text.toLowerCase();
        let matches = [];
        let index = 0;
        
        // البحث حسب النوع
        const searchQueries = [queryLower, queryArabic.toLowerCase(), queryEnglish.toLowerCase()];
        
        searchQueries.forEach(q => {
            if (!q) return;
            index = 0;
            
            while ((index = textLower.indexOf(q, index)) !== -1) {
                if (searchType === 'exact') {
                    const before = textLower[index - 1] || ' ';
                    const after = textLower[index + q.length] || ' ';
                    if (!/\s/.test(before) || !/\s/.test(after)) {
                        index++;
                        continue;
                    }
                } else if (searchType === 'startsWith') {
                    const before = textLower[index - 1] || ' ';
                    if (!/\s/.test(before)) {
                        index++;
                        continue;
                    }
                }
                
                matches.push(index);
                index++;
            }
        });
        
        if (matches.length > 0) {
            // إزالة التكرارات
            matches = [...new Set(matches)];
            
            const firstMatch = matches[0];
            const start = Math.max(0, firstMatch - 60);
            const end = Math.min(page.text.length, firstMatch + query.length + 60);
            let context = page.text.substring(start, end);
            
            if (start > 0) context = '...' + context;
            if (end < page.text.length) context = context + '...';
            
            searchResults.push({
                pageNum: page.pageNum,
                count: matches.length,
                context: context,
                matches: matches
            });
        }
    });
    
    displayResults(query);
    
    // الانتقال للنتيجة الأولى
    if (searchResults.length > 0) {
        currentResultIndex = 0;
        goToResult(0);
    }
}

function displayResults(query) {
    const resultsList = elements.resultsList;
    const searchStats = elements.searchStats;
    
    elements.resultsPanel.classList.remove('collapsed');
    
    if (searchResults.length === 0) {
        searchStats.classList.remove('active');
        resultsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😕</div>
                <p>لا توجد نتائج لـ "${query}"</p>
                <small>جرب كلمات أخرى أو تحقق من الإملاء</small>
            </div>
        `;
        return;
    }
    
    const totalMatches = searchResults.reduce((sum, r) => sum + r.count, 0);
    
    elements.totalResults.textContent = `${totalMatches} نتيجة في ${searchResults.length} صفحة`;
    elements.currentResult.textContent = `النتيجة 1 من ${searchResults.length}`;
    searchStats.classList.add('active');
    
    elements.prevResult.disabled = false;
    elements.nextResult.disabled = false;
    
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    
    resultsList.innerHTML = searchResults.map((r, i) => `
        <div class="result-item ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="goToResult(${i})">
            <div class="result-header">
                <span class="page-badge">📄 صفحة ${r.pageNum}</span>
                <span class="match-count">${r.count} تطابق</span>
            </div>
            <div class="result-context">
                ${r.context.replace(regex, '<span class="highlight">$1</span>')}
            </div>
            <div class="result-actions">
                <button class="result-btn primary" onclick="event.stopPropagation(); goToResult(${i})">
                    ← انتقال للصفحة
                </button>
                <button class="result-btn" onclick="event.stopPropagation(); copyPageNumber(${r.pageNum})">
                    📋 نسخ
                </button>
            </div>
        </div>
    `).join('');
}

function goToResult(index) {
    if (index < 0 || index >= searchResults.length) return;
    
    currentResultIndex = index;
    const result = searchResults[index];
    
    // تحديث العنصر النشط
    document.querySelectorAll('.result-item').forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });
    
    elements.currentResult.textContent = `النتيجة ${index + 1} من ${searchResults.length}`;
    
    // تحديث أزرار التنقل
    elements.prevResult.disabled = index === 0;
    elements.nextResult.disabled = index === searchResults.length - 1;
    
    // الانتقال للصفحة
    renderPage(result.pageNum);
    
    // التمرير للنتيجة في القائمة
    const resultElement = document.querySelector(`.result-item[data-index="${index}"]`);
    if (resultElement) {
        resultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    showToast(`📄 الصفحة ${result.pageNum}`, 'success');
}

function navigateResults(direction) {
    const newIndex = currentResultIndex + direction;
    if (newIndex >= 0 && newIndex < searchResults.length) {
        goToResult(newIndex);
    }
}

function highlightMatches(pageNum) {
    elements.highlightLayer.innerHTML = '';
    
    const result = searchResults.find(r => r.pageNum === pageNum);
    if (!result) return;
    
    // TODO: تنفيذ التظليل الفعلي بناءً على إحداثيات النص
    // هذا يتطلب حسابات معقدة للموقع الفعلي
}

function clearSearch() {
    elements.searchInput.value = '';
    elements.clearSearch.style.display = 'none';
    elements.suggestions.classList.remove('active');
    elements.searchStats.classList.remove('active');
    searchResults = [];
    currentResultIndex = -1;
    elements.highlightLayer.innerHTML = '';
    
    elements.resultsList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <p>ابدأ البحث للعثور على النتائج</p>
            <small>اكتب في مربع البحث أعلاه</small>
        </div>
    `;
}

// ============ التاريخ ============
function addToHistory(query) {
    searchHistory = searchHistory.filter(h => h !== query);
    searchHistory.unshift(query);
    searchHistory = searchHistory.slice(0, CONFIG.MAX_HISTORY);
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    renderHistory();
}

function renderHistory() {
    if (searchHistory.length === 0) {
        elements.historyList.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.85rem;">لا يوجد تاريخ</span>';
        return;
    }
    
    elements.historyList.innerHTML = searchHistory.map(h => `
        <span class="history-item" onclick="searchFromHistory('${h}')">${h}</span>
    `).join('');
}

function searchFromHistory(query) {
    elements.searchInput.value = query;
    performSearch();
}

// ============ التنقل ============
function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        renderPage(newPage);
    }
}

function handlePageInput(e) {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= totalPages) {
        renderPage(page);
    } else {
        e.target.value = currentPage;
    }
}

function handleSlider(e) {
    renderPage(parseInt(e.target.value));
}

// ============ التكبير ============
function changeZoom(delta) {
    scale = Math.max(0.5, Math.min(3, scale + delta));
    elements.zoomLevel.textContent = Math.round(scale * 100) + '%';
    renderPage(currentPage);
}

function fitToWidth() {
    const containerWidth = elements.pdfContainer.clientWidth - 40;
    scale = containerWidth / 612; // عرض صفحة PDF القياسي
    elements.zoomLevel.textContent = Math.round(scale * 100) + '%';
    renderPage(currentPage);
}

// ============ الخيارات ============
function toggleAdvanced() {
    elements.advancedToggle.classList.toggle('active');
    elements.advancedSearch.classList.toggle('active');
}

function toggleResultsPanel() {
    elements.resultsPanel.classList.toggle('collapsed');
}

function toggleHighlight() {
    CONFIG.HIGHLIGHT_ENABLED = !CONFIG.HIGHLIGHT_ENABLED;
    elements.highlightToggle.classList.toggle('active');
    
    if (!CONFIG.HIGHLIGHT_ENABLED) {
        elements.highlightLayer.innerHTML = '';
    } else if (searchResults.length > 0) {
        highlightMatches(currentPage);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('light-mode');
    elements.darkModeToggle.textContent = document.body.classList.contains('light-mode') ? '☀️' : '🌙';
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        elements.fullscreenToggle.textContent = '⛶';
    } else {
        document.exitFullscreen();
        elements.fullscreenToggle.textContent = '⛶';
    }
}

function downloadPDF() {
    const url = `https://drive.google.com/uc?export=download&id=${CONFIG.GOOGLE_DRIVE_FILE_ID}`;
    window.open(url, '_blank');
    showToast('جاري التحميل...', 'success');
}

// ============ اختصارات لوحة المفاتيح ============
function handleGlobalKeydown(e) {
    // تجاهل إذا كان في حقل إدخال
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
            e.target.blur();
            elements.suggestions.classList.remove('active');
        }
        return;
    }
    
    switch(e.key) {
        case 'ArrowLeft':
            changePage(1);
            break;
        case 'ArrowRight':
            changePage(-1);
            break;
        case 'ArrowUp':
            e.preventDefault();
            navigateResults(-1);
            break;
        case 'ArrowDown':
            e.preventDefault();
            navigateResults(1);
            break;
        case 'Home':
            renderPage(1);
            break;
        case 'End':
            renderPage(totalPages);
            break;
        case '+':
        case '=':
            changeZoom(0.25);
            break;
        case '-':
            changeZoom(-0.25);
            break;
        case 'f':
        case 'F':
            if (e.ctrlKey) {
                e.preventDefault();
                elements.searchInput.focus();
            }
            break;
        case 'Escape':
            elements.suggestions.classList.remove('active');
            elements.advancedSearch.classList.remove('active');
            break;
    }
}

// ============ المساعدات ============
function convertNumbers(str, to) {
    const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    
    if (to === 'ar') {
        return str.replace(/[0-9]/g, d => arabic[parseInt(d)]);
    } else {
        return str.replace(/[٠-٩]/g, d => english[arabic.indexOf(d)]);
    }
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function copyPageNumber(pageNum) {
    navigator.clipboard.writeText(pageNum.toString())
        .then(() => showToast(`✅ تم نسخ: صفحة ${pageNum}`, 'success'))
        .catch(() => showToast(`📄 الصفحة: ${pageNum}`, 'success'));
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============ البدء ============
init();
