/**
 * スロット問題生成ツール - メインアプリケーション
 * Pythonスクリプトの機能をJavaScriptで再実装
 */

class SlotProblemGenerator {
    constructor() {
        this.workbook = null;
        this.problemsData = [];
        this.answersData = [];
        this.currentStep = 1;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // ファイル選択
        document.getElementById('excelFile').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // 検証ボタン
        document.getElementById('validateBtn').addEventListener('click', () => {
            this.validateWorkbook();
        });

        // 生成ボタン
        document.getElementById('generateBtn').addEventListener('click', () => {
            this.generateProblems();
        });

        // プロンプトコピーボタン
        document.getElementById('copyPromptBtn').addEventListener('click', () => {
            this.copyPrompt();
        });

        // インポートボタン
        document.getElementById('importBtn').addEventListener('click', () => {
            this.importAnswers();
        });

        // ダウンロードボタン
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadFinalFile();
        });

        // JSON入力の変更を監視
        document.getElementById('jsonInput').addEventListener('input', (e) => {
            this.handleJsonInput(e);
        });
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        console.log('ファイルが選択されました:', file.name);

        // ファイル情報を表示
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        
        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        fileInfo.classList.remove('hidden');

        // ファイルを読み込み
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                console.log('ファイルの読み込みを開始...');
                const data = new Uint8Array(e.target.result);
                this.workbook = XLSX.read(data, { type: 'array' });
                console.log('ファイルが正常に読み込まれました');
                this.updateStepStatus(1, 'success', 'ファイルが正常に読み込まれました');
                
                // 自動で検証を開始
                setTimeout(() => {
                    this.validateWorkbook();
                }, 500);
                
            } catch (error) {
                console.error('ファイル読み込みエラー:', error);
                this.updateStepStatus(1, 'error', `ファイルの読み込みに失敗しました: ${error.message}`);
            }
        };
        
        reader.onerror = (error) => {
            console.error('ファイル読み込みエラー:', error);
            this.updateStepStatus(1, 'error', 'ファイルの読み込み中にエラーが発生しました');
        };
        
        reader.readAsArrayBuffer(file);
    }

    validateWorkbook() {
        if (!this.workbook) {
            this.updateStepStatus(2, 'error', 'ファイルが読み込まれていません');
            return;
        }

        console.log('ファイル構造の検証を開始...');
        this.updateStepStatus(2, 'info', 'ファイル構造を検証中...');
        
        const validationResult = this.checkWorkbookStructure();
        const resultsDiv = document.getElementById('validationResults');
        
        if (validationResult.valid) {
            console.log('検証が成功しました');
            this.updateStepStatus(2, 'success', 'ファイル構造の検証が完了しました');
            this.enableStep(3);
            resultsDiv.innerHTML = '<div class="status success">✓ すべてのシートと列名が正しく設定されています</div>';
        } else {
            console.log('検証エラー:', validationResult.errors);
            this.updateStepStatus(2, 'error', 'ファイル構造に問題があります');
            let errorHtml = '<div class="error-details"><h4>検証エラー:</h4><ul>';
            validationResult.errors.forEach(error => {
                errorHtml += `<li>${error}</li>`;
            });
            errorHtml += '</ul></div>';
            resultsDiv.innerHTML = errorHtml;
        }
    }

    checkWorkbookStructure() {
        const errors = [];
        const warnings = [];
        
        // 必要なシートのリスト
        const requiredSheets = ['Que_L', 'Que_C', 'Que_R', 'Ans', 'LC', 'LR', 'CR'];
        
        // シートの存在チェック
        const existingSheets = this.workbook.SheetNames;
        console.log('存在するシート:', existingSheets);
        const missingSheets = requiredSheets.filter(sheet => !existingSheets.includes(sheet));
        
        if (missingSheets.length > 0) {
            errors.push(`必要なシートが見つかりません: ${missingSheets.join(', ')}`);
        }
        
        // 各シートの列名チェック
        requiredSheets.forEach(sheetName => {
            if (existingSheets.includes(sheetName)) {
                const sheetErrors = this.checkSheetHeaders(sheetName);
                errors.push(...sheetErrors);
                
                // Ansシート以外で2行目以降が空欄の場合はエラー
                if (sheetName !== 'Ans') {
                    const dataErrors = this.checkSheetData(sheetName);
                    errors.push(...dataErrors);
                }
            }
        });
        
        return {
            valid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    checkSheetHeaders(sheetName) {
        const errors = [];
        const worksheet = this.workbook.Sheets[sheetName];
        
        if (['Que_L', 'Que_C', 'Que_R'].includes(sheetName)) {
            // Queシートの列名チェック
            const a1 = this.getCellValue(worksheet, 'A1');
            const b1 = this.getCellValue(worksheet, 'B1');
            
            if (a1 !== 'type') {
                errors.push(`${sheetName} A1: 'type'である必要があります（現在: ${a1}）`);
            }
            if (b1 !== 'question') {
                errors.push(`${sheetName} B1: 'question'である必要があります（現在: ${b1}）`);
            }
        } else if (sheetName === 'Ans') {
            // Ansシートの列名チェック（H1は任意の値でOK）
            const expectedHeaders = ['row_L', 'row_C', 'row_R', 'ans', 'lie_answer1', 'lie_answer2', 'lie_answer3'];
            
            expectedHeaders.forEach((expected, index) => {
                const cellAddress = String.fromCharCode(65 + index) + '1';
                const actualValue = this.getCellValue(worksheet, cellAddress);
                if (actualValue !== expected) {
                    errors.push(`${sheetName} ${cellAddress}: '${expected}'である必要があります（現在: ${actualValue}）`);
                }
            });
        } else if (['LC', 'LR', 'CR'].includes(sheetName)) {
            // 制約シートの列名チェック
            const a1 = this.getCellValue(worksheet, 'A1');
            const b1 = this.getCellValue(worksheet, 'B1');
            
            if (sheetName === 'LC') {
                if (a1 !== 'type_L') {
                    errors.push(`${sheetName} A1: 'type_L'である必要があります（現在: ${a1}）`);
                }
                if (b1 !== 'type_C') {
                    errors.push(`${sheetName} B1: 'type_C'である必要があります（現在: ${b1}）`);
                }
            } else if (sheetName === 'LR') {
                if (a1 !== 'type_L') {
                    errors.push(`${sheetName} A1: 'type_L'である必要があります（現在: ${a1}）`);
                }
                if (b1 !== 'type_R') {
                    errors.push(`${sheetName} B1: 'type_R'である必要があります（現在: ${b1}）`);
                }
            } else if (sheetName === 'CR') {
                if (a1 !== 'type_C') {
                    errors.push(`${sheetName} A1: 'type_C'である必要があります（現在: ${a1}）`);
                }
                if (b1 !== 'type_R') {
                    errors.push(`${sheetName} B1: 'type_R'である必要があります（現在: ${b1}）`);
                }
            }
        }
        
        return errors;
    }

    checkSheetData(sheetName) {
        const errors = [];
        const worksheet = this.workbook.Sheets[sheetName];
        
        // 2行目以降にデータがあるかチェック
        let hasData = false;
        let row = 2;
        
        while (row <= 1000) { // 最大1000行までチェック
            const aValue = this.getCellValue(worksheet, `A${row}`);
            const bValue = this.getCellValue(worksheet, `B${row}`);
            
            // 両方のセルが空の場合は終了
            if ((!aValue || aValue.toString().trim() === '') && 
                (!bValue || bValue.toString().trim() === '')) {
                break;
            }
            
            // どちらか一方でも値があればデータありと判定
            if (aValue && aValue.toString().trim() !== '' || 
                bValue && bValue.toString().trim() !== '') {
                hasData = true;
                break;
            }
            
            row++;
        }
        
        if (!hasData) {
            errors.push(`${sheetName}: データが存在しません。`);
        }
        
        return errors;
    }

    generateProblems() {
        if (!this.workbook) {
            this.updateStepStatus(3, 'error', 'ファイルが読み込まれていません');
            return;
        }

        console.log('問題の生成を開始...');
        this.updateStepStatus(3, 'info', '問題を生成中...');
        
        try {
            const result = this.generateCombinations();
            this.problemsData = result.problems;
            
            console.log(`問題の生成が完了しました: ${result.count}件`);
            this.updateStepStatus(3, 'success', `問題の生成が完了しました（${result.count}件）`);
            this.enableStep(4);
            
            // Problems.txtをダウンロード
            this.downloadProblemsTxt();
            
            const resultsDiv = document.getElementById('generationResults');
            resultsDiv.innerHTML = `
                <div class="status success">
                    ✓ ${result.count}件の問題を生成しました<br>
                    ✓ Problems.txtをダウンロードしました
                </div>
            `;
        } catch (error) {
            console.error('問題生成エラー:', error);
            this.updateStepStatus(3, 'error', `問題の生成に失敗しました: ${error.message}`);
        }
    }

    generateCombinations() {
        const targetSheets = {
            'L': 'Que_L',
            'C': 'Que_C',
            'R': 'Que_R'
        };
        
        const constraintSheets = {
            'LC': 'LC',
            'LR': 'LR',
            'CR': 'CR'
        };

        // 制約ペアを読み込み
        const lcPairs = this.loadConstraintPairs('LC');
        const lrPairs = this.loadConstraintPairs('LR');
        const crPairs = this.loadConstraintPairs('CR');

        console.log('制約ペア:', { lcPairs: lcPairs.size, lrPairs: lrPairs.size, crPairs: crPairs.size });

        // 既存のAnsデータを読み込み
        const existingAnsData = this.loadExistingAnsData();

        // 各シートのデータを読み込み
        const lData = this.loadSheetData('Que_L');
        const cData = this.loadSheetData('Que_C');
        const rData = this.loadSheetData('Que_R');

        console.log('シートデータ:', { lData: lData.length, cData: cData.length, rData: rData.length });

        const problems = [];
        let count = 0;

        // Ansシートを取得
        const ansSheet = this.workbook.Sheets['Ans'];
        let ansRow = 2 + existingAnsData.size; // 既存データの次の行から開始

        // 組み合わせを生成
        for (let i = 0; i < lData.length; i++) {
            for (let j = 0; j < cData.length; j++) {
                for (let k = 0; k < rData.length; k++) {
                    const lItem = lData[i];
                    const cItem = cData[j];
                    const rItem = rData[k];

                    if (!lItem.type || !cItem.type || !rItem.type) continue;

                    const typeL = parseInt(lItem.type);
                    const typeC = parseInt(cItem.type);
                    const typeR = parseInt(rItem.type);

                    if (isNaN(typeL) || isNaN(typeC) || isNaN(typeR)) continue;

                    // 制約条件をチェック
                    if (this.isValidCombination(typeL, typeC, typeR, lcPairs, lrPairs, crPairs)) {
                        const combination = [i + 2, j + 2, k + 2]; // 行番号（ヘッダーを考慮）
                        
                        if (!this.isExistingCombination(combination, existingAnsData)) {
                            const problem = {
                                row_L: i + 2,
                                row_C: j + 2,
                                row_R: k + 2,
                                question: lItem.question + cItem.question + rItem.question,
                                type_L: typeL,
                                type_C: typeC,
                                type_R: typeR
                            };
                            problems.push(problem);
                            
                            // AnsシートにA, B, C, I列を書き込み
                            this.setCellValue(ansSheet, `A${ansRow}`, i + 2); // row_L
                            this.setCellValue(ansSheet, `B${ansRow}`, j + 2); // row_C
                            this.setCellValue(ansSheet, `C${ansRow}`, k + 2); // row_R
                            this.setCellValue(ansSheet, `I${ansRow}`, problem.question); // 問題文
                            
                            console.log(`Ansシートの${ansRow}行目に問題を追加:`, {
                                row_L: i + 2,
                                row_C: j + 2,
                                row_R: k + 2,
                                question: problem.question
                            });
                            
                            ansRow++;
                            count++;
                        }
                    }
                }
            }
        }

        return { problems, count };
    }

    loadConstraintPairs(sheetName) {
        const worksheet = this.workbook.Sheets[sheetName];
        const pairs = new Set();
        let row = 2; // ヘッダー行をスキップ

        while (true) {
            const val1 = this.getCellValue(worksheet, `A${row}`);
            const val2 = this.getCellValue(worksheet, `B${row}`);

            if (!val1 || val1.toString().trim() === '') break;

            try {
                pairs.add(`${parseInt(val1)},${parseInt(val2)}`);
            } catch (e) {
                console.warn(`警告: ${sheetName} ${row}行目の値 (${val1}, ${val2}) は整数ペアとして解釈できませんでした。`);
            }

            row++;
        }

        return pairs;
    }

    loadExistingAnsData() {
        const worksheet = this.workbook.Sheets['Ans'];
        const existingData = new Set();
        let row = 2; // ヘッダー行をスキップ

        while (true) {
            const valA = this.getCellValue(worksheet, `A${row}`);
            const valB = this.getCellValue(worksheet, `B${row}`);
            const valC = this.getCellValue(worksheet, `C${row}`);

            if (!valA || !valB || !valC) break;
            if (valA.toString().trim() === '' || valB.toString().trim() === '' || valC.toString().trim() === '') break;

            try {
                existingData.add(`${parseInt(valA)},${parseInt(valB)},${parseInt(valC)}`);
            } catch (e) {
                console.warn(`警告: Ans ${row}行目の値 (${valA}, ${valB}, ${valC}) は整数として解釈できませんでした。`);
            }

            row++;
        }

        return existingData;
    }

    loadSheetData(sheetName) {
        const worksheet = this.workbook.Sheets[sheetName];
        const data = [];
        let row = 2; // ヘッダー行をスキップ

        while (true) {
            const type = this.getCellValue(worksheet, `A${row}`);
            const question = this.getCellValue(worksheet, `B${row}`);

            if (!type || !question) break;
            if (type.toString().trim() === '' || question.toString().trim() === '') break;

            data.push({
                type: type,
                question: question
            });

            row++;
        }

        return data;
    }

    isValidCombination(typeL, typeC, typeR, lcPairs, lrPairs, crPairs) {
        return lcPairs.has(`${typeL},${typeC}`) &&
               lrPairs.has(`${typeL},${typeR}`) &&
               crPairs.has(`${typeC},${typeR}`);
    }

    isExistingCombination(combination, existingData) {
        return existingData.has(`${combination[0]},${combination[1]},${combination[2]}`);
    }

    importAnswers() {
        const jsonInput = document.getElementById('jsonInput').value.trim();
        
        console.log('インポート処理を開始...');
        console.log('入力されたJSON:', jsonInput.substring(0, 100) + '...');
        
        if (!jsonInput) {
            this.updateStepStatus(4, 'error', 'JSONデータが入力されていません');
            return;
        }

        try {
            const answers = JSON.parse(jsonInput);
            
            // JSONの形式を判定して適切に処理
            if (Array.isArray(answers)) {
                // 配列形式の場合
                this.answersData = answers;
            } else if (typeof answers === 'object' && answers !== null) {
                // オブジェクト形式の場合（キーが数値の場合は配列に変換）
                const answerArray = [];
                Object.keys(answers).forEach(key => {
                    const answer = answers[key];
                    if (answer && typeof answer === 'object' && answer.D) {
                        answerArray.push(answer);
                    }
                });
                this.answersData = answerArray;
            } else {
                // 単一オブジェクトの場合
                this.answersData = [answers];
            }
            
            console.log('解答データのインポートが完了:', this.answersData.length);
            console.log('解答データの詳細:', this.answersData);
            
            // 解答データの形式をチェック
            const validAnswers = this.answersData.filter(answer => answer.D);
            if (validAnswers.length === 0) {
                this.updateStepStatus(4, 'error', '有効な解答データが見つかりません。Dフィールドが必須です。');
                return;
            }
            
            this.updateStepStatus(4, 'success', `解答データのインポートが完了しました（${validAnswers.length}件）`);
            this.enableStep(5);
            
        } catch (error) {
            console.error('JSON解析エラー:', error);
            this.updateStepStatus(4, 'error', `JSONの解析に失敗しました: ${error.message}`);
        }
    }

    downloadFinalFile() {
        if (!this.workbook || this.answersData.length === 0) {
            this.updateStepStatus(5, 'error', '必要なデータが不足しています');
            return;
        }

        try {
            console.log('最終ファイルの生成を開始...');
            console.log('元のワークブックのシート:', Object.keys(this.workbook.Sheets));
            
            // Ansシートに解答を追加
            this.addAnswersToWorkbook();
            
            // 元のワークブックを直接使用してダウンロード
            // 新しいワークブックを作成せず、元のワークブックをそのまま使用
            XLSX.writeFile(this.workbook, 'スロット.xlsx');
            
            console.log('スロット.xlsxの生成が完了しました');
            this.updateStepStatus(5, 'success', 'スロット.xlsxの生成が完了しました');
            
        } catch (error) {
            console.error('ファイル生成エラー:', error);
            this.updateStepStatus(5, 'error', `ファイルの生成に失敗しました: ${error.message}`);
        }
    }

    addAnswersToWorkbook() {
        const ansSheet = this.workbook.Sheets['Ans'];
        if (!ansSheet) {
            console.error('Ansシートが見つかりません');
            throw new Error('Ansシートが見つかりません');
        }
        
        // 既存のAnsシートのデータを確認（A, B, C列のデータがある行を確認）
        console.log('既存のAnsシートのデータを確認中...');
        let existingRowCount = 0;
        let row = 2;
        while (true) {
            const aValue = this.getCellValue(ansSheet, `A${row}`);
            const bValue = this.getCellValue(ansSheet, `B${row}`);
            const cValue = this.getCellValue(ansSheet, `C${row}`);
            
            if (!aValue || !bValue || !cValue) break;
            existingRowCount++;
            row++;
        }
        console.log(`既存のAnsシートデータ: ${existingRowCount}行`);
        
        // 解答データを既存の行に追加（D, E, F, G列のみ）
        let answerIndex = 0;
        for (let row = 2; row < 2 + existingRowCount && answerIndex < this.answersData.length; row++) {
            const answer = this.answersData[answerIndex];
            if (answer && answer.D) {
                console.log(`行${row}に解答${answerIndex + 1}を追加:`, answer);
                this.setCellValue(ansSheet, `D${row}`, answer.D);
                this.setCellValue(ansSheet, `E${row}`, answer.E || '');
                this.setCellValue(ansSheet, `F${row}`, answer.F || '');
                this.setCellValue(ansSheet, `G${row}`, answer.G || '');
                answerIndex++;
            }
        }
        
        console.log(`解答の追加が完了しました（${answerIndex}件）`);
    }

    findFirstBlankRow(worksheet) {
        let row = 2;
        while (true) {
            const dValue = this.getCellValue(worksheet, `D${row}`);
            const eValue = this.getCellValue(worksheet, `E${row}`);
            const fValue = this.getCellValue(worksheet, `F${row}`);
            const gValue = this.getCellValue(worksheet, `G${row}`);
            
            if ((!dValue || dValue === '') &&
                (!eValue || eValue === '') &&
                (!fValue || fValue === '') &&
                (!gValue || gValue === '')) {
                return row;
            }
            
            row++;
        }
    }

    downloadProblemsTxt() {
        let content = '';
        this.problemsData.forEach(problem => {
            content += `${problem.row_L} ${problem.row_C} ${problem.row_R} ${problem.question}\n`;
        });
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Problems.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    copyPrompt() {
        const prompt = `
        アップロードしたProblems.txtは、問題が羅列されたtxtです。
        あなたには、以下のルールを遵守して、解答して、定められた規則のjson形式で出力して欲しいです。
        具体的には、出力するjsonファイルのl問目の解答が以下のようになるようにしてください:

"id_1": (Problemsの左の番号),
"id_2": (Problemsの真ん中の番号),
"id_3": (Problemsの右の番号),
"D": (解答),
"E": (誤答例1),
"F": (誤答例2),
"G": (誤答例3)

ここに、(解答)はProblemsのl行目の問題の解答です。
なお、変数lは1からsまでの範囲を動きます。ここに、sはProblemsの行数を指します。
これは、コードを書かずに手作業で埋めてください。
なお、解答する際には以下の制約を満たすこと:
1.丁寧に、正確に解答を行ってください。
2.全て、TeXの形式で解答してください。ただし、追加のusepackageを必要とする表現は使わないこと。
3.ベクトルはoverrightarrowで表現してください。
4.displaystyleは絶対に使わないでください。
5.解答の初めに「絶対に」=をつけないでください。
6.三角関数に関連する解答には、sin,cos,tan以外は使わないこと(例えばsecを使いたいときは、1/cosとすること)
7.自然対数はlogで表現し、底を描く必要はない。
9.その他、フォーマットに気をつけて解答を表現し、きれいな解答をすること。
10.leやgeは使わずに、>や<を使ってください。
11. 数式を表示する時は$で挟むことを忘れないでください。
`;

        navigator.clipboard.writeText(prompt).then(() => {
            this.updateStepStatus(4, 'success', 'AIプロンプトをクリップボードにコピーしました');
        }).catch(err => {
            console.error('コピーに失敗しました:', err);
            this.updateStepStatus(4, 'error', 'プロンプトのコピーに失敗しました');
        });
    }

    handleJsonInput(event) {
        const jsonInput = event.target.value.trim();
        const importBtn = document.getElementById('importBtn');
        
        console.log('JSON入力の変更を検出:', jsonInput.length > 0 ? '入力あり' : '入力なし');
        
        if (jsonInput) {
            try {
                const parsed = JSON.parse(jsonInput);
                console.log('JSON解析成功:', parsed);
                importBtn.disabled = false;
                this.updateStepStatus(4, 'info', 'JSONの形式が正しく認識されました');
            } catch (e) {
                console.log('JSON解析エラー:', e.message);
                importBtn.disabled = true;
                this.updateStepStatus(4, 'error', `JSONの形式が正しくありません: ${e.message}`);
            }
        } else {
            importBtn.disabled = true;
            this.updateStepStatus(4, 'info', 'JSONを入力してください');
        }
    }

    // ユーティリティ関数
    getCellValue(worksheet, cellAddress) {
        const cell = worksheet[cellAddress];
        return cell ? cell.v : null;
    }

    setCellValue(worksheet, cellAddress, value) {
        if (!worksheet[cellAddress]) {
            worksheet[cellAddress] = { v: value };
        } else {
            worksheet[cellAddress].v = value;
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    updateStepStatus(stepNumber, type, message) {
        const step = document.getElementById(`step${stepNumber}`);
        const statusDiv = document.getElementById(`step${stepNumber}Status`);
        
        step.classList.remove('active', 'completed');
        
        if (type === 'success') {
            step.classList.add('completed');
        } else if (type === 'info') {
            step.classList.add('active');
        }
        
        statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
    }

    enableStep(stepNumber) {
        const step = document.getElementById(`step${stepNumber}`);
        const button = step.querySelector('button');
        if (button) {
            button.disabled = false;
        }
        step.classList.add('active');
        
        // プログレスバーを更新
        const progress = (stepNumber - 1) * 20;
        document.getElementById('progressFill').style.width = `${progress}%`;
    }
}

// アプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('スロット問題生成ツールを初期化中...');
    new SlotProblemGenerator();
});