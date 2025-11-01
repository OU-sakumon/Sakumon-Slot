/**
 * 阪大作問サークルスロットのロジック部分
 * 要件に従ったデータ構造で問題パーツの組み合わせと解答判定を担当
 */

class SlotLogic {
    constructor() {
        // 画像ベースのシステム - Excelシートは不要
        this.ans = [];   // Ans シートのデータ: [{row_L: number, row_C: number, row_R: number, ans: string, lie_answer1: string, lie_answer2: string, lie_answer3: string}]
        
        // 画像キャッシュ（Blob URLを保存）
        this.imageCache = new Map(); // key: "Que_L_B/1.png", value: Blob URL
        
        // 画像パスの設定（フォルダ名のみ）
        this.queLeftPath = 'Que_L_B/';
        this.queCenterPath = 'Que_C_B/';
        this.queRightPath = 'Que_R_B/';
        this.ansCorrectPath = 'Ans_D/';
        this.ansWrong1Path = 'Ans_E/';
        this.ansWrong2Path = 'Ans_F/';
        this.ansWrong3Path = 'Ans_G/';
        
        // 利用可能な画像の行番号リスト（Que_L_B、Que_C_B、Que_R_Bから取得）
        this.availableLeftRows = [];
        this.availableCenterRows = [];
        this.availableRightRows = [];
        
        // スロット設定
        this.reelCount = 3;
        this.symbolHeight = 250; // px - 画像サイズに合わせて調整（横2000px × 縦1600px → 250px高さでアスペクト比維持）
        this.symbolsPerReel = 30; // 連続したリストのため増加
        this.spinSpeed = 20; // ms間隔（より早く）
        this.visibleRows = 1; // 画面に見える行数（画像は1つずつ表示）
        this.currentAnswer = null; // 現在の問題の解答データ
        this.recentQuestions = []; // 最近使用した問題のインデックス（重複回避用）
        this.maxRecentQuestions = 3; // 最近使用した問題の最大保持数
        this.timeLimit = 60; // 制限時間（秒）
        
        // データ読み込み状態
        this.isDataLoaded = false;
        
        // 初期化時はデータを読み込まない（アップロード後に読み込む）
    }
    
    
    /**
     * Zipファイルからデータを読み込み（画像とExcelを含む）
     * @param {File} file - アップロードされたZipファイル
     * @returns {Promise<boolean>} 読み込み成功かどうか
     */
    async loadFromZipFile(file) {
        try {
            // Zipファイルを解凍
            const zip = await JSZip.loadAsync(file);
            
            // Excelファイルを検索
            let excelFile = null;
            let excelFileName = null;
            for (const [filename, zipEntry] of Object.entries(zip.files)) {
                if (!zipEntry.dir && (filename.endsWith('.xlsx') || filename.endsWith('.xls'))) {
                    // パスの一番最後の部分（ファイル名）を取得
                    const parts = filename.split('/');
                    const actualFilename = parts[parts.length - 1];
                    if (actualFilename && !actualFilename.startsWith('.') && !actualFilename.startsWith('~')) {
                        excelFile = zipEntry;
                        excelFileName = filename;
                        break;
                    }
                }
            }
            
            if (!excelFile) {
                throw new Error('Zipファイル内にExcelファイルが見つかりません');
            }
            
            // Excelファイルを読み込み
            const excelData = await excelFile.async('arraybuffer');
            const workbook = XLSX.read(excelData, { type: 'array' });
            
            // Ansシートのデータを取得
            this.ans = this.parseAnswerSheetData(workbook, 'Ans');
            
            // Que_L、Que_C、Que_Rシートから利用可能な行番号リストを取得
            this.availableLeftRows = this.parseRowNumbers(workbook, 'Que_L');
            this.availableCenterRows = this.parseRowNumbers(workbook, 'Que_C');
            this.availableRightRows = this.parseRowNumbers(workbook, 'Que_R');
            
            // データの検証
            if (this.ans.length === 0) {
                throw new Error('Ansシートにデータがありません');
            }
            
            if (this.availableLeftRows.length === 0 || this.availableCenterRows.length === 0 || this.availableRightRows.length === 0) {
                throw new Error('Que_L、Que_C、Que_Rシートにデータがありません');
            }
            
            // 画像を読み込み
            await this.loadImagesFromZip(zip);
            
            // 音声ファイルを読み込み
            await this.loadAudioFromZip(zip);
            
            // データ読み込み完了
            this.isDataLoaded = true;
            
            return true;
            
        } catch (error) {
            console.error('Zipファイル読み込みエラー:', error);
            this.isDataLoaded = false;
            throw error;
        }
    }
    
    /**
     * Zipファイルから画像を読み込み
     * @param {JSZip} zip - JSZipオブジェクト
     * @returns {Promise<void>}
     */
    async loadImagesFromZip(zip) {
        const imageFolders = [
            this.queLeftPath,
            this.queCenterPath,
            this.queRightPath,
            this.ansCorrectPath,
            this.ansWrong1Path,
            this.ansWrong2Path,
            this.ansWrong3Path
        ];
        
        let loadedCount = 0;
        
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            // ディレクトリはスキップ
            if (zipEntry.dir) continue;
            
            // .pngファイルのみを処理
            if (!filename.toLowerCase().endsWith('.png')) continue;
            
            // パスを正規化（先頭の/を削除、バックスラッシュをスラッシュに変換）
            let normalizedPath = filename.replace(/\\/g, '/').replace(/^\/+/, '');
            
            // 画像フォルダに含まれるか確認
            let matchedFolder = null;
            for (const folder of imageFolders) {
                // フォルダ名を含むパスを確認
                const folderIndex = normalizedPath.lastIndexOf(folder);
                if (folderIndex !== -1) {
                    // フォルダ以降のパスを取得（例：Que_L_B/1.png）
                    normalizedPath = normalizedPath.substring(folderIndex);
                    matchedFolder = folder;
                    break;
                }
            }
            
            if (!matchedFolder) {
                continue; // 対象フォルダに含まれない画像はスキップ
            }
            
            try {
                // 画像をBlobとして読み込み
                const blob = await zipEntry.async('blob');
                // Blob URLを作成
                const blobUrl = URL.createObjectURL(blob);
                // キャッシュに保存
                this.imageCache.set(normalizedPath, blobUrl);
                loadedCount++;
            } catch (error) {
                console.error(`画像読み込みエラー: ${filename}`, error);
            }
        }
    }
    
    /**
     * Zipファイルから音声ファイルを読み込み
     * @param {JSZip} zip - JSZipオブジェクト
     * @returns {Promise<void>}
     */
    async loadAudioFromZip(zip) {
        // 音声ファイルの検索（大文字小文字を区別しない）
        const audioFiles = {
            slotStop: null,
            answerCorrect: null,
            answerMiss: null
        };
        
        // デバッグ用：zip内の全ファイル名をログ出力
        console.log('=== Zipファイル内の全ファイル一覧 ===');
        const allFiles = [];
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            if (!zipEntry.dir) {
                allFiles.push(filename);
                console.log(`  - ${filename}`);
            }
        }
        console.log(`合計 ${allFiles.length} ファイル`);
        
        // mp3ファイルを全て検索
        console.log('=== MP3ファイル検索中 ===');
        const mp3Files = [];
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            // ディレクトリはスキップ
            if (zipEntry.dir) continue;
            
            const lowerFilename = filename.toLowerCase();
            
            // mp3ファイルを全て収集
            if (lowerFilename.endsWith('.mp3')) {
                mp3Files.push(filename);
                console.log(`MP3ファイル発見: ${filename}`);
            }
        }
        
        // 各音声ファイルを検索（より柔軟な検索条件）
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
            // ディレクトリはスキップ
            if (zipEntry.dir) continue;
            
            const lowerFilename = filename.toLowerCase();
            // パスを正規化（先頭の/を削除、バックスラッシュをスラッシュに変換）
            const normalizedPath = lowerFilename.replace(/\\/g, '/').replace(/^\/+/, '');
            // ファイル名のみを取得（パスから最後の部分を抽出）
            const pathParts = normalizedPath.split('/');
            const fileName = pathParts[pathParts.length - 1];
            
            // slot_stop.mp3 の検索（より柔軟）
            if (!audioFiles.slotStop) {
                if (fileName.includes('slot') && fileName.includes('stop') && fileName.endsWith('.mp3')) {
                    audioFiles.slotStop = zipEntry;
                    console.log(`✓ slot_stop.mp3を発見: ${filename}`);
                }
            }
            
            // answer_correct.mp3 の検索（より柔軟）
            if (!audioFiles.answerCorrect) {
                if (fileName.includes('answer') && fileName.includes('correct') && fileName.endsWith('.mp3')) {
                    audioFiles.answerCorrect = zipEntry;
                    console.log(`✓ answer_correct.mp3を発見: ${filename}`);
                }
            }
            
            // answer_miss.mp3 の検索（より柔軟）
            if (!audioFiles.answerMiss) {
                if (fileName.includes('answer') && fileName.includes('miss') && fileName.endsWith('.mp3')) {
                    audioFiles.answerMiss = zipEntry;
                    console.log(`✓ answer_miss.mp3を発見: ${filename}`);
                }
            }
        }
        
        console.log('=== 検索結果 ===');
        console.log(`slotStop: ${audioFiles.slotStop ? '見つかりました' : '見つかりませんでした'}`);
        console.log(`answerCorrect: ${audioFiles.answerCorrect ? '見つかりました' : '見つかりませんでした'}`);
        console.log(`answerMiss: ${audioFiles.answerMiss ? '見つかりました' : '見つかりませんでした'}`);
        
        // 各音声ファイルを読み込み
        for (const [audioType, zipEntry] of Object.entries(audioFiles)) {
            if (zipEntry) {
                try {
                    // 音声ファイルをBlobとして読み込み
                    const blob = await zipEntry.async('blob');
                    // Blob URLを作成
                    const blobUrl = URL.createObjectURL(blob);
                    
                    // グローバルに保存（SlotAudioクラスで使用）
                    if (audioType === 'slotStop') {
                        window.slotStopAudioUrl = blobUrl;
                        console.log(`✓ slot_stop.mp3を読み込みました: ${blobUrl}`);
                    } else if (audioType === 'answerCorrect') {
                        window.answerCorrectAudioUrl = blobUrl;
                        console.log(`✓ answer_correct.mp3を読み込みました: ${blobUrl}`);
                    } else if (audioType === 'answerMiss') {
                        window.answerMissAudioUrl = blobUrl;
                        console.log(`✓ answer_miss.mp3を読み込みました: ${blobUrl}`);
                    }
                } catch (error) {
                    console.error(`✗ ${audioType}の読み込みエラー:`, error);
                }
            } else {
                console.log(`✗ ${audioType}が見つかりませんでした`);
            }
        }
        
        // zipから読み込んだ音声をSlotAudioに反映（既に初期化済みの場合）
        if (window.slotUI && window.slotUI.audio) {
            console.log('=== SlotAudioに音声を反映中 ===');
            window.slotUI.audio.reloadAudioFromZip();
        } else {
            console.warn('SlotAudioが初期化されていません。音声の反映をスキップします。');
        }
    }
    
    /**
     * Excelファイルからデータを読み込み（画像ベース）
     * @param {File} file - アップロードされたExcelファイル
     * @returns {Promise<boolean>} 読み込み成功かどうか
     */
    async loadFromExcelFile(file) {
        try {
            // ファイルを読み込み
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            
            // Excelファイルを解析
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            // Ansシートのデータを取得
            this.ans = this.parseAnswerSheetData(workbook, 'Ans');
            
            // Que_L、Que_C、Que_Rシートから利用可能な行番号リストを取得
            this.availableLeftRows = this.parseRowNumbers(workbook, 'Que_L');
            this.availableCenterRows = this.parseRowNumbers(workbook, 'Que_C');
            this.availableRightRows = this.parseRowNumbers(workbook, 'Que_R');
            
            // データの検証
            if (this.ans.length === 0) {
                throw new Error('Ansシートにデータがありません');
            }
            
            if (this.availableLeftRows.length === 0 || this.availableCenterRows.length === 0 || this.availableRightRows.length === 0) {
                throw new Error('Que_L、Que_C、Que_Rシートにデータがありません');
            }
            
            // データ読み込み完了
            this.isDataLoaded = true;
            
            return true;
            
        } catch (error) {
            console.error('Excelファイル読み込みエラー:', error);
            this.isDataLoaded = false;
            throw error;
        }
    }
    
    /**
     * ファイルをArrayBufferとして読み込み
     * @param {File} file - 読み込むファイル
     * @returns {Promise<ArrayBuffer>} ArrayBuffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * 画像パスからBlob URLを取得
     * @param {string} imagePath - 画像パス（例：Que_L_B/1.png）
     * @returns {string} Blob URL
     */
    getImageUrl(imagePath) {
        // キャッシュにある場合はBlob URLを返す
        if (this.imageCache.has(imagePath)) {
            return this.imageCache.get(imagePath);
        }
        
        // キャッシュにない場合は、プレースホルダーまたはエラーを返す
        console.warn(`画像が見つかりません: ${imagePath}`);
        return ''; // 空の文字列を返す（画像が表示されない）
    }
    
    /**
     * シートから利用可能な行番号リストを取得（Que_L, Que_C, Que_R用）
     * @param {Object} workbook - XLSXワークブック
     * @param {string} sheetName - シート名
     * @returns {Array} 行番号のリスト
     */
    parseRowNumbers(workbook, sheetName) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            throw new Error(`シート "${sheetName}" が見つかりません`);
        }
        
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const rowNumbers = [];
        
        // ヘッダー行をスキップして行番号を取得（Excelの行番号は2から開始）
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.length >= 1) {
                // Excelの行番号（2から始まる）
                const excelRowNumber = i + 1;
                rowNumbers.push(excelRowNumber);
            }
        }
        
        return rowNumbers;
    }
    
    /**
     * 解答シートデータを解析（Ans用）
     * @param {Object} workbook - XLSXワークブック
     * @param {string} sheetName - シート名
     * @returns {Array} 解析されたデータ
     */
    parseAnswerSheetData(workbook, sheetName) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            throw new Error(`シート "${sheetName}" が見つかりません`);
        }
        
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const data = [];
        
        // ヘッダー行をスキップしてデータを解析
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.length >= 7) {
                data.push({
                    row_L: parseInt(row[0]) || 0,
                    row_C: parseInt(row[1]) || 0,
                    row_R: parseInt(row[2]) || 0,
                    ans: String(row[3] || '').trim(),
                    lie_answer1: String(row[4] || '').trim(),
                    lie_answer2: String(row[5] || '').trim(),
                    lie_answer3: String(row[6] || '').trim()
                });
            }
        }
        
        return data;
    }

    /**
     * JSONデータからデータを設定（画像ベース）
     * @param {Object} jsonData - アップロードされたJSONデータ
     */
    setDataFromJson(jsonData) {
        try {
            // Ansシートのデータを設定
            this.ans = jsonData.Ans || [];
            
            // 利用可能な行番号リストを設定
            this.availableLeftRows = jsonData.availableLeftRows || [];
            this.availableCenterRows = jsonData.availableCenterRows || [];
            this.availableRightRows = jsonData.availableRightRows || [];
            
            // データの検証
            if (this.ans.length === 0) {
                throw new Error('Ansシートにデータがありません');
            }
            
            if (this.availableLeftRows.length === 0 || this.availableCenterRows.length === 0 || this.availableRightRows.length === 0) {
                throw new Error('利用可能な行番号リストが不足しています');
            }
            
            this.isDataLoaded = true;
            
        } catch (error) {
            console.error('JSONデータの設定に失敗しました:', error);
            throw error;
        }
    }
    
    /**
     * データが読み込まれているかチェック（画像ベース）
     * @returns {boolean} データ読み込み状態
     */
    isDataReady() {
        return this.isDataLoaded && 
               this.ans.length > 0 && 
               this.availableLeftRows.length > 0 && 
               this.availableCenterRows.length > 0 && 
               this.availableRightRows.length > 0;
    }
    
    /**
     * Ans シートのデータを設定
     * @param {Array} newAns - 新しいAnsデータ
     */
    setAns(newAns) {
        if (Array.isArray(newAns)) {
            this.ans = newAns;
        }
    }
    
    /**
     * 現在のAnsデータを取得
     * @returns {Array} Ansデータ
     */
    getAns() {
        return this.ans;
    }
    
    /**
     * ランダムな問題を選択（画像ベース）
     * @returns {Object} 選択された問題と解答データ（画像パス）
     */
    selectRandomQuestion() {
        if (!this.isDataReady()) {
            console.error('データが読み込まれていません');
            return null;
        }
        
        // Ansシートからランダムに取得（重複回避機能付き + 空白データ回避）
        let randomIndex;
        let attempts = 0;
        const maxAttempts = 50; // 最大試行回数
        let foundValidData = false;
        
        while (attempts < maxAttempts && !foundValidData) {
            const randomValue = Math.random();
            randomIndex = Math.floor(randomValue * this.ans.length);
            attempts++;
            
            // 最近使用した問題を避ける
            if (this.recentQuestions.includes(randomIndex)) {
                continue;
            }
            
            const answerData = this.ans[randomIndex];
            
            // データの存在確認（行番号があるかチェック）
            if (!answerData.row_L || !answerData.row_C || !answerData.row_R) {
                continue;
            }
            
            // D、E、F列（正解と不正解の選択肢）の空白チェック
            // D列: 正解 (ans)
            // E列: 不正解1 (lie_answer1) 
            // F列: 不正解2 (lie_answer2)
            if (!answerData.ans || !answerData.lie_answer1 || !answerData.lie_answer2) {
                continue;
            }
            
            // 文字列の場合、空白文字のみの場合は除外
            if (typeof answerData.ans === 'string' && answerData.ans.trim() === '') {
                continue;
            }
            if (typeof answerData.lie_answer1 === 'string' && answerData.lie_answer1.trim() === '') {
                continue;
            }
            if (typeof answerData.lie_answer2 === 'string' && answerData.lie_answer2.trim() === '') {
                continue;
            }
            
            // 有効なデータが見つかった場合、ループを抜ける
            foundValidData = true;
        }
        
        // 最大試行回数に達した場合のエラーハンドリング
        if (attempts >= maxAttempts) {
            console.error('有効な問題データが見つかりませんでした');
            return null;
        }
        
        // 最近使用した問題リストを更新
        this.recentQuestions.push(randomIndex);
        if (this.recentQuestions.length > this.maxRecentQuestions) {
            this.recentQuestions.shift(); // 古い問題を削除
        }
        
        const answerData = this.ans[randomIndex];
        const ansRowNumber = randomIndex + 2; // Excelの行番号（ヘッダー行を考慮して+2）
        
        // 画像パスを生成してBlob URLを取得
        const leftImagePath = `${this.queLeftPath}${answerData.row_L}.png`;
        const centerImagePath = `${this.queCenterPath}${answerData.row_C}.png`;
        const rightImagePath = `${this.queRightPath}${answerData.row_R}.png`;
        
        const leftImageUrl = this.getImageUrl(leftImagePath);
        const centerImageUrl = this.getImageUrl(centerImagePath);
        const rightImageUrl = this.getImageUrl(rightImagePath);
        
        this.currentAnswer = answerData;
        this.currentAnsRowNumber = ansRowNumber; // 現在のAns行番号を記録
        
        return {
            left: { imagePath: leftImagePath, imageUrl: leftImageUrl, rowNumber: answerData.row_L },
            center: { imagePath: centerImagePath, imageUrl: centerImageUrl, rowNumber: answerData.row_C },
            right: { imagePath: rightImagePath, imageUrl: rightImageUrl, rowNumber: answerData.row_R },
            answer: answerData,
            ansRowNumber: ansRowNumber
        };
    }
    
    /**
     * リール用の画像パス配列を生成（画像ベース）
     * @param {string} reelType - リールの種類（left, center, right）
     * @returns {Array} 画像パスとBlob URLの配列
     */
    generateReelSymbols(reelType) {
        let rowNumbers;
        let folderPath;
        
        if (reelType === 'left') {
            rowNumbers = this.availableLeftRows;
            folderPath = this.queLeftPath;
        } else if (reelType === 'center') {
            rowNumbers = this.availableCenterRows;
            folderPath = this.queCenterPath;
        } else if (reelType === 'right') {
            rowNumbers = this.availableRightRows;
            folderPath = this.queRightPath;
        }
        
        const reelSymbols = [];
        // 連続したリストを生成（空のスロットを防ぐため複数回繰り返し）
        const repeatCount = Math.ceil(this.symbolsPerReel / rowNumbers.length) + 2; // 余裕を持って2回多く
        for (let repeat = 0; repeat < repeatCount; repeat++) {
            for (let i = 0; i < rowNumbers.length; i++) {
                const rowNumber = rowNumbers[i];
                const imagePath = `${folderPath}${rowNumber}.png`;
                const imageUrl = this.getImageUrl(imagePath);
                reelSymbols.push({
                    imagePath: imagePath,
                    imageUrl: imageUrl,
                    rowNumber: rowNumber
                });
            }
        }
        
        return reelSymbols;
    }
    
    /**
     * 全リール分のシンボル配列を生成
     * @returns {Object} 各リールのシンボル配列
     */
    generateAllReelSymbols() {
        return {
            left: this.generateReelSymbols('left'),
            center: this.generateReelSymbols('center'),
            right: this.generateReelSymbols('right')
        };
    }
    
    /**
     * 指定した行番号が中央に来る位置を取得（画像ベース）
     * @param {number} targetRowNumber - 目標行番号
     * @param {string} reelType - リールの種類
     * @returns {number} 位置（見つからない場合はランダム位置）
     */
    getPositionForQuestion(targetRowNumber, reelType) {
        let rowNumbers;
        if (reelType === 'left') {
            rowNumbers = this.availableLeftRows;
        } else if (reelType === 'center') {
            rowNumbers = this.availableCenterRows;
        } else if (reelType === 'right') {
            rowNumbers = this.availableRightRows;
        }
        
        const symbolIndex = rowNumbers.findIndex(rowNum => rowNum === targetRowNumber);
        
        if (symbolIndex === -1) {
            console.warn(`行番号が見つかりません: ${targetRowNumber}`);
            return this.generateStopPosition();
        }
        
        // 中央に来るようにトップ基準のインデックスへ補正して位置を計算
        // visibleRowsが1の場合、centerOffsetは0（画像は1つずつ表示）
        const centerOffset = Math.floor(this.visibleRows / 2);
        // 目標のシンボルを中央に配置するため、トップ位置を計算
        let topIndex = symbolIndex - centerOffset;
        if (topIndex < 0) {
            topIndex += rowNumbers.length;
        }
        
        // 位置を計算（負の値）
        const position = topIndex * -this.symbolHeight;
        
        return position;
    }
    
    /**
     * ランダムな停止位置を生成
     * @returns {number} 停止位置
     */
    generateStopPosition() {
        const randomIndex = Math.floor(Math.random() * 10); // 10個のパーツから選択
        return randomIndex * -this.symbolHeight;
    }
    
    /**
     * 位置から行番号を取得（画像ベース）
     * @param {number} position - リールの位置（通常は負の値）
     * @param {string} reelType - リールの種類
     * @returns {number} 行番号
     */
    getQuestionFromPosition(position, reelType) {
        let rowNumbers;
        if (reelType === 'left') {
            rowNumbers = this.availableLeftRows;
        } else if (reelType === 'center') {
            rowNumbers = this.availableCenterRows;
        } else if (reelType === 'right') {
            rowNumbers = this.availableRightRows;
        }
        
        // リールの位置は通常負の値なので、正の値に変換
        const absPosition = Math.abs(position);
        
        // 現在の最上行のインデックス
        const topIndex = Math.round(absPosition / this.symbolHeight);
        
        // 中央行のオフセットを考慮した確定インデックス
        const centerOffset = Math.floor(this.visibleRows / 2);
        const symbolIndex = (topIndex + centerOffset) % rowNumbers.length;
        
        const rowNumber = rowNumbers[symbolIndex];
        
        return rowNumber;
    }
    
    /**
     * 解答選択肢を生成（画像ベース）
     * @returns {Array} 選択肢の画像パスとBlob URL、正解フラグの配列
     */
    generateAnswerChoices() {
        if (!this.currentAnswer || !this.currentAnsRowNumber) {
            console.error('現在の問題が設定されていません');
            return [];
        }
        
        // 画像パスを生成してBlob URLを取得
        const correctPath = `${this.ansCorrectPath}${this.currentAnsRowNumber}.png`;
        const wrong1Path = `${this.ansWrong1Path}${this.currentAnsRowNumber}.png`;
        const wrong2Path = `${this.ansWrong2Path}${this.currentAnsRowNumber}.png`;
        
        const choices = [
            {
                imagePath: correctPath,
                imageUrl: this.getImageUrl(correctPath),
                isCorrect: true
            },
            {
                imagePath: wrong1Path,
                imageUrl: this.getImageUrl(wrong1Path),
                isCorrect: false
            },
            {
                imagePath: wrong2Path,
                imageUrl: this.getImageUrl(wrong2Path),
                isCorrect: false
            }
        ];
        
        // 選択肢をシャッフル
        return this.shuffleArray(choices);
    }
    
    /**
     * 配列をシャッフル
     * @param {Array} array - シャッフルする配列
     * @returns {Array} シャッフルされた配列
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    /**
     * 解答を判定（画像ベース）
     * @param {string} selectedImagePath - 選択された解答の画像パス
     * @returns {Object} 判定結果
     */
    judgeAnswer(selectedImagePath) {
        if (!this.currentAnswer || !this.currentAnsRowNumber) {
            return {
                isCorrect: false,
                message: "問題が選択されていません",
                correctImagePath: null,
                correctImageUrl: null
            };
        }
        
        // 正解の画像パスを生成
        const correctImagePath = `${this.ansCorrectPath}${this.currentAnsRowNumber}.png`;
        const correctImageUrl = this.getImageUrl(correctImagePath);
        
        // 画像パスで判定
        const isCorrect = selectedImagePath === correctImagePath;
        
        return {
            isCorrect: isCorrect,
            message: isCorrect ? "正解です！" : "不正解です",
            correctImagePath: correctImagePath,
            correctImageUrl: correctImageUrl,
            selectedImagePath: selectedImagePath
        };
    }
    
    /**
     * スピン間隔を取得
     * @returns {number} ミリ秒
     */
    getSpinInterval() {
        return this.spinSpeed;
    }
    
    /**
     * リールの完全なサイクル長を取得
     * @returns {number} ピクセル
     */
    getFullCycleLength() {
        return this.symbolHeight * this.symbolsPerReel;
    }
    
    /**
     * 停止アニメーションの減速係数を取得
     * @returns {number} 減速係数
     */
    getDecelerationFactor() {
        return 0.05; // より滑らかな減速
    }
    
    /**
     * 停止判定の閾値を取得
     * @returns {number} ピクセル
     */
    getStopThreshold() {
        return 2; // より精密な停止判定
    }
    
    /**
     * 制限時間を取得
     * @returns {number} 制限時間（秒）
     */
    getTimeLimit() {
        return this.timeLimit;
    }
    
    /**
     * デバッグ用：現在の設定を取得（画像ベース）
     * @returns {Object} 設定情報
     */
    getDebugInfo() {
        return {
            isDataLoaded: this.isDataLoaded,
            isDataReady: this.isDataReady(),
            availableLeftRows: this.availableLeftRows,
            availableCenterRows: this.availableCenterRows,
            availableRightRows: this.availableRightRows,
            ans: this.ans,
            currentAnswer: this.currentAnswer,
            currentAnsRowNumber: this.currentAnsRowNumber,
            imageBasePath: this.imageBasePath,
            reelCount: this.reelCount,
            symbolHeight: this.symbolHeight,
            symbolsPerReel: this.symbolsPerReel,
            spinSpeed: this.spinSpeed,
            visibleRows: this.visibleRows,
            fullCycleLength: this.getFullCycleLength(),
            timeLimit: this.timeLimit
        };
    }
    
}

// グローバルに公開（HTMLから参照するため）
window.SlotLogic = SlotLogic;
