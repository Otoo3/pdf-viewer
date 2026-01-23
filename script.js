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
    // تحميل عارض PDF
    initViewer();
    
    // بدء الفهرسة
    indexPDF();
    
    // ربط الأحداث
    setupEvents();
}

function initViewer() {
    const iframe = document.getElementById('pdfFrame');
    iframe.src = `https://drive.google.com/file/d/${CONFIG.GOOGLE_DRIVE_FILE_ID}/preview`;
}

function setupEvents() {
    // البحث
    document.getElementById('searchBtn').addEventListener('click', () => {
        search(document.getElementById('searchInput').value);
    });
    
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            search(e.target.value);
        }
    });
    
    // مسح البحث
    document.getElementById('clearBtn').addEventListener('click', clearSearch);
    
    // تصغير/تكبير لوحة البحث
    document.getElementById('togglePanel').addEventListener('click', togglePanel);
}

function togglePanel() {
    document.getElementById('searchPanel').classList.toggle('collapsed');
}

// ============ فهرسة PDF ============
async function indexPDF() {
    const statusDiv = document.getElementById('indexStatus');
    
    try {
        updateStatus('جاري تحميل الملف للفهرسة...', false);
        
        // محاولة التحميل من GitHub أولاً
        let pdfDoc;
        try {
            pdfDoc = await pdfjsLib.getDocument({
                url: CONFIG.PDF_FILE_NAME,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
            }).promise;
        } catch (e) {
            // محاولة من Google Drive
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
                `https://drive.google.com/uc?export=download&id=${CONFIG.GOOGLE_DRIVE_FILE_ID}`
            )}`;
            
            pdfDoc = await pdfjsLib.getDocument({
                url: proxyUrl,
                cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
                cMapPacked: true,
            }).promise;
        }
        
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
        updateStatus(`✅ جاهز للبحث (${total} صفحة)`, true);
        
        // إخفاء بعد 3 ثواني
        setTimeout(() => {
            document.getElementById('indexStatus').classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error('خطأ:', error);
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
    statusDiv.innerHTML = `
        <span>⚠️ فشل التحميل</span>
        <label style="padding: 5px 15px; background: white; color: #333; 
                      border-radius: 15px; cursor: pointer; font-size: 13px;">
            📁 اختر الملف
            <input type="file" accept=".pdf" onchange="indexLocalPDF(event)" style="display:none">
        </label>
    `;
}

async function indexLocalPDF(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        updateStatus('جاري قراءة الملف...', false);
        
        const arrayBuffer = await file.arrayBuffer();
        
        const pdfDoc = await pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
        }).promise;
        
        const total = pdfDoc.numPages;
        pdfText = [];
        
        for (let i = 1; i <= total; i++) {
            updateStatus(`فهرسة ${i} من ${total}...`, false);
            
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            pdfText.push({ pageNum: i, text: text });
        }
        
        isIndexReady = true;
        updateStatus(`✅ جاهز (${total} صفحة)`, true);
        
        setTimeout(() => {
            document.getElementById('indexStatus').classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        alert('خطأ: ' + error.message);
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
    
    // فتح لوحة البحث إذا كانت مغلقة
    document.getElementById('searchPanel').classList.remove('collapsed');
    
    if (!isIndexReady) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                ⏳ انتظر حتى تكتمل الفهرسة...
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
        showToast(`✅ تم نسخ رقم الصفحة: ${pageNum}`);
    }).catch(() => {
        showToast(`📄 الصفحة: ${pageNum}`);
    });
}

function showToast(message) {
    // إنشاء toast إذا لم يكن موجوداً
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
    
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
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
