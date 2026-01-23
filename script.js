// ============ الإعدادات ============
const CONFIG = {
    PDF_FILE_NAME: 'HS Code 2026.pdf',
    GOOGLE_DRIVE_FILE_ID: '1sxY3ePFcEOrEaJFsQ6vI8vX9NS7MEA5V'
};

// ============ إعداد PDF.js ============
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============ المتغيرات ============
let pdfText = [];
let isIndexReady = false;

// ============ تهيئة التطبيق ============
function init() {
    initViewer();
    setupEvents();
    indexPDF();
}

function initViewer() {
    const iframe = document.getElementById('pdfFrame');
    iframe.src = `https://drive.google.com/file/d/${CONFIG.GOOGLE_DRIVE_FILE_ID}/preview`;
}

function setupEvents() {
    document.getElementById('searchBtn').addEventListener('click', () => {
        search(document.getElementById('searchInput').value);
    });
    
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') search(e.target.value);
    });
    
    document.getElementById('clearBtn').addEventListener('click', clearSearch);
    document.getElementById('togglePanel').addEventListener('click', togglePanel);
}

function togglePanel() {
    document.getElementById('searchPanel').classList.toggle('collapsed');
}

// ============ فهرسة PDF ============
async function indexPDF() {
    const statusDiv = document.getElementById('indexStatus');
    
    // قائمة المحاولات
    const attempts = [
        { name: 'GitHub', url: CONFIG.PDF_FILE_NAME },
        { name: 'Google Drive 1', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${CONFIG.GOOGLE_DRIVE_FILE_ID}`)}` },
        { name: 'Google Drive 2', url: `https://corsproxy.io/?${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${CONFIG.GOOGLE_DRIVE_FILE_ID}`)}` },
    ];
    
    let pdfDoc = null;
    
    // تجربة كل طريقة
    for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        updateStatus(`جاري المحاولة ${i + 1}/${attempts.length}: ${attempt.name}...`, false);
        
        try {
            pdfDoc = await pdfjsLib.getDocument({
                url: attempt.url,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
            }).promise;
            
            console.log(`✅ نجح التحميل من: ${attempt.name}`);
            break;
            
        } catch (e) {
            console.log(`❌ فشل ${attempt.name}:`, e.message);
            continue;
        }
    }
    
    // إذا فشلت كل المحاولات
    if (!pdfDoc) {
        showManualUpload();
        return;
    }
    
    // بدء الفهرسة
    try {
        const total = pdfDoc.numPages;
        pdfText = [];
        
        for (let i = 1; i <= total; i++) {
            updateStatus(`فهرسة الصفحة ${i} من ${total}...`, false);
            
            try {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                pdfText.push({ pageNum: i, text: text });
            } catch (e) {
                pdfText.push({ pageNum: i, text: '' });
            }
        }
        
        isIndexReady = true;
        updateStatus(`✅ جاهز للبحث! (${total} صفحة)`, true);
        
        setTimeout(() => {
            document.getElementById('indexStatus').classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error('خطأ في الفهرسة:', error);
        showManualUpload();
    }
}

function updateStatus(text, isReady) {
    const statusDiv = document.getElementById('indexStatus');
    statusDiv.classList.remove('hidden');
    
    if (isReady) {
        statusDiv.classList.add('ready');
        statusDiv.innerHTML = `<span>${text}</span>`;
    } else {
        statusDiv.classList.remove('ready');
        statusDiv.innerHTML = `
            <div class="spinner-small"></div>
            <span>${text}</span>
        `;
    }
}

function showManualUpload() {
    const statusDiv = document.getElementById('indexStatus');
    statusDiv.classList.remove('hidden');
    statusDiv.classList.remove('ready');
    statusDiv.innerHTML = `
        <span style="color: #ff6b6b;">⚠️ تعذر التحميل التلقائي</span>
        <label style="padding: 8px 20px; background: linear-gradient(45deg, #00d2ff, #3a7bd5); 
                      color: white; border-radius: 20px; cursor: pointer; font-size: 14px; 
                      font-weight: bold; margin-right: 10px;">
            📁 ارفع ملف PDF
            <input type="file" accept=".pdf" onchange="indexLocalPDF(event)" style="display:none">
        </label>
    `;
    
    // تحديث نتائج البحث
    document.getElementById('searchResults').innerHTML = `
        <div class="empty-state">
            <p>⚠️ يرجى رفع ملف PDF أولاً</p>
            <p style="font-size: 12px; margin-top: 10px; color: #888;">
                اضغط على زر "ارفع ملف PDF" أعلاه
            </p>
        </div>
    `;
}

async function indexLocalPDF(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusDiv = document.getElementById('indexStatus');
    
    try {
        updateStatus('جاري قراءة الملف...', false);
        
        const arrayBuffer = await file.arrayBuffer();
        
        updateStatus('جاري تحليل الملف...', false);
        
        const pdfDoc = await pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
        }).promise;
        
        const total = pdfDoc.numPages;
        pdfText = [];
        
        for (let i = 1; i <= total; i++) {
            updateStatus(`فهرسة الصفحة ${i} من ${total}...`, false);
            
            try {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                pdfText.push({ pageNum: i, text: text });
            } catch (e) {
                pdfText.push({ pageNum: i, text: '' });
            }
        }
        
        isIndexReady = true;
        updateStatus(`✅ جاهز للبحث! (${total} صفحة)`, true);
        
        // تحديث نتائج البحث
        document.getElementById('searchResults').innerHTML = `
            <div class="empty-state">
                <p>📝 ابدأ البحث للعثور على النتائج</p>
            </div>
        `;
        
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error('خطأ:', error);
        statusDiv.innerHTML = `<span style="color: #ff6b6b;">❌ خطأ: ${error.message}</span>`;
    }
}

// ============ البحث ============
function search(query) {
    const resultsDiv = document.getElementById('searchResults');
    const statsDiv = document.getElementById('searchStats');
    
    if (!query.trim()) {
        clearSearch();
        return;
    }
    
    document.getElementById('searchPanel').classList.remove('collapsed');
    
    if (!isIndexReady) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                ⚠️ يرجى رفع ملف PDF أولاً
                <br><br>
                <small>اضغط على زر "ارفع ملف PDF" في الأعلى</small>
            </div>
        `;
        return;
    }
    
    const results = [];
    const queryLower = query.toLowerCase().trim();
    
    pdfText.forEach(page => {
        if (!page.text) return;
        
        const textLower = page.text.toLowerCase();
        let count = 0;
        let index = 0;
        
        while ((index = textLower.indexOf(queryLower, index)) !== -1) {
            count++;
            index++;
        }
        
        if (count > 0) {
            const firstIndex = textLower.indexOf(queryLower);
            const start = Math.max(0, firstIndex - 60);
            const end = Math.min(page.text.length, firstIndex + query.length + 60);
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
        statsDiv.classList.remove('active');
        resultsDiv.innerHTML = `
            <div class="no-results">
                ❌ لا توجد نتائج لـ "<strong>${query}</strong>"
                <br><br>
                💡 جرب كلمات مختلفة
            </div>
        `;
        return;
    }
    
    const totalMatches = results.reduce((sum, r) => sum + r.count, 0);
    
    statsDiv.innerHTML = `✅ ${totalMatches} نتيجة في ${results.length} صفحة`;
    statsDiv.classList.add('active');
    
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    
    resultsDiv.innerHTML = results.map(r => `
        <div class="result-item">
            <div class="result-header">
                <span class="page-badge">صفحة ${r.pageNum}</span>
                <span class="match-count">${r.count} تطابق</span>
            </div>
            <div class="result-context">
                ${r.context.replace(regex, '<span class="highlight">$1</span>')}
            </div>
            <button class="go-to-page-btn" onclick="copyPageNumber(${r.pageNum})">
                📋 نسخ رقم الصفحة
            </button>
        </div>
    `).join('');
}

function copyPageNumber(pageNum) {
    navigator.clipboard.writeText(pageNum.toString()).then(() => {
        showToast(`✅ تم نسخ: ${pageNum}`);
    }).catch(() => {
        showToast(`📄 الصفحة: ${pageNum}`);
    });
}

function showToast(message) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 25px;
            border-radius: 25px;
            z-index: 9999;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }
    
    toast.textContent = message;
    toast.style.opacity = '1';
    
    setTimeout(() => { toast.style.opacity = '0'; }, 2000);
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchStats').classList.remove('active');
    document.getElementById('searchResults').innerHTML = `
        <div class="empty-state">
            <p>📝 ابدأ البحث للعثور على النتائج</p>
        </div>
    `;
}

// ============ البدء ============
init();
