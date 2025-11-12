// --- 全域錯誤捕獲器 ---
// 只要頁面有任何 JS 錯誤，都會被抓到並顯示出來
window.onerror = function(message, source, lineno, colno, error) {
    const debugLog = document.getElementById('debug-log');
    if (debugLog) {
        debugLog.innerHTML += `<b style="color:red;">[全域錯誤]</b> ${message}<br>在 ${source.split('/').pop()} 的 ${lineno} 行<br>`;
    }
    const loader = document.getElementById('loader');
    if(loader) loader.classList.remove('hidden');
    const status = document.getElementById('status');
    if(status) status.textContent = '程式發生嚴重錯誤！';
    return true; // 防止瀏覽器預設的錯誤處理
};
// --- 結束 ---

document.addEventListener('DOMContentLoaded', () => {
    // DOM 元素
    const nameScanner = document.getElementById('nameScanner');
    const amountScanner = document.getElementById('amountScanner');
    const recordIdInput = document.getElementById('recordId');
    const recordNameInput = document.getElementById('recordName');
    const recordAmountInput = document.getElementById('recordAmount');
    const addBtn = document.getElementById('addBtn');
    const recordsTableBody = document.querySelector('#recordsTable tbody');
    const exportBtn = document.getElementById('exportBtn');
    const loader = document.getElementById('loader');
    const status = document.getElementById('status');
    const debugLog = document.getElementById('debug-log'); 

    let records = [], nextId = 1, worker;

    function logDebug(message) {
        if (!debugLog) return;
        console.log(message);
        debugLog.innerHTML += message + '<br>';
        debugLog.scrollTop = debugLog.scrollHeight;
    }

    async function initializeOCR() {
        try {
            status.textContent = '開始初始化 v3...';
            loader.classList.remove('hidden');
            debugLog.innerHTML = ''; 

            logDebug('腳本已載入。準備建立 Worker...');
            logDebug(`目前網址: ${window.location.pathname}`);
            
            const workerPath = 'worker.min.js';
            const langPath = 'tessdata';
            
            logDebug(`預計 Worker 路徑: ${workerPath}`);
            logDebug(`預計語言資料夾路徑: ${langPath}`);
            
            worker = await Tesseract.createWorker('eng', 1, {
                workerPath: workerPath,
                langPath: langPath,
                logger: m => {
                    logDebug(`Tesseract 狀態: ${m.status}, 進度: ${m.progress ? (m.progress * 100).toFixed(2) : 0}%`);
                    if (m.status === 'recognizing text') {
                       status.textContent = `辨識中... ${Math.round(m.progress * 100)}%`;
                    }
                },
            });
            
            logDebug('<b style="color:green;">Worker 建立成功！</b>');
            logDebug('正在初始化英文...');
            await worker.initialize('eng');
            logDebug('<b style="color:green;">引擎已準備就緒！</b>');
            status.textContent = '引擎已就緒';

        } catch (error) {
            console.error('OCR 引擎初始化失敗:', error);
            logDebug('<b style="color:red;">錯誤！初始化失敗。</b>');
            logDebug(`詳細錯誤訊息: ${error.message || String(error)}`);
            status.textContent = '引擎載入失敗，請將下方除錯訊息截圖回報。';
            return;
        }

        setTimeout(() => {
            loader.classList.add('hidden');
        }, 1500);
    }
    
    initializeOCR();

    // --- 以下為原有功能，為確保穩定性，暫時不做修改 ---
    async function runOCR(file, lang, options = {}) {
        if (!worker) { alert('辨識引擎尚未準備好，請稍候...'); return; }
        if (!file) { alert('請先選擇一個圖片檔案'); return; }
        loader.classList.remove('hidden');
        status.textContent = `正在載入 ${lang === 'chi_tra' ? '中文' : '英文'} 語言包...`;
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
        if (options.whitelist) { await worker.setParameters({ tessedit_char_whitelist: options.whitelist }); }
        else { await worker.setParameters({ tessedit_char_whitelist: '' }); }
        status.textContent = '辨識中... 0%';
        const { data: { text } } = await worker.recognize(file);
        loader.classList.add('hidden');
        return text;
    }
    nameScanner.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const recognizedText = await runOCR(file, 'chi_tra');
        if(recognizedText) recordNameInput.value = recognizedText.replace(/[\s\r\n]/g, '');
    });
    amountScanner.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const recognizedText = await runOCR(file, 'eng', { whitelist: '0123456789' });
        if (!recognizedText) return;
        const numbers = recognizedText.match(/\d+/g) || [];
        let totalAmount = 0; const denominations = [2000, 1000, 500, 200, 100];
        numbers.forEach(numStr => { const num = parseInt(numStr, 10); if (denominations.includes(num)) { totalAmount += num; } });
        recordAmountInput.value = totalAmount;
    });
    addBtn.addEventListener('click', () => {
        const name = recordNameInput.value.trim(); const amount = parseInt(recordAmountInput.value, 10);
        if (!name || isNaN(amount) || amount <= 0) { alert('請輸入有效的姓名和金額'); return; }
        records.push({ id: nextId, name: name, amount: amount }); nextId++; renderTable(); clearInputs();
    });
    function renderTable() {
        recordsTableBody.innerHTML = '';
        records.forEach(record => {
            const row = document.createElement('tr'); row.dataset.id = record.id;
            row.innerHTML = `<td contenteditable="true" data-field="id">${record.id}</td><td contenteditable="true" data-field="name">${record.name}</td><td contenteditable="true" data-field="amount">${record.amount}</td><td><button class="delete-btn">刪除</button></td>`;
            recordsTableBody.appendChild(row);
        });
    }
    function clearInputs() {
        recordNameInput.value = ''; recordAmountInput.value = ''; nameScanner.value = ''; amountScanner.value = ''; updateRecordId();
    }
    function updateRecordId() { recordIdInput.value = nextId; }
    recordsTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const id = parseInt(e.target.closest('tr').dataset.id, 10); records = records.filter(record => record.id !== id); renderTable();
        }
    });
    recordsTableBody.addEventListener('input', (e) => {
        if (e.target.tagName === 'TD') {
            const id = parseInt(e.target.closest('tr').dataset.id, 10); const field = e.target.dataset.field; let value = e.target.textContent;
            const record = records.find(r => r.id === id);
            if (record) { record[field] = (field === 'id' || field === 'amount') ? (parseInt(value, 10) || 0) : value; }
        }
    });
    exportBtn.addEventListener('click', () => {
        if (records.length === 0) { alert('沒有紀錄可以匯出'); return; }
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; csvContent += "編號,姓名,總金額\n";
        records.forEach(record => { csvContent += `${record.id},"${record.name}",${record.amount}\n`; });
        const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "紅包紀錄.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    });
});