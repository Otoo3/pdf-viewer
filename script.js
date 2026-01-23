// ============ الإعدادات ============
const CONFIG = {
    // اسم ملف PDF على GitHub
    PDF_FILE_NAME: 'HS Code 2026.pdf',
    
    // رابط الملف على Google Drive (للعرض)
    GOOGLE_DRIVE_FILE_ID: '1sxY3ePFcEOrEaJFsQ6vI8vX9NS7MEA5V'
};

// ============ إعداد PDF.js للبحث ============
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============ المتغيرات ============
let pdfText = [];
let isIndexReady = false;

// ============ تهيئة العارض ============
function initViewer() {
    const iframe = document.getElementById('pdfFrame');
    
    // استخدام Google Docs Viewer للعرض المثالي
    const googleViewerUrl = `https://drive.google.com/file/d/${CONFIG.GOOGLE_DRIVE_FILE_ID}/preview`;
    
    iframe.src = googleViewerUrl;
}

// ============ التبويبات ============
function showTab(tab) {
    // إخفاء كل الأقسام
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    // إظهار القسم المطلوب
    if (tab === 'viewer') {
        document.getElementById('viewerSection').classList.add('active');
        document.querySelectorAll('.tab')[0].classList.add('active');
    } else {
        document.getElementById('searchSection').classList.add('active');
        document.querySelectorAll('.tab')[1].classList.add('active');
        
        // بدء الفهرسة إذا لم تبدأ
        if (!isIndexReady && pdfText.length === 0) {
            indexPDF();
        }
    }
}

// ============ فهرسة PDF للبحث ============
async function indexPDF() {
    const statusDiv = document.getElementById('indexStatus');
    
    try {
        statusDiv.innerHTML = `
            <div class="spinner-small"></div>
            <span>جاري تحميل الملف للفهرسة...</span>
        `;
        
        // تحميل من GitHub
        const pdfDoc = await pdfjsLib.getDocument({
            url: CONFIG.PDF_FILE_NAME,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
        }).promise;
        
        const total = pdfDoc.numPages;
        pdfText = [];
        
        for (let i = 1; i <= total; i++) {
            statusDiv.innerHTML = `
                <div class="spinner-small"></div>
                <span>جاري فهرسة الصفحة ${i} من ${total}...</span>
            `;
            
            try {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                
                let text = textContent.items.map(item => item.str).join(' ');
                
                pdfText.push({
                    pageNum: i,
                    text: text
                });
            } catch (e) {
                pdfText.push({ pageNum: i, text: '' });
            }
        }
        
        isIndexReady = true;
        statusDiv.innerHTML = `<span>✅ جاهز للبحث! (${total} صفحة)</span>`;
        statusDiv.classList.add('ready');
        
        // إخفاء بعد 3 ثواني
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        console.error('خطأ في الفهرسة:', error);
        statusDiv.innerHTML = `
            <span>⚠️ تعذرت الفهرسة من GitHub. جاري المحاولة من Google Drive...</span>
        `;
        
        // محاولة من Google Drive
        tryIndexFromDrive();
    }
}

async function tryIndexFromDrive() {
    const statusDiv = document.getElementById('indexStatus');
    
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
            `https://drive.google.com/uc?export=download&id=${CONFIG.GOOGLE_DRIVE_FILE_ID}`
        )}`;
        
        const pdfDoc = await pdfjsLib.getDocument({
            url: proxyUrl,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
        }).promise;
        
        const total = pdfDoc.numPages;
        pdfText = [];
        
        for (let i = 1; i <= total; i++) {
            statusDiv.innerHTML = `
                <div class="spinner-small"></div>
                <span>جاري فهرسة الصفحة ${i} من ${total}...</span>
            `;
            
            try {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                let text = textContent.items.map(item => item.str).join(' ');
                pdfText.push({ pageNum: i, text: text });
            } catch (e) {
                pdfText.push({ pageNum: i, text: '' });
            }
        }
        
        isIndexReady = true;
        statusDiv.innerHTML = `<span>✅ جاهز للبحث! (${total} صفحة)</span>`;
        statusDiv.classList.add('ready');
        
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
        
    } catch (error) {
        statusDiv.innerHTML = `
            <span>❌ فشلت الفهرسة. يمكنك تحميل الملف يدوياً:</span>
            <label style="margin-right: 10px; padding: 10px 20px; background: white; 
                          color: #1e3c72; border-radius: 20px; cursor: pointer;">
                📁 اختر الملف
                <input type="file" accept=".pdf" onchange="indexLocalPDF(event)" style="display:none">
            </label>
        `;
    }
}

async function indexLocalPDF(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusDiv = document.getElementById('indexStatus');
    
    try {
        statusDiv.innerHTML = `
            <div class="spinner-small"></div>
            <span>جاري قراءة الملف...</span>
        `;
        
        const arrayBuffer = await file.arrayBuffer();
        
        const pdfDoc = await pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
        }).promise;
        
        const total = pdfDoc.numPages;
        pdfText = [];
        
        for (let i = 1; i <= total; i++) {
            statusDiv.innerHTML = `
                <div class="spinner-small"></div>
                <span>جاري فهرسة الصفحة ${i} من ${total}...</span>
            `;
            
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            let text = textContent.items.map(item => item.str).join(' ');
            pdfText.push({ pageNum: i, text: text });
        }
        
        isIndexReady = true;
        statusDiv.innerHTML = `<span>✅ جاهز للبحث! (${total} صفحة)</span>`;
        statusDiv.classList.add('ready');
        
        setTimeout(() => {
            statusDiv.classList.add('hidden');
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
        resultsDiv.classList.remove('active');
        statsDiv.classList.remove('active');
        return;
    }
    
    if (!isIndexReady) {
        resultsDiv.innerHTML = `
            <div class="no-results">
                ⏳ انتظر حتى تكتمل الفهرسة...
            </div>
        `;
        resultsDiv.classList.add('active');
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
            const start = Math.max(0, firstIndex - 80);
            const end = Math.min(page.text.length, firstIndex + query.length + 80);
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
            <div class="no-results">
                ❌ لم يتم العثور على نتائج لـ "<strong>${query}</strong>"
                <br><br>
                <small>💡 جرب البحث بكلمات مختلفة أو أرقام الكود</small>
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
            <div class="result-header">
                <span class="page-badge">📄 صفحة ${r.pageNum}</span>
                <span class="match-count">${r.count} تطابق</span>
            </div>
            <div class="result-context">
                ${r.context.replace(regex, '<span class="highlight">$1</span>')}
            </div>
        </div>
    `).join('');
    
    resultsDiv.classList.add('active');
}

function goToPage(pageNum) {
    // الانتقال لتبويب العرض
    showTab('viewer');
    
    // عرض رسالة
    alert(`📄 انتقل إلى الصفحة ${pageNum} في العارض`);
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
document.getElementById('searchBtn').addEventListener('click', () => {
    search(document.getElementById('searchInput').value);
});

document.getElementById('clearBtn').addEventListener('click', clearSearch);

document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        search(e.target.value);
    }
});

// ============ البدء ============
initViewer();
