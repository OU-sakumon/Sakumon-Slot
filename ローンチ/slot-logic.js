/**
 * 阪大作問サークルスロットのロジック部分
 * 要件に従ったデータ構造で問題パーツの組み合わせと解答判定を担当
 */

class SlotLogic {
    constructor() {
        // 要件に従ったデータ構造
        this.que_L = []; // Que_L シートのデータ: [{type: string, question: string}]
        this.que_C = []; // Que_C シートのデータ: [{type: string, question: string}]
        this.que_R = []; // Que_R シートのデータ: [{type: string, question: string}]
        this.ans = [];   // Ans シートのデータ: [{row_L: number, row_C: number, row_R: number, ans: string, lie_answer1: string, lie_answer2: string, lie_answer3: string}]
        
        // スロット設定
        this.reelCount = 3;
        this.symbolHeight = 83.33; // px
        this.symbolsPerReel = 30; // 連続したリストのため増加
        this.spinSpeed = 20; // ms間隔（より早く）
        this.visibleRows = 3; // 画面に見える行数
        this.currentAnswer = null; // 現在の問題の解答データ
        this.recentQuestions = []; // 最近使用した問題のインデックス（重複回避用）
        this.maxRecentQuestions = 3; // 最近使用した問題の最大保持数
        
        // データ読み込み状態
        this.isDataLoaded = false;
        
        // 初期化時はデータを読み込まない（アップロード後に読み込む）
        console.log('SlotLogic初期化完了 - データのアップロードを待機中');
    }
    
    
    
    /**
     * Excelファイルからデータを読み込み
     * @param {File} file - アップロードされたExcelファイル
     * @returns {Promise<boolean>} 読み込み成功かどうか
     */
    async loadFromExcelFile(file) {
        try {
            console.log('Excelファイルからデータを読み込み中:', file.name);
            
            // ファイルを読み込み
            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            
            // Excelファイルを解析
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            // 各シートのデータを取得
            this.que_L = this.parseSheetData(workbook, 'Que_L');
            this.que_C = this.parseSheetData(workbook, 'Que_C');
            this.que_R = this.parseSheetData(workbook, 'Que_R');
            this.ans = this.parseAnswerSheetData(workbook, 'Ans');
            
            // データの検証
            if (this.que_L.length === 0 || this.que_C.length === 0 || this.que_R.length === 0 || this.ans.length === 0) {
                throw new Error('必要なデータが不足しています');
            }
            
            // データ読み込み完了
            this.isDataLoaded = true;
            console.log('Excelファイルからのデータ読み込み完了');
            console.log(`Que_L: ${this.que_L.length}件, Que_C: ${this.que_C.length}件, Que_R: ${this.que_R.length}件, Ans: ${this.ans.length}件`);
            
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
     * シートデータを解析（Que_L, Que_C, Que_R用）
     * @param {Object} workbook - XLSXワークブック
     * @param {string} sheetName - シート名
     * @returns {Array} 解析されたデータ
     */
    parseSheetData(workbook, sheetName) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            throw new Error(`シート "${sheetName}" が見つかりません`);
        }
        
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const data = [];
        
        // ヘッダー行をスキップしてデータを解析
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.length >= 2 && row[0] && row[1]) {
                data.push({
                    type: String(row[0]).trim(),
                    question: String(row[1]).trim()
                });
            }
        }
        
        return data;
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
     * JSONデータからデータを設定
     * @param {Object} jsonData - アップロードされたJSONデータ
     */
    setDataFromJson(jsonData) {
        try {
            console.log('JSONデータからデータを設定中:', jsonData);
            
            // 各シートのデータを設定
            this.que_L = jsonData.Que_L || [];
            this.que_C = jsonData.Que_C || [];
            this.que_R = jsonData.Que_R || [];
            this.ans = jsonData.Ans || [];
            
            // データの検証
            if (this.que_L.length === 0 || this.que_C.length === 0 || this.que_R.length === 0 || this.ans.length === 0) {
                throw new Error('必要なデータが不足しています');
            }
            
            this.isDataLoaded = true;
            
            console.log('データ設定完了:', {
                Que_L: this.que_L.length,
                Que_C: this.que_C.length,
                Que_R: this.que_R.length,
                Ans: this.ans.length
            });
            
        } catch (error) {
            console.error('JSONデータの設定に失敗しました:', error);
            throw error;
        }
    }
    
    /**
     * データが読み込まれているかチェック
     * @returns {boolean} データ読み込み状態
     */
    isDataReady() {
        return this.isDataLoaded && this.que_L.length > 0 && this.que_C.length > 0 && this.que_R.length > 0 && this.ans.length > 0;
    }
    
    /**
     * Que_L シートのデータを設定
     * @param {Array} newQue_L - 新しいQue_Lデータ
     */
    setQue_L(newQue_L) {
        if (Array.isArray(newQue_L)) {
            this.que_L = newQue_L;
        }
    }
    
    /**
     * Que_C シートのデータを設定
     * @param {Array} newQue_C - 新しいQue_Cデータ
     */
    setQue_C(newQue_C) {
        if (Array.isArray(newQue_C)) {
            this.que_C = newQue_C;
        }
    }
    
    /**
     * Que_R シートのデータを設定
     * @param {Array} newQue_R - 新しいQue_Rデータ
     */
    setQue_R(newQue_R) {
        if (Array.isArray(newQue_R)) {
            this.que_R = newQue_R;
        }
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
     * 現在のQue_Lデータを取得
     * @returns {Array} Que_Lデータ
     */
    getQue_L() {
        return this.que_L;
    }
    
    /**
     * 現在のQue_Cデータを取得
     * @returns {Array} Que_Cデータ
     */
    getQue_C() {
        return this.que_C;
    }
    
    /**
     * 現在のQue_Rデータを取得
     * @returns {Array} Que_Rデータ
     */
    getQue_R() {
        return this.que_R;
    }
    
    /**
     * 現在のAnsデータを取得
     * @returns {Array} Ansデータ
     */
    getAns() {
        return this.ans;
    }
    
    /**
     * ランダムな問題を選択（要件に準拠：Ansシートからランダムに取得）
     * @returns {Object} 選択された問題と解答データ
     */
    selectRandomQuestion() {
        if (!this.isDataReady()) {
            console.error('データが読み込まれていません');
            return null;
        }
        
        // Ansシートからランダムに取得（重複回避機能付き + 空白データ回避）
        let randomIndex;
        let attempts = 0;
        const maxAttempts = 50; // 最大試行回数を増加（空白データ回避のため）
        
        do {
            const randomValue = Math.random();
            randomIndex = Math.floor(randomValue * this.ans.length);
            attempts++;
            
            // 最近使用した問題を避ける
            if (this.recentQuestions.includes(randomIndex)) {
                continue;
            }
            
            const answerData = this.ans[randomIndex];
            
            // D、E、F列（答え、間違い回答1、間違い回答2）のいずれかが空白でないかチェック
            if (!answerData.ans || !answerData.lie_answer1 || !answerData.lie_answer2) {
                // console.log(`空白データをスキップ: インデックス ${randomIndex}`, answerData);
                continue;
            }
            
            // 有効なデータが見つかった場合、ループを抜ける
            break;
            
        } while (attempts < maxAttempts);
        
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
        
        // デバッグ情報を追加
        // console.log(`ランダム選択: インデックス ${randomIndex}/${this.ans.length - 1} (試行回数: ${attempts})`);
        // console.log('最近使用した問題:', this.recentQuestions);
        // console.log('選択された解答データ:', answerData);
        
        // 行番号から各パーツの問題文を取得（1ベースの行番号を0ベースのインデックスに変換）
        const leftPart = this.que_L[answerData.row_L - 2];
        const centerPart = this.que_C[answerData.row_C - 2];
        const rightPart = this.que_R[answerData.row_R - 2];
        
        // データの存在確認
        if (!leftPart || !centerPart || !rightPart) {
            console.error('問題データが見つかりません:', answerData);
            return null;
        }
        
        // console.log('選択された問題パーツ:');
        // console.log('左:', leftPart.question);
        // console.log('中央:', centerPart.question);
        // console.log('右:', rightPart.question);
        
        this.currentAnswer = answerData;
        
        return {
            left: leftPart,
            center: centerPart,
            right: rightPart,
            answer: answerData
        };
    }
    
    /**
     * リール用のシンボル配列を生成（連続したリストで空のスロットを防ぐ）
     * @param {string} reelType - リールの種類（left, center, right）
     * @returns {Array} シンボルの配列
     */
    generateReelSymbols(reelType) {
        let parts;
        if (reelType === 'left') {
            parts = this.que_L;
        } else if (reelType === 'center') {
            parts = this.que_C;
        } else if (reelType === 'right') {
            parts = this.que_R;
        }
        
        const reelSymbols = [];
        // 連続したリストを生成（空のスロットを防ぐため複数回繰り返し）
        const repeatCount = Math.ceil(this.symbolsPerReel / parts.length) + 2; // 余裕を持って2回多く
        for (let repeat = 0; repeat < repeatCount; repeat++) {
            for (let i = 0; i < parts.length; i++) {
                reelSymbols.push(parts[i].question);
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
     * 指定した問題パーツが中央に来る位置を取得
     * @param {string} targetQuestion - 目標問題文
     * @param {string} reelType - リールの種類
     * @returns {number} 位置（見つからない場合はランダム位置）
     */
    getPositionForQuestion(targetQuestion, reelType) {
        let parts;
        if (reelType === 'left') {
            parts = this.que_L;
        } else if (reelType === 'center') {
            parts = this.que_C;
        } else if (reelType === 'right') {
            parts = this.que_R;
        }
        
        const symbolIndex = parts.findIndex(part => part.question === targetQuestion);
        
        if (symbolIndex === -1) {
            console.warn(`問題文が見つかりません: ${targetQuestion}`);
            return this.generateStopPosition();
        }
        
        // 中央に来るようにトップ基準のインデックスへ補正して位置を計算
        // visibleRowsが3の場合、centerOffsetは1（0, 1, 2のうち1が中央）
        const centerOffset = Math.floor(this.visibleRows / 2);
        // 目標のシンボルを中央に配置するため、トップ位置を計算
        // 例: symbolIndex=5, centerOffset=1 の場合、topIndex=4 (0-based)
        let topIndex = symbolIndex - centerOffset;
        if (topIndex < 0) {
            topIndex += parts.length;
        }
        
        // 位置を計算（負の値）
        const position = topIndex * -this.symbolHeight;
        
        // console.log(`問題文→位置変換 (${reelType}): question="${targetQuestion}", symbolIndex=${symbolIndex}, centerOffset=${centerOffset}, topIndex=${topIndex}, position=${position}px, symbolHeight=${this.symbolHeight}px`);
        
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
     * 位置から問題文を取得
     * @param {number} position - リールの位置（通常は負の値）
     * @param {string} reelType - リールの種類
     * @returns {string} 問題文
     */
    getQuestionFromPosition(position, reelType) {
        let parts;
        if (reelType === 'left') {
            parts = this.que_L;
        } else if (reelType === 'center') {
            parts = this.que_C;
        } else if (reelType === 'right') {
            parts = this.que_R;
        }
        
        // リールの位置は通常負の値なので、正の値に変換
        const absPosition = Math.abs(position);
        
        // 現在の最上行のインデックス
        const topIndex = Math.round(absPosition / this.symbolHeight);
        
        // 中央行のオフセットを考慮した確定インデックス
        const centerOffset = Math.floor(this.visibleRows / 2);
        const symbolIndex = (topIndex + centerOffset) % parts.length;
        
        // console.log(`位置→問題文変換 (${reelType}): position=${position}, absPosition=${absPosition}, topIndex=${topIndex}, centerOffset=${centerOffset}, symbolIndex=${symbolIndex}, symbolHeight=${this.symbolHeight}`);
        
        return parts[symbolIndex].question;
    }
    
    /**
     * 現在の問題の完全な問題文を生成
     * @param {Array} questions - 3つの問題文の配列
     * @returns {string} 完全な問題文
     */
    generateFullQuestion(questions) {
        return `${questions[0]} ${questions[1]} ${questions[2]}`;
    }
    
    /**
     * 解答選択肢を生成（要件に準拠：偽回答2個+正解1個）
     * @returns {Array} 選択肢の配列
     */
    generateAnswerChoices() {
        if (!this.currentAnswer) {
            console.error('現在の問題が設定されていません');
            return [];
        }
        
        const choices = [
            this.currentAnswer.ans,
            this.currentAnswer.lie_answer1,
            this.currentAnswer.lie_answer2
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
     * 解答を判定
     * @param {string} selectedAnswer - 選択された解答
     * @returns {Object} 判定結果
     */
    judgeAnswer(selectedAnswer) {
        if (!this.currentAnswer) {
            return {
                isCorrect: false,
                message: "問題が選択されていません",
                correctAnswer: null
            };
        }
        
        const isCorrect = selectedAnswer === this.currentAnswer.ans;
        
        return {
            isCorrect: isCorrect,
            message: isCorrect ? "正解です！" : "不正解です",
            correctAnswer: this.currentAnswer.ans,
            selectedAnswer: selectedAnswer
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
     * デバッグ用：現在の設定を取得
     * @returns {Object} 設定情報
     */
    getDebugInfo() {
        return {
            isDataLoaded: this.isDataLoaded,
            isDataReady: this.isDataReady(),
            que_L: this.que_L,
            que_C: this.que_C,
            que_R: this.que_R,
            ans: this.ans,
            currentAnswer: this.currentAnswer,
            reelCount: this.reelCount,
            symbolHeight: this.symbolHeight,
            symbolsPerReel: this.symbolsPerReel,
            spinSpeed: this.spinSpeed,
            visibleRows: this.visibleRows,
            fullCycleLength: this.getFullCycleLength()
        };
    }
    
}

// グローバルに公開（HTMLから参照するため）
window.SlotLogic = SlotLogic;
