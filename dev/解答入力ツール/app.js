/**
 * 解答入力ツール - メインアプリケーション
 * 効率的な解答修正のためのWebアプリ
 */

class AnswerInputTool {
    constructor() {
        this.zipFile = null;
        this.workbook = null;
        this.images = {
            questions: {},
            answers: {}
        };
        this.currentRow = 1;
        this.startRow = 1;
        this.endRow = 1;
        this.totalRows = 1;
        this.currentAnswer = '';
        this.currentNotes = '';
        
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // ファイル選択
        document.getElementById('zipFile').addEventListener('change', (e) => {
            this.handleZipUpload(e);
        });

        // 修正開始ボタン
        document.getElementById('startCorrection').addEventListener('click', () => {
            this.startCorrection();
        });

        // 修正判定ボタン
        document.getElementById('needCorrectionBtn').addEventListener('click', () => {
            this.handleNeedCorrectionClick();
        });

        document.getElementById('noCorrectionBtn').addEventListener('click', () => {
            this.handleCorrectionDecision(false);
        });

        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // 行範囲入力の変更監視
        document.getElementById('startRow').addEventListener('change', (e) => {
            this.startRow = parseInt(e.target.value) || 1;
        });

        document.getElementById('endRow').addEventListener('change', (e) => {
            this.endRow = parseInt(e.target.value) || 1;
        });
    }

    async handleZipUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showStatus('ZIPファイルを処理中...', 'info');

        try {
            const zip = new JSZip();
            const zipData = await zip.loadAsync(file);
            
            // スロット.xlsxを探す
            let excelFile = null;
            for (const filename in zipData.files) {
                if (filename.includes('スロット.xlsx') && !zipData.files[filename].dir) {
                    excelFile = zipData.files[filename];
                    break;
                }
            }

            if (!excelFile) {
                throw new Error('スロット.xlsxが見つかりません');
            }

            // Excelファイルを読み込み
            const excelData = await excelFile.async('arraybuffer');
            this.workbook = XLSX.read(excelData, { type: 'array' });

            // 画像ファイルを読み込み
            await this.loadImages(zipData);

            this.showStatus('ZIPファイルの読み込みが完了しました', 'success');
            this.showRangeSection();

        } catch (error) {
            console.error('ZIP処理エラー:', error);
            this.showStatus(`エラー: ${error.message}`, 'error');
        }
    }

    async loadImages(zipData) {
        this.images = {
            questions: {}, // 問題画像 (Ans_I)
            answers: {}    // 解答画像 (Ans_D)
        };
        
        for (const filename in zipData.files) {
            const file = zipData.files[filename];
            
            // 画像ファイルかチェック（.png, .jpg, .jpeg）
            if (!file.dir && /\.(png|jpg|jpeg)$/i.test(filename)) {
                try {
                    const imageData = await file.async('base64');
                    const extension = filename.split('.').pop().toLowerCase();
                    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
                    
                    // Ans_Iフォルダ内の問題画像
                    const questionMatch = filename.match(/Ans_I\/(\d+)\.(png|jpg|jpeg)$/i);
                    if (questionMatch) {
                        const rowNumber = parseInt(questionMatch[1]);
                        this.images.questions[rowNumber] = `data:${mimeType};base64,${imageData}`;
                    }
                    
                    // Ans_Dフォルダ内の解答画像
                    const answerMatch = filename.match(/Ans_D\/(\d+)\.(png|jpg|jpeg)$/i);
                    if (answerMatch) {
                        const rowNumber = parseInt(answerMatch[1]);
                        this.images.answers[rowNumber] = `data:${mimeType};base64,${imageData}`;
                    }
                } catch (error) {
                    console.warn(`画像読み込みエラー: ${filename}`, error);
                }
            }
        }
        
        console.log(`問題画像: ${Object.keys(this.images.questions).length}個, 解答画像: ${Object.keys(this.images.answers).length}個を読み込みました`);
    }

    showRangeSection() {
        document.getElementById('rangeSection').style.display = 'block';
        
        // Ansシートから行数を取得（D列のデータが含まれる最大範囲）
        if (this.workbook && this.workbook.Sheets['Ans']) {
            const worksheet = this.workbook.Sheets['Ans'];
            const maxRow = this.getMaxRowWithDataInColumnD(worksheet);
            
            document.getElementById('endRow').value = maxRow;
            document.getElementById('endRow').max = maxRow;
            this.endRow = maxRow;
            
            console.log(`D列にデータが含まれる最大行: ${maxRow}`);
        }
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
            
            console.log(`シート全体の最大行: ${sheetMaxRow}, D列データの最大行: ${maxRow}`);
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
            
            console.log(`D列データの最大行: ${maxRow}`);
        }
        
        // 最低でも1行は処理対象とする
        return Math.max(maxRow, 1);
    }

    startCorrection() {
        this.startRow = parseInt(document.getElementById('startRow').value) || 1;
        this.endRow = parseInt(document.getElementById('endRow').value) || 1;
        
        if (this.startRow > this.endRow) {
            this.showStatus('開始行は終了行以下である必要があります', 'error');
            return;
        }

        // 開始行からD列にデータがある最初の行を見つける
        this.currentRow = this.findNextValidRow(this.startRow);
        
        if (this.currentRow > this.endRow) {
            this.showStatus('指定された範囲にD列にデータがある行が見つかりません', 'error');
            return;
        }
        
        // 実際の有効な行数を計算
        this.totalRows = this.calculateTotalValidRows();
        
        // UIを表示
        document.getElementById('uploadSection').style.display = 'none';
        document.getElementById('rangeSection').style.display = 'none';
        document.getElementById('imageSection').style.display = 'block';
        document.getElementById('controlSection').style.display = 'block';
        
        this.displayCurrentRow();
    }

    displayCurrentRow() {
        // 進捗表示を更新（処理済みの行数を計算）
        document.getElementById('currentRowDisplay').textContent = `${this.currentRow}行目`;
        const processedRows = this.calculateProcessedRows();
        document.getElementById('progressText').textContent = `${processedRows} / ${this.totalRows}`;
        
        // 画像を表示
        this.displayImage(this.currentRow);
        
        // 現在の解答と備考を取得
        this.getCurrentAnswer();
        this.getCurrentNotes();
        
        // テキストエディターを非表示にリセット
        document.getElementById('textEditor').style.display = 'none';
        document.getElementById('answerInput').value = this.currentAnswer;
        document.getElementById('notesInput').value = this.currentNotes;
        
        // ボタンの状態をリセット
        this.resetButtonStates();
    }

    shouldSkipCurrentRow() {
        if (!this.workbook || !this.workbook.Sheets['Ans']) {
            return false;
        }

        const worksheet = this.workbook.Sheets['Ans'];
        const cellAddress = `D${this.currentRow}`;
        const cell = worksheet[cellAddress];
        
        // D列が空白（undefined、null、空文字列）の場合はスキップ
        return !cell || cell.v === undefined || cell.v === null || cell.v === '';
    }

    findNextValidRow(startRow) {
        if (!this.workbook || !this.workbook.Sheets['Ans']) {
            return startRow;
        }

        const worksheet = this.workbook.Sheets['Ans'];
        
        for (let row = startRow; row <= this.endRow; row++) {
            const cellAddress = `D${row}`;
            const cell = worksheet[cellAddress];
            
            // D列にデータがある行を見つけた場合
            if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
                return row;
            }
        }
        
        // 有効な行が見つからない場合は範囲外の値を返す
        return this.endRow + 1;
    }

    calculateProcessedRows() {
        if (!this.workbook || !this.workbook.Sheets['Ans']) {
            return 1;
        }

        const worksheet = this.workbook.Sheets['Ans'];
        let processedCount = 0;
        
        // 開始行から現在の行までの有効な行数をカウント
        for (let row = this.startRow; row <= this.currentRow; row++) {
            const cellAddress = `D${row}`;
            const cell = worksheet[cellAddress];
            
            if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
                processedCount++;
            }
        }
        
        return processedCount;
    }

    calculateTotalValidRows() {
        if (!this.workbook || !this.workbook.Sheets['Ans']) {
            return 1;
        }

        const worksheet = this.workbook.Sheets['Ans'];
        let validCount = 0;
        
        // 指定された範囲内の有効な行数をカウント
        for (let row = this.startRow; row <= this.endRow; row++) {
            const cellAddress = `D${row}`;
            const cell = worksheet[cellAddress];
            
            if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
                validCount++;
            }
        }
        
        return Math.max(validCount, 1); // 最低1行は表示
    }

    displayImage(rowNumber) {
        const imageDisplay = document.getElementById('imageDisplay');
        let html = '';
        
        html += `
            <div style="display: flex; gap: 20px; align-items: flex-start;">
                <div style="flex: 1;">
                    <h4>問題画像 (${rowNumber}行目)</h4>
                    ${this.images.questions[rowNumber] ? 
                        `<img src="${this.images.questions[rowNumber]}" alt="問題 ${rowNumber}" style="width: 100%; max-height: 400px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px;" />` :
                        `<p style="color: #666;">問題画像が見つかりません: Ans_I/${rowNumber}.png</p>`
                    }
                </div>
                <div style="flex: 1;">
                    <h4>解答画像 (${rowNumber}行目)</h4>
                    ${this.images.answers[rowNumber] ? 
                        `<img src="${this.images.answers[rowNumber]}" alt="解答 ${rowNumber}" style="width: 100%; max-height: 400px; object-fit: contain; border: 1px solid #ddd; border-radius: 4px;" />` :
                        `<p style="color: #666;">解答画像が見つかりません: Ans_D/${rowNumber}.png</p>`
                    }
                </div>
            </div>
        `;
        
        imageDisplay.innerHTML = html;
    }

    getCurrentAnswer() {
        if (!this.workbook || !this.workbook.Sheets['Ans']) {
            this.currentAnswer = '';
            return;
        }

        const worksheet = this.workbook.Sheets['Ans'];
        const cellAddress = `D${this.currentRow}`;
        const cell = worksheet[cellAddress];
        
        this.currentAnswer = cell ? (cell.v || '') : '';
    }

    getCurrentNotes() {
        if (!this.workbook || !this.workbook.Sheets['Ans']) {
            this.currentNotes = '';
            return;
        }

        const worksheet = this.workbook.Sheets['Ans'];
        const cellAddress = `K${this.currentRow}`;
        const cell = worksheet[cellAddress];
        
        this.currentNotes = cell ? (cell.v || '') : '';
    }

    handleNeedCorrectionClick() {
        const needCorrectionBtn = document.getElementById('needCorrectionBtn');
        
        // ボタンが「提出」状態の場合は保存処理を実行
        if (needCorrectionBtn.innerHTML.includes('提出')) {
            this.saveAnswer();
        } else {
            // 初回クリック時は修正モードに移行
            this.handleCorrectionDecision(true);
        }
    }

    handleCorrectionDecision(needsCorrection) {
        console.log(`修正判定: ${needsCorrection ? '必要あり' : 'なし'}`);
        
        if (needsCorrection) {
            // 修正が必要な場合、テキストエディターを表示
            const textEditor = document.getElementById('textEditor');
            const answerInput = document.getElementById('answerInput');
            
            if (textEditor && answerInput) {
                textEditor.style.display = 'block';
                answerInput.value = this.currentAnswer; // 現在の解答を設定
                document.getElementById('notesInput').value = this.currentNotes; // 現在の備考を設定
                answerInput.focus();
                answerInput.select();
                console.log('テキストエディターを表示しました');
            } else {
                console.error('テキストエディター要素が見つかりません');
            }
            
            // ボタンの状態を更新
            const needCorrectionBtn = document.getElementById('needCorrectionBtn');
            needCorrectionBtn.classList.add('active');
            needCorrectionBtn.innerHTML = '提出<br><small>(← キー)</small>';
            document.getElementById('noCorrectionBtn').classList.remove('active');
        } else {
            // 修正不要な場合、次の行へ
            console.log('修正不要のため次の行へ');
            this.moveToNextRow();
        }
    }

    async saveAnswer() {
        const newAnswer = document.getElementById('answerInput').value.trim();
        const newNotes = document.getElementById('notesInput').value.trim();
        
        if (!this.workbook || !this.workbook.Sheets['Ans']) {
            this.showStatus('Excelファイルが読み込まれていません', 'error');
            return;
        }

        try {
            const worksheet = this.workbook.Sheets['Ans'];
            
            // D列に新しい解答を書き込み
            const answerCellAddress = `D${this.currentRow}`;
            if (!worksheet[answerCellAddress]) {
                worksheet[answerCellAddress] = {};
            }
            worksheet[answerCellAddress].v = newAnswer;
            worksheet[answerCellAddress].t = 's'; // string type
            
            // K列に備考を書き込み（入力がある場合のみ）
            const notesCellAddress = `K${this.currentRow}`;
            if (newNotes) {
                if (!worksheet[notesCellAddress]) {
                    worksheet[notesCellAddress] = {};
                }
                worksheet[notesCellAddress].v = newNotes;
                worksheet[notesCellAddress].t = 's'; // string type
                console.log(`${this.currentRow}行目の備考を更新: "${newNotes}"`);
            } else if (worksheet[notesCellAddress]) {
                // 備考が空の場合、既存の値をクリア
                delete worksheet[notesCellAddress];
                console.log(`${this.currentRow}行目の備考をクリア`);
            }
            
            console.log(`${this.currentRow}行目の解答を更新: "${newAnswer}"`);
            
            // 次の行へ
            this.moveToNextRow();
            
        } catch (error) {
            console.error('保存エラー:', error);
            this.showStatus(`保存エラー: ${error.message}`, 'error');
        }
    }

    moveToNextRow() {
        // 次の有効な行を見つける
        const nextValidRow = this.findNextValidRow(this.currentRow + 1);
        
        if (nextValidRow > this.endRow) {
            // 全ての行の処理が完了
            this.showCompletionDialog();
            return;
        }
        
        this.currentRow = nextValidRow;
        this.displayCurrentRow();
    }

    showCompletionDialog() {
        const shouldDownload = confirm('全ての行の処理が完了しました。修正されたExcelファイルをダウンロードしますか？');
        
        if (shouldDownload) {
            this.downloadModifiedExcel();
        }
        
        // リセット
        this.resetApplication();
    }

    downloadModifiedExcel() {
        try {
            const workbookOutput = XLSX.write(this.workbook, { 
                bookType: 'xlsx', 
                type: 'array' 
            });
            
            const blob = new Blob([workbookOutput], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'スロット.xlsx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showStatus('ファイルのダウンロードが開始されました', 'success');
            
        } catch (error) {
            console.error('ダウンロードエラー:', error);
            this.showStatus(`ダウンロードエラー: ${error.message}`, 'error');
        }
    }

    resetApplication() {
        // 初期状態に戻す
        document.getElementById('uploadSection').style.display = 'block';
        document.getElementById('rangeSection').style.display = 'none';
        document.getElementById('imageSection').style.display = 'none';
        document.getElementById('controlSection').style.display = 'none';
        
        // データをリセット
        this.workbook = null;
        this.images = {
            questions: {},
            answers: {}
        };
        this.currentRow = 1;
        this.startRow = 1;
        this.endRow = 1;
        this.currentAnswer = '';
        this.currentNotes = '';
        
        // フォームをリセット
        document.getElementById('zipFile').value = '';
        document.getElementById('startRow').value = '1';
        document.getElementById('endRow').value = '1';
    }

    handleKeyboardShortcuts(event) {
        // メインコンテンツが表示されている時のみ有効
        if (document.getElementById('controlSection').style.display === 'none') {
            return;
        }

        // テキストエディターにフォーカスがある場合の特別処理
        const answerInput = document.getElementById('answerInput');
        const notesInput = document.getElementById('notesInput');
        
        if (document.activeElement === answerInput || document.activeElement === notesInput) {
            if (event.shiftKey && event.key === 'Enter') {
                event.preventDefault();
                this.saveAnswer();
            }
            return;
        }

        // 通常のショートカット
        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.handleNeedCorrectionClick();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.handleCorrectionDecision(false);
                break;
        }
    }

    resetButtonStates() {
        const needCorrectionBtn = document.getElementById('needCorrectionBtn');
        needCorrectionBtn.classList.remove('active');
        needCorrectionBtn.innerHTML = '修正の必要あり<br><small>(← キー)</small>';
        document.getElementById('noCorrectionBtn').classList.remove('active');
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('uploadStatus');
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
    new AnswerInputTool();
});
