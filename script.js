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
        status.textContent = '正在載入 OCR 引擎...';

        const worker = await Tesseract.createWorker(lang, 1, {
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
        const recognizedText = await runOCR(file, 'chi_tra');
        recordNameInput.value = recognizedText.replace(/\s/g, ''); // 移除空格
    });

    // 處理金額掃描
    amountScanner.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const recognizedText = await runOCR(file, 'eng', { whitelist: '0123456789' });
        
        // 從辨識出的數字中計算總金額
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

    recordsTableBody.addEventListener('focusout', (e) => {
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
            // 重新渲染以確保資料一致性
            renderTable();
        }
    });

    // 匯出 CSV
    exportBtn.addEventListener('click', () => {
        if (records.length === 0) {
            alert('沒有紀錄可以匯出');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "編號,姓名,總金額\n"; // CSV 標頭

        records.forEach(record => {
            csvContent += `${record.id},${record.name},${record.amount}\n`;
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