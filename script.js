// ============ إعداد PDF.js مع دعم الخطوط العربية ============
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============ الإعدادات ============
const PDF_FILE_NAME = 'HS Code 2026.pdf';

// ============ المتغيرات ============
let pdfDoc = null;
let pageNum = 1;
let pageRendering = false;
let pageNumPending = null;
let scale = 1.5; // جودة عالية افتراضياً
let pdfText = [];

const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d');

// ============ تحديث شاشة التحميل ============
function updateLoading(text, percent) {
    const loadingText = document.getElementById('loadingText');
    const loadingPercent = document.getElementById('loadingPercent');
    const progressFill = document.getElementById('progressFill');
    
    if (loadingText) loadingText.textContent = text;
    if (loadingPercent) loadingPercent.textContent = percent + '%';
    if (progressFill) progressFill.style.width = percent + '%';
}

// ============ تحميل PDF مع دعم الخطوط ============
async function loadPDF() {
    try {
        updateLoading('جاري تحميل الملف...', 10);
        
        // إعدادات PDF.js مع دعم الخطوط
        const loadingTask = pdfjsLib.getDocument({
            url: PDF_FILE_NAME,
            // دعم الخطوط العربية والخاصة
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            // دعم الخطوط القياسية
            standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
            // تفعيل دعم الخطوط المضمنة
            fontExtraProperties: true,
            // تحسين العرض
            useSystemFonts: true,
            disableFontFace: false,
        });
        
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
        
        await extractAllText();
        
        document.getElementById('loadingOverlay').classList.add('hidden');
        renderPage(pageNum);
        
    } catch (error) {
        console.error('خطأ:', error);
        showError(error.message);
    }
}

function showError(message) {
    document.getElementById('loadingOverlay').innerHTML = `
        <div class="loading-content">
            <h2 style="margin-bottom: 20px;">⚠️ تعذر تحميل الملف</h2>
            <p style="margin-bottom: 15px; color: #ffcccc;">${message || 'خطأ غير معروف'}</p>
            <p style="margin-bottom: 15px;">تأكد من رفع ملف PDF باسم:</p>
            <code style="background: rgba(255,255,255,0.2); padding: 10px 20px; 
                         border-radius: 10px; display: block; margin-bottom: 20px;">
                ${PDF_FILE_NAME}
            </code>
            
            <p style="margin-bottom: 20px;">أو اختر ملف من جهازك:</p>
            
            <label style="padding: 15px 30px; background: #4CAF50; color: white; 
                          border-radius: 25px; cursor: pointer; font-weight: bold;
                          display: inline-block;">
                📁 اختر ملف PDF
                <input type="file" accept=".pdf" onchange="loadLocalPDF(event)" 
                       style="display: none;">
            </label>
        </div>
    `;
}

// ============ تحميل PDF محلي ============
async function loadLocalPDF(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        document.getElementById('loadingOverlay').innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p id="loadingText">جاري تحميل الملف...</p>
                <div class="progress-bar">
                    <div id="progressFill" class="progress-fill"></div>
                </div>
                <p id="loadingPercent">0%</p>
            </div>
        `;
        
        updateLoading('جاري قراءة الملف...', 20);
        
        const arrayBuffer = await file.arrayBuffer();
        
        updateLoading('جاري معالجة الملف...', 40);
        
        pdfDoc = await pdfjsLib.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
            fontExtraProperties: true,
            useSystemFonts: true,
            disableFontFace: false,
        }).promise;
        
        document.getElementById('pageInfo').textContent = 
            `صفحة ${pageNum} من ${pdfDoc.numPages}`;
        document.getElementById('goToPage').max = pdfDoc.numPages;
        
        await extractAllText();
        
        document.getElementById('loadingOverlay').classList.add('hidden');
        renderPage(pageNum);
        
    } catch (error) {
        alert('خطأ في قراءة الملف: ' + error.message);
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
            const textContent = await page.getTextContent({
                normalizeWhitespace: true,
                disableCombineTextItems: false,
            });
            
            // تحسين استخراج النص العربي
            let text = '';
            let lastY = null;
            
            textContent.items.forEach(item => {
                if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
                    text += '\n';
                }
                text += item.str + ' ';
                lastY = item.transform[5];
            });
            
            pdfText.push({
                pageNum: i,
                text: text.trim()
            });
        } catch (e) {
            console.warn(`خطأ في الصفحة ${i}:`, e);
            pdfText.push({ pageNum: i, text: '' });
        }
    }
    
    updateLoading('✅ اكتمل التحميل والفهرسة!', 100);
}

// ============ عرض الصفحة بجودة عالية ============
async function renderPage(num) {
    pageRendering = true;
    
    try {
        const page = await pdfDoc.getPage(num);
        
        // حساب أبعاد العرض
        const viewport = page.getViewport({ scale: 1 });
        
        // الحصول على كثافة البكسل للشاشة
        const pixelRatio = window.devicePixelRatio || 1;
        const totalScale = scale * pixelRatio;
        
        // إعداد Canvas بدقة عالية
        const scaledViewport = page.getViewport({ scale: totalScale });
        
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        
        // تصغير العرض الفعلي مع الحفاظ على الدقة
        canvas.style.width = (viewport.width * scale) + 'px';
        canvas.style.height = (viewport.height * scale) + 'px';
        
        // تحسين جودة الرسم
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // إعدادات العرض المحسنة
        const renderContext = {
            canvasContext: ctx,
            viewport: scaledViewport,
            enableWebGL: true,
            renderInteractiveForms: true,
        };
        
        await page.render(renderContext).promise;
        
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
    
    // البحث أيضاً بالأرقام العربية والإنجليزية
    const queryArabicNums = convertToArabicNumerals(query);
    const queryEnglishNums = convertToEnglishNumerals(query);
    
    pdfText.forEach(page => {
        const textLower = page.text.toLowerCase();
        let count = 0;
        let index = 0;
        
        // البحث بالنص الأصلي
        while ((index = textLower.indexOf(queryLower, index)) !== -1) {
            count++;
            index++;
        }
        
        // البحث بالأرقام المحولة
        if (queryArabicNums !== query) {
            index = 0;
            while ((index = textLower.indexOf(queryArabicNums.toLowerCase(), index)) !== -1) {
                count++;
                index++;
            }
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

// تحويل الأرقام
function convertToArabicNumerals(str) {
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return str.replace(/[0-9]/g, d => arabicNums[parseInt(d)]);
}

function convertToEnglishNumerals(str) {
    return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
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
    if (e.key === 'Enter') goToPage(e.target.value);
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
    if (e.key === 'Enter') search(e.target.value);
});

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowLeft') nextPage();
    if (e.key === 'ArrowRight') prevPage();
});

// ============ البدء ============
loadPDF();
