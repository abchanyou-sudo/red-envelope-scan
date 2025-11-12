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

    // 應用程式狀態
    let records = [];
    let nextId = 1;
    let worker; // 將 worker 提升為全域變數，以便重複使用

    // ** 全新功能：初始化並預載 OCR 引擎 **
    async function initializeOCR() {
        status.textContent = '正在初始化辨識引擎...';
        loader.classList.remove('hidden');
        try {
            worker = await Tesseract.createWorker('eng', 1, {
                // ** 關鍵修正：更換為官方穩定的 Worker 和語言包路徑 **
                workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
                langPath: 'https://tessdata.projectnaptha.com/4.0.0_best', // 使用官方推薦、最穩定的語言包來源
                logger: m => {
                    if (m.status === 'recognizing text') {
                       status.textContent = `辨識中... ${Math.round(m.progress * 100)}%`;
                    } else {
                       console.log(m.status);
                    }
                },
            });
            console.log('OCR 引擎初始化成功！');
        } catch (error) {
            console.error('OCR 引擎初始化失敗:', error);
            status.textContent = '引擎載入失敗，請檢查網路連線或稍後重試。';
            // 讓錯誤訊息停留，不隱藏 loader
            return;
        }
        loader.classList.add('hidden');
    }
    
    // 一進入頁面就開始初始化
    initializeOCR();

    // 執行 OCR 辨識 (現在這個函式會重複使用已初始化的 worker)
    async function runOCR(file, lang, options = {}) {
        if (!worker) {
            alert('辨識引擎尚未準備好，請稍候...');
            return;
        }
        if (!file) {
            alert('請先選擇一個圖片檔案');
            return;
        }
        
        loader.classList.remove('hidden');
        status.textContent = `正在載入 ${lang === 'chi_tra' ? '中文' : '英文'} 語言包...`;
        
        await worker.loadLanguage(lang);
        await worker.initialize(lang);

        if (options.whitelist) {
            await worker.setParameters({
                tessedit_char_whitelist: options.whitelist,
            });
        } else {
            // 如果不是辨識數字，確保白名單是關閉的
             await worker.setParameters({
                tessedit_char_whitelist: '',
            });
        }

        status.textContent = '辨識中... 0%';
        const { data: { text } } = await worker.recognize(file);
        
        loader.classList.add('hidden');
        return text;
    }

    // 處理姓名掃描
    nameScanner.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const recognizedText = await runOCR(file, 'chi_tra');
        if(recognizedText) recordNameInput.value = recognizedText.replace(/\s/g, '');
    });

    // 處理金額掃描
    amountScanner.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const recognizedText = await runOCR(file, 'eng', { whitelist: '0123456789' });
        
        if (!recognizedText) return;

        const numbers = recognizedText.match(/\d+/g) || [];
        let totalAmount = 0;
        const denominations = [2000, 1000, 500, 200, 100];

        numbers.forEach(numStr => {
            const num = parseInt(numStr, 10);
            if (denominations.includes(num)) {
                totalAmount += num;
            }
        });
        
        recordAmountInput.value = totalAmount;
    });

    // --- 以下的程式碼與之前版本相同，無需修改 ---

    // 新增紀錄
    addBtn.addEventListener('click', () => {
        const name = recordNameInput.value.trim();
        const amount = parseInt(recordAmountInput.value, 10);

        if (!name) {
            alert('姓名不能為空');
            return;
        }
        if (isNaN(amount) || amount <= 0) {
            alert('請輸入有效的金額');
            return;
        }

        records.push({
            id: nextId,
            name: name,
            amount: amount
        });

        nextId++;
        renderTable();
        clearInputs();
    });

    // 渲染表格
    function renderTable() {
        recordsTableBody.innerHTML = '';
        records.forEach(record => {
            const row = document.createElement('tr');
            row.dataset.id = record.id;
            row.innerHTML = `
                <td contenteditable="true" data-field="id">${record.id}</td>
                <td contenteditable="true" data-field="name">${record.name}</td>
                <td contenteditable="true" data-field="amount">${record.amount}</td>
                <td><button class="delete-btn">刪除</button></td>
            `;
            recordsTableBody.appendChild(row);
        });
    }

    // 清空輸入欄位
    function clearInputs() {
        recordNameInput.value = '';
        recordAmountInput.value = '';
        nameScanner.value = '';
        amountScanner.value = '';
        updateRecordId();
    }
    
    // 更新下一個編號
    function updateRecordId() {
        recordIdInput.value = nextId;
    }

    // 處理表格操作 (編輯和刪除)
    recordsTableBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const row = e.target.closest('tr');
            const id = parseInt(row.dataset.id, 10);
            records = records.filter(record => record.id !== id);
            renderTable();
        }
    });

    recordsTableBody.addEventListener('input', (e) => {
        if (e.target.tagName === 'TD' && e.target.hasAttribute('contenteditable')) {
            const row = e.target.closest('tr');
            const id = parseInt(row.dataset.id, 10);
            const field = e.target.dataset.field;
            let value = e.target.textContent;

            const record = records.find(r => r.id === id);
            if (record) {
                if (field === 'id' || field === 'amount') {
                    value = parseInt(value, 10) || 0;
                }
                record[field] = value;
            }
        }
    });

    // 匯出 CSV
    exportBtn.addEventListener('click', () => {
        if (records.length === 0) {
            alert('沒有紀錄可以匯出');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "編號,姓名,總金額\n";

        records.forEach(record => {
            csvContent += `${record.id},"${record.name}",${record.amount}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "紅包紀錄.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
});