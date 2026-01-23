// ============ إعداد PDF.js ============
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============ الإعدادات ============
const CONFIG = {
    // ✅ ID ملفك على Google Drive
    FILE_ID: '1_FS3hsY-v9SiaM9u6sX5G8QRU1d1mFhC'
};

// ============ المتغيرات ============
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1;
let pdfText = [];

// ============ العناصر ============
const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d');

// ============ بناء رابط التحميل ============
function getPdfUrl() {
    const driveUrl = `https://drive.google.com/uc?export=download&id=${CONFIG.FILE_ID}`;
    // استخدام CORS proxy
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(driveUrl)}`;
}

// ============ تحديث شاشة التحميل ============
function updateLoading(text, percent) {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingPercent').textContent = percent + '%';
    document.getElementById('progressFill').style.width = percent + '%';
}

// ============ تحميل PDF ============
async function loadPDF() {
    try {
        updateLoading('جاري الاتصال بـ Google Drive...', 10);
        
        const url = getPdfUrl();
        
        const loadingTask = pdfjsLib.getDocument(url);
        
        loadingTask.onProgress = function(progress) {
            if (progress.total > 0) {
                const percent = Math.round((progress.loaded / progress.total) * 100);
                updateLoading(`جاري تحميل الملف...`, Math.min(10 + percent * 0.4, 50));
            }
        };
        
        pdfDoc = await loadingTask.promise;
        
        updateLoading('تم تحميل الملف بنجاح!', 50);
        
        document.getElementById('pageInfo').textContent = 
            `صفحة ${pageNum} من ${pdfDoc.numPages}`;
        document.getElementById('goToPage').max = pdfDoc.numPages;
        
        // فهرسة النص للبحث
        await extractAllText();
        
        // إخفاء شاشة التحميل
        document.getElementById('loadingOverlay').classList.add('hidden');
        
        // عرض الصفحة الأولى
        renderPage(pageNum);
        
    } catch (error) {
        console.error('خطأ:', error);
        updateLoading('❌ خطأ في التحميل! جاري المحاولة بطريقة أخرى...', 0);
        
        // محاولة بديلة
        tryAlternativeLoad();
    }
}

// ============ محاولة تحميل بديلة ============
async function tryAlternativeLoad() {
    try {
        const alternativeUrl = `https://corsproxy.io/?${encodeURIComponent(
            `https://drive.google.com/uc?export=download&id=${CONFIG.FILE_ID}`
        )}`;
        
        updateLoading('جاري المحاولة بطريقة بديلة...', 20);
        
        pdfDoc = await pdfjsLib.getDocument(alternativeUrl).promise;
        
        document.getElementById('pageInfo').textContent = 
            `صفحة ${pageNum} من ${pdfDoc.numPages}`;
        document.getElementById('goToPage').max = pdfDoc.numPages;
        
        await extractAllText();
        
        document.getElementById('loadingOverlay').classList.add('hidden');
        renderPage(pageNum);
        
    } catch (error) {
        document.getElementById('loadingText').textContent = 
            '❌ فشل التحميل - تأكد من أن الملف مُشارك للجميع';
        document.getElementById('loadingPercent').textContent = 'حاول تحديث الصفحة';
    }
}

// ============ استخراج النص للبحث ============
async function extractAllText() {
    pdfText = [];
    const total = pdfDoc.numPages;
    
    for (let i = 1; i <= total; i++) {
        const percent = 50 + Math.round((i / total) * 45);
        updateLoading(`جاري فهرسة الصفحة ${i} من ${total}...`, percent);
        
        try {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            
            pdfText.push({
                pageNum: i,
                text: text
            });
        } catch (e) {
            pdfText.push({ pageNum: i, text: '' });
        }
    }
    
    updateLoading('✅ اكتمل التحميل والفهرسة!', 100);
}

// ============ عرض الصفحة ============
async function renderPage(num) {
    pageRendering = true;
    
    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale: scale });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;
        
        document.getElementById('pageInfo').textContent = 
            `صفحة ${num} من ${pdfDoc.numPages}`;
            
    } catch (error) {
        console.error('خطأ في عرض الصفحة:', error);
    }
    
    pageRendering = false;
    
    if (pageNumPending !== null) {
        renderPage(pageNumPending);
        pageNumPending = null;
    }
}

function queueRenderPage(num) {
    if (pageRendering) {
        pageNumPending = num;
    } else {
        renderPage(num);
    }
}

// ============ التنقل بين الصفحات ============
function prevPage() {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
}

function nextPage() {
    if (!pdfDoc || pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
}

function goToPage(num) {
    num = parseInt(num);
    if (!pdfDoc || isNaN(num) || num < 1 || num > pdfDoc.numPages) return;
    pageNum = num;
    queueRenderPage(pageNum);
}

// ============ البحث ============
function search(query) {
    const resultsDiv = document.getElementById('searchResults');
    const statsDiv = document.getElementById('searchStats');
    
    if (!query.trim()) {
        resultsDiv.classList.remove('active');
        statsDiv.classList.remove('active');
        return;
    }
    
    const results = [];
    const queryLower = query.toLowerCase();
    
    pdfText.forEach(page => {
        const textLower = page.text.toLowerCase();
        let count = 0;
        let index = 0;
        
        while ((index = textLower.indexOf(queryLower, index)) !== -1) {
            count++;
            index++;
        }
        
        if (count > 0) {
            const firstIndex = textLower.indexOf(queryLower);
            const start = Math.max(0, firstIndex - 50);
            const end = Math.min(page.text.length, firstIndex + query.length + 50);
            let context = page.text.substring(start, end);
            
            if (start > 0) context = '...' + context;
            if (end < page.text.length) context = context + '...';
            
            results.push({
                pageNum: page.pageNum,
                count: count,
                context: context
            });
        }
    });
    
    displayResults(results, query);
}

function displayResults(results, query) {
    const resultsDiv = document.getElementById('searchResults');
    const statsDiv = document.getElementById('searchStats');
    
    if (results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="result-item">
                <strong>❌ لم يتم العثور على نتائج لـ "${query}"</strong>
            </div>
        `;
        resultsDiv.classList.add('active');
        statsDiv.classList.remove('active');
        return;
    }
    
    const totalMatches = results.reduce((sum, r) => sum + r.count, 0);
    
    statsDiv.innerHTML = `
        ✅ تم العثور على <strong>${totalMatches}</strong> نتيجة 
        في <strong>${results.length}</strong> صفحة
    `;
    statsDiv.classList.add('active');
    
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    
    resultsDiv.innerHTML = results.map(r => `
        <div class="result-item" onclick="goToPage(${r.pageNum})">
            <span class="page-badge">📄 صفحة ${r.pageNum}</span>
            <span style="color:#666">(${r.count} تكرار)</span>
            <div class="result-context">
                ${r.context.replace(regex, '<span class="highlight">$1</span>')}
            </div>
        </div>
    `).join('');
    
    resultsDiv.classList.add('active');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').classList.remove('active');
    document.getElementById('searchStats').classList.remove('active');
}

// ============ ربط الأحداث ============
document.getElementById('prevPage').addEventListener('click', prevPage);
document.getElementById('nextPage').addEventListener('click', nextPage);

document.getElementById('goBtn').addEventListener('click', () => {
    goToPage(document.getElementById('goToPage').value);
});

document.getElementById('goToPage').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        goToPage(e.target.value);
    }
});

document.getElementById('zoomSelect').addEventListener('change', (e) => {
    scale = parseFloat(e.target.value);
    queueRenderPage(pageNum);
});

document.getElementById('searchBtn').addEventListener('click', () => {
    search(document.getElementById('searchInput').value);
});

document.getElementById('clearBtn').addEventListener('click', clearSearch);

document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        search(e.target.value);
    }
});

// اختصارات لوحة المفاتيح
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    
    if (e.key === 'ArrowLeft') nextPage();
    if (e.key === 'ArrowRight') prevPage();
    if (e.key === 'Home') goToPage(1);
    if (e.key === 'End' && pdfDoc) goToPage(pdfDoc.numPages);
});

// ============ البدء ============
loadPDF();