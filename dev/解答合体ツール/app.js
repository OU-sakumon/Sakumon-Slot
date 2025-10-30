/**
 * 解答合体ツール - メインアプリケーション
 * 複数のワークブックを比較して合体させるツール
 */

class AnswerMergeTool {
    constructor() {
        this.originalWorkbook = null;
        this.originalFileName = '';
        this.compareWorkbooks = [];
        this.comparisonData = [];
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 元のファイルアップロード
        document.getElementById('originalFile').addEventListener('change', (e) => {
            this.handleOriginalFileUpload(e);
        });

        // 比較ファイルアップロード
        document.getElementById('compareFiles').addEventListener('change', (e) => {
            this.handleCompareFilesUpload(e);
        });

        // 合体ボタン
        document.getElementById('mergeBtn').addEventListener('click', () => {
            this.mergeAndDownload();
        });
    }

    async handleOriginalFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showStatus('元のワークブックを読み込み中...', 'info', 'uploadStatus1');

        try {
            const data = await this.readFileAsArrayBuffer(file);
            this.originalWorkbook = XLSX.read(data, { type: 'array' });
            this.originalFileName = file.name;

            // ファイル情報を表示
            this.displayOriginalFile(file);
            this.showStatus('元のワークブックの読み込みが完了しました', 'success', 'uploadStatus1');

            // 比較ファイルがある場合は比較を更新
            if (this.compareWorkbooks.length > 0) {
                this.updateComparisons();
            }
        } catch (error) {
            console.error('元のファイル読み込みエラー:', error);
            this.showStatus(`エラー: ${error.message}`, 'error', 'uploadStatus1');
        }
    }

    async handleCompareFilesUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        this.showStatus(`${files.length}個のファイルを読み込み中...`, 'info', 'uploadStatus2');

        try {
            for (const file of files) {
                const data = await this.readFileAsArrayBuffer(file);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // 範囲を自動取得
                const compareSheet = workbook.Sheets['Ans'];
                const maxRow = compareSheet ? this.getMaxRowWithDataInColumnD(compareSheet) : 1;
                
                this.compareWorkbooks.push({
                    workbook: workbook,
                    fileName: file.name,
                    startRow: 1, // 比較開始行
                    endRow: maxRow // 比較終了行（D列にデータが含まれる最大行）
                });
            }

            // ファイル情報を表示
            this.displayCompareFiles();
            this.showStatus('比較ファイルの読み込みが完了しました', 'success', 'uploadStatus2');

            // 元のファイルがある場合は比較を更新
            if (this.originalWorkbook) {
                this.updateComparisons();
            }
        } catch (error) {
            console.error('比較ファイル読み込みエラー:', error);
            this.showStatus(`エラー: ${error.message}`, 'error', 'uploadStatus2');
        }
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('ファイル読み込みエラー'));
            reader.readAsArrayBuffer(file);
        });
    }

    displayOriginalFile(file) {
        const fileList = document.getElementById('originalFileList');
        fileList.innerHTML = `
            <div class="file-item">
                <div class="file-item-info">
                    <div class="file-item-name">${file.name}</div>
                    <div class="file-item-meta">サイズ: ${(file.size / 1024).toFixed(2)} KB</div>
                </div>
            </div>
        `;
    }

    displayCompareFiles() {
        const fileList = document.getElementById('compareFilesList');
        if (this.compareWorkbooks.length === 0) {
            fileList.innerHTML = '';
            return;
        }
        
        fileList.innerHTML = this.compareWorkbooks.map((item, index) => `
            <div class="file-item">
                <div class="file-item-info">
                    <div class="file-item-name">${item.fileName}</div>
                    <div class="file-item-meta">
                        <div style="margin: 5px 0;">
                            <label>開始行: <input type="number" class="start-row-input" data-index="${index}" value="${item.startRow}" min="1" max="${item.endRow}" style="width: 70px;" /></label>
                            <label style="margin-left: 10px;">終了行: <input type="number" class="end-row-input" data-index="${index}" value="${item.endRow}" min="${item.startRow}" style="width: 70px;" /></label>
                        </div>
                    </div>
                </div>
                <button class="remove-btn" data-index="${index}">削除</button>
            </div>
        `).join('');

        // 開始行入力のイベントリスナー
        fileList.querySelectorAll('.start-row-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const startRow = parseInt(e.target.value) || 1;
                this.compareWorkbooks[index].startRow = startRow;
                
                // 終了行の最小値を更新
                const endRowInput = fileList.querySelector(`.end-row-input[data-index="${index}"]`);
                if (endRowInput) {
                    endRowInput.min = startRow;
                }
                
                this.updateComparisons();
            });
        });

        // 終了行入力のイベントリスナー
        fileList.querySelectorAll('.end-row-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                const endRow = parseInt(e.target.value) || 1;
                this.compareWorkbooks[index].endRow = endRow;
                
                // 開始行の最大値を更新
                const startRowInput = fileList.querySelector(`.start-row-input[data-index="${index}"]`);
                if (startRowInput) {
                    startRowInput.max = endRow;
                }
                
                this.updateComparisons();
            });
        });

        // 削除ボタンのイベントリスナー
        fileList.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.compareWorkbooks.splice(index, 1);
                this.displayCompareFiles();
                this.updateComparisons();
            });
        });
    }

    updateComparisons() {
        if (!this.originalWorkbook || this.compareWorkbooks.length === 0) {
            return;
        }

        const originalSheet = this.originalWorkbook.Sheets['Ans'];
        if (!originalSheet) {
            this.showStatus('元のワークブックにAnsシートが見つかりません', 'error');
            return;
        }

        // 比較セクションを表示
        document.getElementById('comparisonSection').classList.remove('hidden');

        // 比較データを生成
        this.comparisonData = [];
        const comparisonList = document.getElementById('comparisonList');
        comparisonList.innerHTML = '';

        this.compareWorkbooks.forEach((compareItem, workbookIndex) => {
            const compareSheet = compareItem.workbook.Sheets['Ans'];
            if (!compareSheet) {
                this.showStatus(`${compareItem.fileName}にAnsシートが見つかりません`, 'error');
                return;
            }

            // 開始行から終了行まで全ての行を比較
            for (let row = compareItem.startRow; row <= compareItem.endRow; row++) {
                // D列にデータがあるか確認
                const cellD = compareSheet[`D${row}`];
                const compareCellK = compareSheet[`K${row}`];
                const originalCellK = originalSheet[`K${row}`];
                const hasD = cellD && cellD.v !== undefined && cellD.v !== null && cellD.v !== '';
                const hasK = (compareCellK && compareCellK.v !== undefined && compareCellK.v !== null && compareCellK.v !== '') ||
                            (originalCellK && originalCellK.v !== undefined && originalCellK.v !== null && originalCellK.v !== '');
                
                // D列にデータがある、またはK列にデータがある場合に処理
                if (hasD || hasK) {
                    // 行に変化があるかチェック（K列に値がある場合は常にtrue）
                    if (this.hasRowChanged(originalSheet, compareSheet, row)) {
                        const index = this.comparisonData.length;
                        const comparison = this.createComparison(index, workbookIndex, row, compareItem, originalSheet, compareSheet);
                        this.comparisonData.push(comparison);
                        comparisonList.appendChild(comparison.element);
                    }
                }
            }
        });
    }

    createComparison(index, workbookIndex, row, compareItem, originalSheet, compareSheet) {
        
        // 元のデータ（D列以降）を取得
        const originalData = this.getRowDataFromColumnD(originalSheet, row);
        
        // 比較データ（D列以降）を取得
        const compareData = this.getRowDataFromColumnD(compareSheet, row);

        // 変化がある列のヘッダーのみを取得（K列は除外）
        const headers = this.getDifferentColumnHeaders(originalSheet, compareSheet, originalData, compareData);

        // K列のメモを取得
        const kColLetter = this.getColumnLetter(10);
        const originalMemo = (originalData[kColLetter] || '').trim();
        const compareMemo = (compareData[kColLetter] || '').trim();
        const hasMemo = originalMemo !== '' || compareMemo !== '';

        // 比較アイテムの要素を作成
        const comparisonDiv = document.createElement('div');
        comparisonDiv.className = 'comparison-item';
        comparisonDiv.innerHTML = `
            <div class="comparison-item-header">
                <h3>${compareItem.fileName} (行 ${row})</h3>
            </div>
            <div class="comparison-content">
                <div class="comparison-column" data-index="${index}" data-type="compare">
                    <h4>比較ワークブック</h4>
                    ${this.createComparisonTable(headers, compareData, index, 'compare', originalData, compareData)}
                    ${hasMemo ? this.createMemoSection(index, 'compare', compareMemo, originalMemo, compareMemo) : ''}
                    <div class="select-radio">
                        <label>
                            <input type="radio" name="select-${index}" value="compare" />
                            <span>変更後の解答を選択</span>
                        </label>
                    </div>
                </div>
                <div class="comparison-column" data-index="${index}" data-type="original">
                    <h4>元のワークブック</h4>
                    ${this.createComparisonTable(headers, originalData, index, 'original', originalData, compareData)}
                    ${hasMemo ? this.createMemoSection(index, 'original', originalMemo, originalMemo, compareMemo) : ''}
                    <div class="select-radio">
                        <label>
                            <input type="radio" name="select-${index}" value="original" checked />
                            <span>修正前の解答を選択</span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        // ラジオボタンのイベントリスナー
        comparisonDiv.querySelectorAll(`input[name="select-${index}"]`).forEach(radio => {
            radio.addEventListener('change', (e) => {
                const selectedType = e.target.value;
                const columns = comparisonDiv.querySelectorAll('.comparison-column');
                columns.forEach(col => {
                    if (col.dataset.type === selectedType) {
                        col.classList.add('selected');
                    } else {
                        col.classList.remove('selected');
                    }
                });
            });
        });

        // 初期選択を反映
        comparisonDiv.querySelector('.comparison-column[data-type="original"]').classList.add('selected');

        return {
            index: index,
            workbookIndex: workbookIndex,
            row: row,
            compareItem: compareItem,
            originalData: originalData,
            compareData: compareData,
            headers: headers,
            selectedData: originalData,
            element: comparisonDiv
        };
    }

    getColumnHeaders(originalSheet, compareSheet) {
        const headers = [];
        
        // D列（インデックス3）以降のヘッダーを取得
        for (let colIndex = 3; colIndex < 100; colIndex++) {
            const colLetter = this.getColumnLetter(colIndex);
            
            // 1行目のヘッダーを取得
            const originalHeader = this.getCellValue(originalSheet, `${colLetter}1`);
            const compareHeader = this.getCellValue(compareSheet, `${colLetter}1`);
            
            // どちらかのシートにヘッダーが存在する場合
            const header = originalHeader || compareHeader;
            if (header !== null && header !== undefined && header !== '') {
                headers.push({
                    colIndex: colIndex,
                    colLetter: colLetter,
                    header: String(header)
                });
            }
        }

        return headers;
    }

    getDifferentColumnHeaders(originalSheet, compareSheet, originalData, compareData) {
        const headers = [];
        
        // D列（インデックス3）以降のヘッダーを取得
        for (let colIndex = 3; colIndex < 100; colIndex++) {
            const colLetter = this.getColumnLetter(colIndex);
            const isKColumn = colIndex === 10;
            
            // K列はテーブルから除外（別途メモとして表示）
            if (isKColumn) {
                continue;
            }
            
            // 1行目のヘッダーを取得
            const originalHeader = this.getCellValue(originalSheet, `${colLetter}1`);
            const compareHeader = this.getCellValue(compareSheet, `${colLetter}1`);
            
            // どちらかのシートにヘッダーが存在する場合
            const header = originalHeader || compareHeader;
            if (header !== null && header !== undefined && header !== '') {
                // 元のデータと比較データを取得
                const originalValue = originalData[colLetter] || '';
                const compareValue = compareData[colLetter] || '';
                const isDifferent = String(originalValue).trim() !== String(compareValue).trim();
                
                // D、E、F列（インデックス3, 4, 5）は常に表示、それ以外は値が異なる場合のみ表示
                const isDEFColumn = colIndex === 3 || colIndex === 4 || colIndex === 5;
                
                if (isDEFColumn || isDifferent) {
                    headers.push({
                        colIndex: colIndex,
                        colLetter: colLetter,
                        header: String(header)
                    });
                }
            }
        }

        return headers;
    }

    getColumnLetter(colIndex) {
        // A=0, B=1, ..., Z=25, AA=26, AB=27, ...
        let result = '';
        let num = colIndex + 1;
        
        while (num > 0) {
            num--;
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26);
        }
        
        return result;
    }

    hasRowChanged(originalSheet, compareSheet, row) {
        // D列以降のデータを取得
        const originalData = this.getRowDataFromColumnD(originalSheet, row);
        const compareData = this.getRowDataFromColumnD(compareSheet, row);
        
        // K列（インデックス10）の値をチェック
        const kColLetter = this.getColumnLetter(10);
        const originalKValue = (originalData[kColLetter] || '').trim();
        const compareKValue = (compareData[kColLetter] || '').trim();
        
        // K列に値がある場合は常にtrue（emptyでなければ表示）
        if (originalKValue !== '' || compareKValue !== '') {
            return true;
        }
        
        // D列以降の全ての列をチェック
        for (let colIndex = 3; colIndex < 100; colIndex++) {
            const colLetter = this.getColumnLetter(colIndex);
            
            // ヘッダーが存在するか確認
            const originalHeader = this.getCellValue(originalSheet, `${colLetter}1`);
            const compareHeader = this.getCellValue(compareSheet, `${colLetter}1`);
            const header = originalHeader || compareHeader;
            
            if (header !== null && header !== undefined && header !== '') {
                const originalValue = (originalData[colLetter] || '').trim();
                const compareValue = (compareData[colLetter] || '').trim();
                
                // 値が異なる場合は変化あり
                if (originalValue !== compareValue) {
                    return true;
                }
            }
        }
        
        return false;
    }

    getMaxRowWithDataInColumnD(worksheet) {
        let maxRow = 1;
        
        // まずワークシートの全体範囲を取得
        if (worksheet['!ref']) {
            const range = XLSX.utils.decode_range(worksheet['!ref']);
            const sheetMaxRow = range.e.r + 1; // 1-based indexing
            
            // シートの範囲内でD列のセルをチェック
            for (let row = 1; row <= sheetMaxRow; row++) {
                const cellAddress = `D${row}`;
                const cell = worksheet[cellAddress];
                
                if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
                    maxRow = row;
                }
            }
        } else {
            // シート範囲が不明な場合は、D列のセルを直接検索
            for (const cellAddress in worksheet) {
                if (cellAddress.startsWith('D') && cellAddress !== 'D') {
                    const match = cellAddress.match(/^D(\d+)$/);
                    if (match) {
                        const row = parseInt(match[1]);
                        const cell = worksheet[cellAddress];
                        
                        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
                            maxRow = Math.max(maxRow, row);
                        }
                    }
                }
            }
        }
        
        // 最低でも1行は処理対象とする
        return Math.max(maxRow, 1);
    }

    getRowDataFromColumnD(sheet, row) {
        const data = {};
        
        // D列以降のデータを取得
        for (let colIndex = 3; colIndex < 100; colIndex++) {
            const colLetter = this.getColumnLetter(colIndex);
            const cellValue = this.getCellValue(sheet, `${colLetter}${row}`);
            data[colLetter] = cellValue !== null && cellValue !== undefined ? String(cellValue) : '';
        }

        return data;
    }

    getCellValue(sheet, cellAddress) {
        const cell = sheet[cellAddress];
        if (!cell || cell.v === undefined || cell.v === null) {
            return null;
        }
        return cell.v;
    }

    createComparisonTable(headers, data, comparisonIndex, dataType, originalData, compareData) {
        let html = '<table class="comparison-table"><thead><tr>';
        
        headers.forEach(header => {
            html += `<th>${header.header}</th>`;
        });
        
        html += '</tr></thead><tbody><tr>';

        headers.forEach(header => {
            const value = data[header.colLetter] || '';
            const cellId = `cell-${comparisonIndex}-${dataType}-${header.colLetter}`;
            
            // 変化があるかチェック
            const originalValue = (originalData[header.colLetter] || '').trim();
            const compareValue = (compareData[header.colLetter] || '').trim();
            const isDifferent = originalValue !== compareValue;
            const cellClass = isDifferent ? 'editable-cell cell-changed' : 'editable-cell';
            
            html += `
                <td>
                    <textarea 
                        class="${cellClass}" 
                        id="${cellId}"
                        data-comparison-index="${comparisonIndex}"
                        data-type="${dataType}"
                        data-column="${header.colLetter}"
                        rows="3"
                    >${this.escapeHtml(value)}</textarea>
                </td>
            `;
        });

        html += '</tr></tbody></table>';

        return html;
    }

    createMemoSection(comparisonIndex, dataType, memoValue, originalMemo, compareMemo) {
        const memoId = `memo-${comparisonIndex}-${dataType}`;
        const isDifferent = originalMemo !== compareMemo;
        const cellClass = isDifferent ? 'editable-cell memo-editor cell-changed' : 'editable-cell memo-editor';
        
        return `
            <div class="memo-section">
                <h5>メモ</h5>
                <textarea 
                    class="${cellClass}" 
                    id="${memoId}"
                    data-comparison-index="${comparisonIndex}"
                    data-type="${dataType}"
                    data-column="K"
                    rows="3"
                >${this.escapeHtml(memoValue)}</textarea>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    mergeAndDownload() {
        if (!this.originalWorkbook || this.comparisonData.length === 0) {
            this.showStatus('比較データが不足しています', 'error');
            return;
        }

        try {
            // 元のワークブックをクローン
            const mergedWorkbook = XLSX.utils.book_new();
            
            // 全てのシートをコピー
            this.originalWorkbook.SheetNames.forEach(sheetName => {
                const sheet = this.originalWorkbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
                const newSheet = XLSX.utils.aoa_to_sheet(jsonData);
                XLSX.utils.book_append_sheet(mergedWorkbook, newSheet, sheetName);
            });

            const ansSheet = mergedWorkbook.Sheets['Ans'];
            if (!ansSheet) {
                this.showStatus('Ansシートが見つかりません', 'error');
                return;
            }

            // 各比較データを適用
            this.comparisonData.forEach(comparison => {
                const row = comparison.row;
                
                // 選択されたデータを取得
                const selectedRadio = comparison.element.querySelector(`input[name="select-${comparison.index}"]:checked`);
                const selectedType = selectedRadio ? selectedRadio.value : 'original';
                
                // エディタで編集された内容を取得
                const headers = comparison.headers;
                headers.forEach(header => {
                    const cellId = `cell-${comparison.index}-${selectedType}-${header.colLetter}`;
                    const editor = document.getElementById(cellId);
                    if (editor) {
                        const editedValue = editor.value.trim();
                        const cellAddress = `${header.colLetter}${row}`;
                        
                        if (!ansSheet[cellAddress]) {
                            ansSheet[cellAddress] = {};
                        }
                        ansSheet[cellAddress].v = editedValue;
                        ansSheet[cellAddress].t = 's';
                    }
                });
                
                // K列のメモを取得
                const memoId = `memo-${comparison.index}-${selectedType}`;
                const memoEditor = document.getElementById(memoId);
                if (memoEditor) {
                    const memoValue = memoEditor.value.trim();
                    const kCellAddress = `K${row}`;
                    
                    if (!ansSheet[kCellAddress]) {
                        ansSheet[kCellAddress] = {};
                    }
                    ansSheet[kCellAddress].v = memoValue;
                    ansSheet[kCellAddress].t = 's';
                }
            });

            // ワークブックをダウンロード
            const workbookOutput = XLSX.write(mergedWorkbook, {
                bookType: 'xlsx',
                type: 'array'
            });

            const blob = new Blob([workbookOutput], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'スロット_合体.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showStatus('ファイルのダウンロードが開始されました', 'success');

        } catch (error) {
            console.error('合体エラー:', error);
            this.showStatus(`エラー: ${error.message}`, 'error');
        }
    }

    showStatus(message, type, elementId = 'statusMessage') {
        const statusElement = document.getElementById(elementId);
        if (!statusElement) return;
        
        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
        statusElement.classList.remove('hidden');

        // 成功メッセージは3秒後に自動で消す
        if (type === 'success') {
            setTimeout(() => {
                statusElement.classList.add('hidden');
            }, 3000);
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new AnswerMergeTool();
});
