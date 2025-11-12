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

    // 初始化
    updateRecordId();

    // 執行 OCR 辨識
    async function runOCR(file, lang, options = {}) {
        if (!file) {
            alert('請先選擇一個圖片檔案');
            return;
        }
        loader.classList.remove('hidden');
        status.textContent = '正在準備辨識引擎...';

        // ** 更新部分：明確指定 worker 和語言包的路徑，解決部署後卡住的問題 **
        const worker = await Tesseract.createWorker(lang, 1, {
            workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
            langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js-lang-data@5/4.0.0_best', 
            // 注意：Tesseract.js V5 使用 tesseract.js-lang-data 這個包
            logger: m => {
                status.textContent = `${m.status}: ${Math.round(m.progress * 100)}%`;
                console.log(m);
            },
        });

        if (options.whitelist) {
            await worker.setParameters({
                tessedit_char_whitelist: options.whitelist,
            });
        }

        status.textContent = '正在辨識圖片...';
        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();
        loader.classList.add('hidden');
        return text;
    }

    // 處理姓名掃描
    nameScanner.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const recognizedText = await runOCR(file, 'chi_tra');
        recordNameInput.value = recognizedText.replace(/\s/g, ''); // 移除空格
    });

    // 處理金額掃描
    amountScanner.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const recognizedText = await runOCR(file, 'eng', { whitelist: '0123456789' });
        
        const numbers = recognizedText.match(/\d+/g) || [];
        let totalAmount = 0;
        const denominations = [2000, 1000, 500, 200, 100];

        numbers.forEach(numStr => {
            const num = parseInt(numStr, 10);
            if (denominations.includes(num)) {
                totalAmount += num;
            } else {
                 // 嘗試處理可能的辨識錯誤，例如把 1000 辨識成 100 或 00
                 if (numStr.includes('1000')) totalAmount += 1000;
                 else if (numStr.includes('500')) totalAmount += 500;
                 else if (numStr.includes('200')) totalAmount += 200;
                 else if (numStr.includes('100')) totalAmount += 100;
            }
        });
        
        recordAmountInput.value = totalAmount;
    });

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

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // \uFEFF for BOM to support Excel
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