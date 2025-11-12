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

    let records = [], nextId = 1, worker;

    // 初始化 OCR 引擎
    async function initializeOCR() {
        status.textContent = '正在初始化辨識引擎...';
        loader.classList.remove('hidden');
        try {
            worker = await Tesseract.createWorker('eng', 1, {
                workerPath: 'worker.min.js',
                langPath: 'tessdata',
                logger: m => {
                    // 只在辨識時更新進度，避免干擾初始化
                    if (m.status === 'recognizing text') {
                       status.textContent = `辨識中... ${Math.round(m.progress * 100)}%`;
                    }
                },
            });
            await worker.initialize('eng');
            
            // ** 關鍵修正：確保初始化成功後，必定隱藏載入動畫 **
            loader.classList.add('hidden'); 
            
        } catch (error) {
            console.error('OCR 引擎初始化失敗:', error);
            status.textContent = '引擎載入失敗，請強制重新整理頁面。';
            // 失敗時，保持載入動畫可見以顯示錯誤訊息
        }
    }
    
    initializeOCR();

    // 執行 OCR 辨識
    async function runOCR(file, lang, options = {}) {
        if (!worker) { alert('辨識引擎尚未準備好，請稍候...'); return; }
        if (!file) { alert('請先選擇一個圖片檔案'); return; }
        
        loader.classList.remove('hidden');
        status.textContent = `載入語言包...`;
        
        await worker.loadLanguage(lang);
        await worker.initialize(lang);
        
        if (options.whitelist) { await worker.setParameters({ tessedit_char_whitelist: options.whitelist }); }
        else { await worker.setParameters({ tessedit_char_whitelist: '' }); }
        
        const { data: { text } } = await worker.recognize(file);
        loader.classList.add('hidden');
        return text;
    }

    // --- 以下為原有功能 ---
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