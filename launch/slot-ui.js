/**
 * 動画管理クラス
 * ランキング入り動画の確実な再生・停止を管理
 */
class VideoManager {
    constructor() {
        this.activeVideos = new Set();
        this.isPlaying = false; // 動画再生中かどうかのフラグ
        this.hasPlayedOnce = false; // 1回再生したかどうかのフラグ
        this.videoElements = {
            background: {
                container: document.getElementById('rankingVideoBackground'),
                video: document.getElementById('rankingVideo')
            },
            overlay: {
                container: document.getElementById('rankingOverlayVideo'),
                video: document.getElementById('rankingOverlayVideoElement')
            },
            topOverlay: {
                container: document.getElementById('topRankingOverlayVideo'),
                video: document.getElementById('topRankingOverlayVideoElement')
            }
        };
        
        this.initializeVideos();
    }
    
    /**
     * 動画要素の初期化
     */
    initializeVideos() {
        Object.values(this.videoElements).forEach(videoData => {
            if (videoData.video) {
                videoData.video.loop = false; // ループ再生を無効化
                videoData.video.muted = false;
                videoData.video.preload = 'auto';
                
                // 動画終了時のイベントリスナーを追加
                videoData.video.addEventListener('ended', () => {
                    console.log('動画が終了しました');
                    this.hideVideo(videoData);
                    // 全ての動画が終了したら再生フラグをリセット
                    this.checkAllVideosEnded();
                });
                
                videoData.video.addEventListener('error', (e) => {
                    console.warn('動画の再生エラー:', e);
                    this.isPlaying = false; // エラー時は即座にフラグをリセット
                    this.hideVideo(videoData);
                });
            }
        });
    }
    
    /**
     * 全ての動画が終了したかチェック
     */
    checkAllVideosEnded() {
        // 全ての動画が非表示かチェック
        const allHidden = Object.values(this.videoElements).every(videoData => {
            return !videoData.container || videoData.container.style.display === 'none';
        });
        
        if (allHidden) {
            this.isPlaying = false;
            console.log('全ての動画が終了し、再生フラグをリセットしました');
        }
    }
    
    /**
     * 再生フラグをリセット
     */
    resetPlayedFlag() {
        this.hasPlayedOnce = false;
        this.isPlaying = false;
        console.log('動画再生フラグをリセットしました');
    }
    
    /**
     * 全ての動画を停止・非表示
     */
    stopAllVideos() {
        Object.values(this.videoElements).forEach(videoData => {
            this.hideVideo(videoData);
        });
        this.activeVideos.clear();
        this.isPlaying = false; // 再生フラグをリセット
        console.log('全ての動画を停止しました');
    }
    
    /**
     * 背景動画を再生
     */
    playBackgroundVideo() {
        // すでに再生中の場合は何もしない
        if (this.isPlaying || this.hasPlayedOnce) {
            console.log('動画は既に再生済み、またはスキップされました');
            return;
        }
        
        this.stopAllVideos();
        this.isPlaying = true; // 再生開始フラグを立てる
        
        const videoData = this.videoElements.background;
        if (videoData.container && videoData.video) {
            this.showVideo(videoData);
            this.activeVideos.add('background');
        }
    }
    
    /**
     * オーバーレイ動画を再生
     */
    playOverlayVideo() {
        // 背景動画が再生されていない場合は何もしない
        if (!this.isPlaying) {
            console.log('背景動画が再生されていないため、オーバーレイ動画をスキップ');
            return;
        }
        
        const videoData = this.videoElements.overlay;
        if (videoData.container && videoData.video) {
            this.showVideo(videoData);
            this.activeVideos.add('overlay');
        }
    }
    
    /**
     * 一位オーバーレイ動画を再生
     */
    playTopOverlayVideo() {
        // 背景動画が再生されていない場合は何もしない
        if (!this.isPlaying) {
            console.log('背景動画が再生されていないため、トップオーバーレイ動画をスキップ');
            return;
        }
        
        const videoData = this.videoElements.topOverlay;
        if (videoData.container && videoData.video) {
            this.showVideo(videoData);
            this.activeVideos.add('topOverlay');
        }
    }
    
    /**
     * 動画を表示・再生
     */
    showVideo(videoData) {
        if (!videoData.container || !videoData.video) return;
        
        // 動画を最初から開始
        videoData.video.currentTime = 0;
        
        // コンテナを表示
        videoData.container.style.display = 'block';
        
        // 動画を再生
        const playPromise = videoData.video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('動画の再生を開始しました');
                this.hasPlayedOnce = true; // 再生完了フラグを立てる
            }).catch(error => {
                console.warn('動画の再生に失敗しました:', error);
                this.isPlaying = false; // エラー時はフラグをリセット
                this.hideVideo(videoData);
            });
        }
    }
    
    /**
     * 動画を非表示・停止
     */
    hideVideo(videoData) {
        if (!videoData.container || !videoData.video) return;
        
        // 動画を停止
        videoData.video.pause();
        videoData.video.currentTime = 0;
        
        // コンテナを非表示
        videoData.container.style.display = 'none';
        
        console.log('動画を非表示にしました');
    }
}

/**
 * 阪大作問サークルスロットのUI制御部分
 * 表示とユーザーインタラクションを担当
 */

class SlotUI {
    constructor() {
        // グローバルのスロットロジックを使用
        this.logic = window.slotLogic;
        this.audio = new window.SlotAudio();
        this.ranking = new window.SlotRanking();
        
        // 動画管理
        this.videoManager = new VideoManager();
        
        // DOM要素の取得
        this.reels = [
            document.getElementById('reel1'),
            document.getElementById('reel2'),
            document.getElementById('reel3')
        ];
        
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.scoreDisplay = document.getElementById('scoreDisplay');
        // resultDisplayは削除済み
        // this.questionDisplay = document.getElementById('questionDisplay'); // 削除済み
        this.answerChoices = document.getElementById('answerChoices');
        this.timeBonusDisplay = document.getElementById('timeBonusDisplay');
        // this.timeRemaining = document.getElementById('timeRemaining'); // 削除済み
        // this.totalQuestions = document.getElementById('totalQuestions'); // 削除済み
        // this.consecutiveCorrect = document.getElementById('consecutiveCorrect'); // 削除済み
        
        
        // 状態管理
        this.isSpinning = [false, false, false];
        this.spinIntervals = [null, null, null];
        this.finalPositions = [0, 0, 0];
        this.currentQuestions = [null, null, null]; // 現在の問題文状態
        this.currentQuestionData = null; // 現在の問題データ
		this.reelStopCompleted = [false, false, false]; // 減速完了フラグ
		this.hasFinalizedQuestion = false; // finalizeQuestionの一度きり実行制御
        this.score = { totalQuestions: 0, consecutiveCorrect: 0, correctAnswers: 0, maxConsecutive: 0 };
        this.gameTimer = null;
        this.timeLeft = 120; // 120秒
        this.gameStarted = false;
        
        // ランクイン音再生フラグ（1回のみ再生のため）
        this.hasPlayedRankinGako = false;
        
        // 初期化はデータが読み込まれた後に実行
    }
    
    /**
     * データが読み込まれた後に初期化
     */
    initialize() {
        // データの初期化
        this.initializeData();
        
        // ロジック層からシンボルを動的生成（データ初期化後に実行）
        this.syncGeometry();
        this.initializeEventListeners();
    }
    
    /**
     * データの初期化
     */
    async initializeData() {
        try {
            // データが読み込まれているかチェック
            if (!this.logic.isDataReady()) {
                console.error('データが読み込まれていません');
                alert('データが読み込まれていません。まずExcelファイルをアップロードしてください。');
                return;
            }
            
            // リールを初期化
            this.initializeReels();
        } catch (error) {
            console.error('データ初期化エラー:', error);
            alert('データの初期化に失敗しました: ' + error.message);
        }
    }
    
    /**
     * エラーメッセージを表示
     */
    showError(message) {
        alert(message);
        console.error(message);
    }

    
    
    /**
     * リールの初期化（ロジック層からシンボルを取得）
     */
    initializeReels() {
        const reelTypes = ['left', 'center', 'right'];
        this.reels.forEach((reel, reelIndex) => {
            this.updateReel(reelIndex, reelTypes[reelIndex]);
        });
        
        // リール初期化後に幾何情報を同期
        setTimeout(() => {
            this.syncGeometry();
        }, 100);
    }
    
    /**
     * 指定されたリールを更新（画像ベース）
     * @param {number} reelIndex - リールのインデックス
     * @param {string} reelType - リールの種類
     */
    updateReel(reelIndex, reelType) {
        const reel = this.reels[reelIndex];
        
        // 既存のシンボルをクリア
        reel.innerHTML = '';
        
        // ロジック層から現在のシンボル配列を取得して動的生成（画像URL）
        const reelSymbols = this.logic.generateReelSymbols(reelType);
        reelSymbols.forEach(symbolData => {
            const symbolElement = document.createElement('div');
            symbolElement.className = 'slot-symbol';
            symbolElement.dataset.rowNumber = symbolData.rowNumber; // 行番号をdata属性に保存
            
            // 画像要素を作成
            const img = document.createElement('img');
            img.src = symbolData.imageUrl; // Blob URLを使用
            img.alt = `Row ${symbolData.rowNumber}`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            
            symbolElement.appendChild(img);
            reel.appendChild(symbolElement);
        });
    }
    
    /**
     * 全リールを更新（シンボル変更時に使用）
     */
    updateAllReels() {
        const reelTypes = ['left', 'center', 'right'];
        this.reels.forEach((reel, reelIndex) => {
            this.updateReel(reelIndex, reelTypes[reelIndex]);
        });
        
        // 全てのリール更新後に幾何情報を同期
        setTimeout(() => {
            this.syncGeometry();
        }, 100);
    }
    
    /**
     * イベントリスナーの初期化
     */
    initializeEventListeners() {
        this.startButton.addEventListener('click', () => {
            this.startGame();
        });
        this.stopButton.addEventListener('click', () => {
            this.audio.playButtonPushedSound();
            this.stopGame();
        });
        
        // キーボードショートカット
        document.addEventListener('keydown', (event) => {
            // 結果表示時のESCキーでメニューに戻る
            if (event.key === 'Escape' && this.isResultPopupVisible()) {
                this.returnToMenu();
            }
            // ゲーム中のESCキーでゲーム中断
            else if (event.key === 'Escape' && this.gameStarted) {
                this.stopGame();
            }
            
            // プレイ中でない時のEnterキーでスタート
            if (event.key === 'Enter' && !this.gameStarted) {
                this.startGame();
            }
            
            // 結果表示時のEnterキーで再プレイ
            if (event.key === 'Enter' && this.isResultPopupVisible()) {
                this.restartGame();
            }
            
            // 選択肢表示時の1,2,3キーで選択
            if (this.answerChoices.style.visibility === 'visible' && 
                (event.key === '1' || event.key === '2' || event.key === '3')) {
                const choiceIndex = parseInt(event.key) - 1;
                const choiceButtons = this.answerChoices.querySelectorAll('.answer-choice');
                if (choiceButtons[choiceIndex]) {
                    choiceButtons[choiceIndex].click();
                }
            }
        });
    }
    
    /**
     * ゲーム開始
     */
    async startGame() {
        if (this.gameStarted) return;
        
        // データが読み込まれているかチェック
        if (!this.logic.isDataReady()) {
            console.error('データが読み込まれていません。ゲームを開始できません。');
            alert('データが読み込まれていません。ページを再読み込みしてください。');
            return;
        }
        
        // ゲーム開始前に幾何情報を再同期
        this.syncGeometry();
        
        // 既存のタイマーをクリア（重複実行を防ぐ）
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
            console.log('既存のタイマーをクリアしました');
        }
        
        this.gameStarted = true;
        
        // 音響システムを有効化（ユーザーインタラクション必須）
        await this.audio.enableAudio();
        
        // ゲーム状態をリセット
        this.score = { totalQuestions: 0, consecutiveCorrect: 0, correctAnswers: 0, maxConsecutive: 0 };
        this.timeLeft = 120;
        this.hasPlayedRankinGako = false; // ランクイン音再生フラグをリセット
        
        
        // 選択肢の枠を表示（中身は全停止まで非表示）
        this.initializeAnswerChoices();
        
        // スタートボタンを無効化、中断ボタンとスコア表示を表示
        this.startButton.disabled = true;
        this.startButton.style.display = 'none';
        this.stopButton.style.display = 'inline-block';
        this.scoreDisplay.style.display = 'block';
        this.updateScoreDisplay();
        
        
        // カウントダウンタイマー開始
        this.startCountdown();
        
        // 最初の問題を開始
        this.startNextQuestion();
    }
    
    /**
     * カウントダウンタイマー開始
     */
    startCountdown() {
        // 既存のタイマーをクリア（重複実行を防ぐ）
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
            console.log('startCountdown: 既存のタイマーをクリアしました');
        }
        
        console.log('startCountdown: 新しいタイマーを開始します');
        this.gameTimer = setInterval(() => {
            this.timeLeft--;
            
            // スコア表示を更新
            this.updateScoreDisplay();
            
            // 残り10秒以下でハート音のリピート再生を開始
            if (this.timeLeft <= 10 && this.timeLeft > 0) {
                // ハート音のリピート再生を開始
                this.audio.startHeartMovingSound();
            } else {
                // ハート音のリピート再生を停止
                this.audio.stopHeartMovingSound();
            }
            
            if (this.timeLeft <= 0) {
                this.endGame();
            }
        }, 1000);
    }
    
    
    /**
     * ゲーム中断
     */
    stopGame() {
        if (!this.gameStarted) return;
        
        // 確認ダイアログ
        if (!confirm('ゲームを中断しますか？\n現在のスコアで終了します。')) {
            // キャンセルが選択された場合、何もしない（ゲームを継続）
            console.log('ゲーム中断がキャンセルされました');
            return;
        }
        
        // ゲーム中断処理を実行（結果表示なし）
        this.endGameInterrupted();
    }
    
    /**
     * ゲーム中断処理（結果表示なし）
     */
    endGameInterrupted() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
            console.log('endGameInterrupted: タイマーをクリアしました');
        }
        this.gameStarted = false;
        
        // 全てのアニメーションを停止
        this.reels.forEach((reel, index) => {
            clearInterval(this.spinIntervals[index]);
        });
        
        
        // ハート音のリピート再生を停止
        this.audio.stopHeartMovingSound();
        
        // 結果ポップアップは表示しない（中断のため）
        
        // スタートボタンを復活、中断ボタンとスコア表示を非表示
        this.startButton.disabled = false;
        this.startButton.style.display = 'inline-block';
        this.startButton.textContent = 'スタート';
        this.stopButton.style.display = 'none';
        this.scoreDisplay.style.display = 'none';
        
        // 選択肢を非表示
        this.answerChoices.style.visibility = 'hidden';
        this.answerChoices.innerHTML = '';
        
        
    }
    
    /**
     * ゲーム終了
     */
    endGame() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
            console.log('endGame: タイマーをクリアしました');
        }
        this.gameStarted = false;
        
        // 全てのアニメーションを停止
        this.reels.forEach((reel, index) => {
            clearInterval(this.spinIntervals[index]);
        });
        
        
        // ハート音のリピート再生を停止
        this.audio.stopHeartMovingSound();
        
        // 結果ポップアップを表示
        this.showResultPopup();
        
        // スタートボタンを復活、中断ボタンとスコア表示を非表示
        this.startButton.disabled = false;
        this.startButton.style.display = 'inline-block';
        this.startButton.textContent = '再スタート';
        this.stopButton.style.display = 'none';
        this.scoreDisplay.style.display = 'none';
        
        
    }
    
    /**
     * アニメーションをクリア
     */
    clearAnimations() {
        // 全てのリールのアニメーションを停止
        this.reels.forEach((reel, index) => {
            if (this.spinIntervals[index]) {
                clearInterval(this.spinIntervals[index]);
                this.spinIntervals[index] = null;
            }
            this.isSpinning[index] = false;
        });
    }
    
    /**
     * 次の問題を開始
     */
    async startNextQuestion() {
        if (this.timeLeft <= 0) return;
        
        // 前回のアニメーションをクリア
        this.clearAnimations();
        
        // 強調表示をリセット
        this.resetHighlights();
        
        // 問題を選択
        this.currentQuestionData = this.logic.selectRandomQuestion();
        

        // UI状態の更新（選択肢の枠は表示、中身は全停止まで非表示）
        this.initializeAnswerChoices();
        this.currentQuestions = [null, null, null]; // 問題文状態リセット
        this.reelStopCompleted = [false, false, false]; // 停止完了フラグをリセット
        this.hasFinalizedQuestion = false; // 選択肢表示フラグをリセット
        
        // スタート音（slot_start.wav）
        this.audio.playStartSound();
        
        // 全てのリールを回転開始
        this.reels.forEach((reel, index) => {
            this.isSpinning[index] = true;
            this.spinReel(index);
        });
        
        // 左から順番に停止（0.5秒、1.0秒、1.5秒）
        setTimeout(() => {
            this.stopReel(0); // 左のリール（0.5秒後）
        }, 500);
        
        setTimeout(() => {
            this.stopReel(1); // 中央のリール（1.0秒後）
        }, 1000);
        
        setTimeout(() => {
            this.stopReel(2); // 右のリール（1.5秒後）
        }, 1500);
    }
    
    /**
     * 強調表示をリセット（画像ベース）
     */
    resetHighlights() {
        this.reels.forEach((reel) => {
            const symbols = reel.querySelectorAll('.slot-symbol');
            symbols.forEach(symbol => {
                symbol.style.borderTop = '';
                symbol.style.borderBottom = '';
                symbol.style.background = '';
                symbol.style.boxShadow = '';
            });
        });
    }
    
    /**
     * リールの回転アニメーション（滑らかな高速回転）
     * @param {number} reelIndex - リールのインデックス
     */
    spinReel(reelIndex) {
        const reel = this.reels[reelIndex];
        let position = 0;
        const interval = this.logic.getSpinInterval();
        const fullCycle = this.logic.getFullCycleLength();
        
        this.spinIntervals[reelIndex] = setInterval(() => {
            if (this.isSpinning[reelIndex]) {
                // より滑らかな高速回転
                position -= this.logic.symbolHeight * 2; // 2倍速で回転
                // 無限リピート：1周したら位置をリセットして継続
                if (position <= -fullCycle) {
                    position += fullCycle; // 位置をリセット（0に戻すのではなく、1周分を引く）
                }
                // リール全体を一つのユニットとして回転させる
                reel.style.transform = `translateY(${position}px)`;
            }
        }, interval);
    }
    
    
    /**
     * リールの停止
     * @param {number} reelIndex - リールのインデックス
     */
    stopReel(reelIndex) {
        if (!this.isSpinning[reelIndex]) return;
        
        
        // 回転状態の更新
        this.isSpinning[reelIndex] = false;
        
        // ゆっくりと停止
        this.slowDownReel(reelIndex);
    }
    
    /**
     * リールの減速停止アニメーション（画像ベース）
     * @param {number} reelIndex - リールのインデックス
     */
    slowDownReel(reelIndex) {
        const reel = this.reels[reelIndex];
        let currentPosition = this.getCurrentPosition(reel);
        let previousPosition = currentPosition;
        let velocity = 0;
        let soundPlayed = false; // 停止音再生フラグ
        
        // ロジック層から最終位置を取得
        const reelTypes = ['left', 'center', 'right'];
        const reelType = reelTypes[reelIndex];
        
        // 現在の問題データから適切な行番号を選択
        let targetRowNumber = null;
        if (reelIndex === 0) targetRowNumber = this.currentQuestionData.left.rowNumber;
        else if (reelIndex === 1) targetRowNumber = this.currentQuestionData.center.rowNumber;
        else if (reelIndex === 2) targetRowNumber = this.currentQuestionData.right.rowNumber;
        
        const finalPosition = this.logic.getPositionForQuestion(targetRowNumber, reelType);
        this.finalPositions[reelIndex] = finalPosition;
        
        // 滑らかな停止アニメーション
        const stopAnimation = () => {
            const distance = finalPosition - currentPosition;
            
            // 純粋に速度ベースの減速（距離に依存しない）
            const easingFactor = 0.08; // 固定の減速係数
            const newPosition = currentPosition + distance * easingFactor;
            
            // 回転速度を計算（より精密に）
            velocity = Math.abs(newPosition - previousPosition);
            previousPosition = currentPosition;
            currentPosition = newPosition;
            
            // 位置をピクセル単位で正確に設定（整数ピクセルにスナップ）
            const roundedPosition = Math.round(currentPosition);
            reel.style.transform = `translateY(${roundedPosition}px)`;
            
            // 回転速度が一定以下になったら強制停止（速度のみをトリガーに）
            // より厳格な停止条件で、ピッタリ真ん中に停止
            if (velocity <= 0.1 || Math.abs(distance) < 0.5) {
                // 最終位置に正確に固定（整数ピクセルにスナップ）
                const snappedFinal = Math.round(finalPosition);
                reel.style.transform = `translateY(${snappedFinal}px)`;
                
                // 停止位置から行番号を計算して記録
                const stoppedRowNumber = this.logic.getQuestionFromPosition(snappedFinal, reelType);
                this.currentQuestions[reelIndex] = stoppedRowNumber;
                this.reelStopCompleted[reelIndex] = true;
                
                
                // 停止音を再生
                if (!soundPlayed) {
                    this.audio.playStopSound();
                    soundPlayed = true;
                }
                
                // このリールだけを強調表示
                this.highlightSingleReel(reelIndex, targetRowNumber);
                
                // 全てのリールが停止したかチェック
                this.checkGameComplete();
            } else {
                requestAnimationFrame(stopAnimation);
            }
        };
        
        // インターバルをクリア
        clearInterval(this.spinIntervals[reelIndex]);
        
        // 停止アニメーション開始
        requestAnimationFrame(stopAnimation);
    }
    
    /**
     * 現在のリール位置を取得
     * @param {HTMLElement} reel - リール要素
     * @returns {number} 現在の位置
     */
    getCurrentPosition(reel) {
        const transform = reel.style.transform;
        const val = parseFloat(transform.replace('translateY(', '').replace('px)', ''));
        // 位置の精度を向上（小数点以下2桁で丸める）
        return isNaN(val) ? 0 : Math.round(val * 100) / 100;
    }

    /**
     * DOMの実寸に基づきロジック層の幾何情報を同期
     */
    syncGeometry() {
        try {
            // 全てのリールからsymbolHeightを取得して平均を計算（より正確に）
            let totalHeight = 0;
            let count = 0;
            
            for (let i = 0; i < this.reels.length; i++) {
                const reel = this.reels[i];
                if (!reel) continue;
                const symbol = reel.querySelector('.slot-symbol');
                if (!symbol) continue;
                const height = symbol.getBoundingClientRect().height;
                if (height > 0) {
                    totalHeight += height;
                    count++;
                }
            }
            
            // 平均symbolHeightを計算（整数化してズレを防止）
            if (count > 0) {
                const avgSymbolHeight = totalHeight / count;
                const snappedHeight = Math.round(avgSymbolHeight);
                this.logic.symbolHeight = snappedHeight;
            }
            
            // visibleRowsを計算（最初のリールのカラム要素から）
            const firstReel = this.reels[0];
            if (firstReel) {
                const columnEl = firstReel.parentElement;
                if (columnEl) {
                    const columnHeight = columnEl.getBoundingClientRect().height;
                    const visibleRows = Math.max(1, Math.round(columnHeight / this.logic.symbolHeight));
                    this.logic.visibleRows = visibleRows;
                }
            }
        } catch (e) {
            console.warn('幾何情報同期に失敗:', e);
        }
    }
    
    /**
     * ゲーム完了チェック
     */
    checkGameComplete() {
        // 2個目のリールが停止した段階で選択肢を表示
        const stoppedCount = this.reelStopCompleted.filter(done => done).length;
        
        
        // 2個目のリールが停止した時点で選択肢を表示
        if (stoppedCount >= 2 && !this.hasFinalizedQuestion) {
            this.hasFinalizedQuestion = true;
            // 問題を確定してから選択肢を表示
            this.finalizeQuestion();
        }
    }
    
    /**
     * 問題を確定して選択肢を表示（画像ベース）
     */
    finalizeQuestion() {
        // 問題を確定（行番号を記録）
        
        // 全てのリールはすでに個別に強調表示されているので、ここでは何もしない
        
        // 問題が確定したら即座に選択肢を表示
        this.displayAnswerChoices();
    }
    
    /**
     * 単一のリールを強調表示（画像ベース）
     * @param {number} reelIndex - リールのインデックス
     * @param {number} targetRowNumber - 目標行番号
     */
    highlightSingleReel(reelIndex, targetRowNumber) {
        const reel = this.reels[reelIndex];
        const symbols = reel.querySelectorAll('.slot-symbol');
        
        symbols.forEach(symbol => {
            const rowNumber = parseInt(symbol.dataset.rowNumber);
            // 目標の行番号に一致する場合、強調表示
            if (rowNumber === targetRowNumber) {
                symbol.style.borderTop = '';
                symbol.style.borderBottom = '';
                symbol.style.background = 'rgba(255, 215, 0, 0.2)';
                // 内側のラインで強調（レイアウトを変えず、はみ出し防止）
                symbol.style.boxShadow = 'inset 0 5px 0 #ffd700, inset 0 -5px 0 #ffd700, 0 0 20px rgba(255, 215, 0, 0.8)';
            }
        });
    }
    
    
    
    
    /**
     * 選択肢の初期化（無効状態で表示）
     */
    initializeAnswerChoices() {
        // 選択肢の枠を表示（中身は全停止まで非表示）
        this.answerChoices.innerHTML = '';
        
        for (let i = 0; i < 3; i++) {
            const button = document.createElement('button');
            button.className = 'answer-choice disabled';
            button.disabled = true;
            button.style.background = '#666666';
            button.style.cursor = 'not-allowed';
            button.style.opacity = '0.6';
            button.style.width = '250px';
            button.style.height = '150px';
            
            // プレースホルダー画像またはテキストを表示
            const placeholder = document.createElement('div');
            placeholder.style.width = '100%';
            placeholder.style.height = '100%';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.style.color = '#999';
            placeholder.style.fontSize = '14px';
            placeholder.textContent = '選択肢 ' + (i + 1);
            
            button.appendChild(placeholder);
            this.answerChoices.appendChild(button);
        }
        
        // 選択肢の枠を表示
        this.answerChoices.style.visibility = 'visible';
    }

    /**
     * 解答選択肢の表示（画像ベース）
     */
    displayAnswerChoices() {
        // 現在の問題データが確定しているかチェック
        if (!this.currentQuestionData) {
            console.error('問題データが確定していません');
            return;
        }
        
        const choices = this.logic.generateAnswerChoices();
        
        // 選択肢を完全に再生成
        this.answerChoices.innerHTML = '';
        
        // 選択肢ボタンを生成（画像として表示）
        choices.forEach((choiceData, index) => {
            const button = document.createElement('button');
            button.className = 'answer-choice';
            button.dataset.imagePath = choiceData.imagePath; // 画像パスをdata属性に保存
            button.dataset.isCorrect = choiceData.isCorrect; // 正解フラグをdata属性に保存
            button.style.width = '250px';
            button.style.height = '150px';
            
            // 画像要素を作成
            const img = document.createElement('img');
            img.src = choiceData.imageUrl; // Blob URLを使用
            img.alt = `選択肢 ${index + 1}`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.objectPosition = 'center';
            
            button.appendChild(img);
            
            button.addEventListener('click', () => {
                this.selectAnswer(choiceData.imagePath);
            });
            this.answerChoices.appendChild(button);
        });
        
        // 選択肢を表示
        this.answerChoices.style.visibility = 'visible';
        
    }
    
    /**
     * 解答の選択（画像ベース）
     * @param {string} selectedImagePath - 選択された解答の画像パス
     */
    selectAnswer(selectedImagePath) {
        // 選択肢を即座に非表示（押されたらすぐに非表示）
        this.answerChoices.style.visibility = 'hidden';
        
        const result = this.logic.judgeAnswer(selectedImagePath);
        
        // スコア更新
        this.score.totalQuestions++;
        if (result.isCorrect) {
            this.score.correctAnswers++;
            this.score.consecutiveCorrect++;
            // 最高連続正解数を更新
            if (this.score.consecutiveCorrect > this.score.maxConsecutive) {
                this.score.maxConsecutive = this.score.consecutiveCorrect;
            }
            // 正解時に制限時間を+5秒
            this.timeLeft += 5;
            // 時間ボーナス表示
            this.showTimeBonus();
        } else {
            this.score.consecutiveCorrect = 0; // 連続正解数をリセット
        }
        
        // スコア表示を即座に更新
        this.updateScoreDisplay();
        
        // ランク圏内チェック（プレイ中）
        this.checkRankingDuringGame();
        
        // 結果表示は削除済み
        
        // 選択肢の色を変更（非表示中に実行、画像パスで判定）
        const choiceButtons = this.answerChoices.querySelectorAll('.answer-choice');
        choiceButtons.forEach(button => {
            const imagePath = button.dataset.imagePath;
            if (imagePath === result.correctImagePath) {
                button.classList.add('correct');
            } else if (imagePath === selectedImagePath && !result.isCorrect) {
                button.classList.add('incorrect');
            }
            button.disabled = true;
        });
        
        // 音響効果：正解・不正解に応じて音を再生
        if (result.isCorrect) {
            this.audio.playAnswerCorrectSound();
        } else {
            this.audio.playAnswerMissSound();
        }
        
        // 1秒後に自動で次の問題に移行
        setTimeout(() => {
            this.answerChoices.innerHTML = '';
            if (this.timeLeft > 0) {
                this.startNextQuestion();
            }
        }, 1000);
    }
    
    /**
     * 時間ボーナス表示
     */
    showTimeBonus() {
        if (!this.timeBonusDisplay) return;
        
        // 表示をリセット
        this.timeBonusDisplay.classList.remove('show');
        this.timeBonusDisplay.style.display = 'block';
        
        // 少し遅延してからアニメーション開始
        setTimeout(() => {
            this.timeBonusDisplay.classList.add('show');
        }, 50);
        
        // 1.5秒後に非表示
        setTimeout(() => {
            this.timeBonusDisplay.classList.remove('show');
            setTimeout(() => {
                this.timeBonusDisplay.style.display = 'none';
            }, 300);
        }, 1500);
    }
    
    /**
     * プレイ中のランク圏内チェック
     */
    checkRankingDuringGame() {
        // 既にランクイン音を再生済みの場合は何もしない
        if (this.hasPlayedRankinGako) {
            return;
        }
        
        // ランキングが埋まっているかチェック
        if (!this.isRankingFull()) {
            return;
        }
        
        // 正解数ランキングの上位5位以内に入るかチェック
        const isCorrectTop5 = this.ranking.isCorrectAnswersTop5(this.score.correctAnswers);
        // 連続正解数ランキングの上位5位以内に入るかチェック
        const isConsecutiveTop5 = this.ranking.isConsecutiveAnswersTop5(this.score.maxConsecutive);
        
        if (isCorrectTop5 || isConsecutiveTop5) {
            // ランク圏内入り音を再生（1回のみ）
            this.audio.playRankinGakoSound();
            this.hasPlayedRankinGako = true; // フラグを立てて重複再生を防止
        }
    }
    
    /**
     * ランキングが埋まっているかチェック
     * @returns {boolean} ランキングが埋まっているかどうか
     */
    isRankingFull() {
        const correctAnswersCount = this.ranking.getCorrectAnswersRanking().length;
        const consecutiveAnswersCount = this.ranking.getConsecutiveAnswersRanking().length;
        const maxEntries = this.ranking.maxRankingEntries;
        
        // どちらかのランキングが最大エントリー数に達している場合のみtrue
        return correctAnswersCount >= maxEntries || consecutiveAnswersCount >= maxEntries;
    }
    
    /**
     * ランキングにデータがあるかチェック
     * @returns {boolean} ランキングにデータがあるかどうか
     */
    hasRankingData() {
        const correctAnswersCount = this.ranking.getCorrectAnswersRanking().length;
        const consecutiveAnswersCount = this.ranking.getConsecutiveAnswersRanking().length;
        
        // どちらかのランキングにデータがある場合のみtrue
        return correctAnswersCount > 0 || consecutiveAnswersCount > 0;
    }
    
    /**
     * スコア表示を更新
     */
    updateScoreDisplay() {
        if (this.gameStarted && this.scoreDisplay) {
            // 残り時間の色とアニメーションを決定（10秒以下で点滅表示）
            const isUrgent = this.timeLeft <= 10;
            const timeColor = isUrgent ? '#dc3545' : '';
            const timeClass = isUrgent ? 'urgent-time blinking' : '';
            const timeSize = isUrgent ? '28px' : '24px';
            
            // スコア表示エリアに詳細情報を表示
            this.scoreDisplay.innerHTML = `
                <div style="line-height: 1.4;">
                    <div class="${timeClass}" style="font-size: ${timeSize}; font-weight: bold; margin-bottom: 8px; text-align: center; color: ${timeColor};">
                        残り ${this.timeLeft}秒
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 16px; margin-bottom: 3px;">
                        <span>正解:</span>
                        <span>${this.score.correctAnswers}問</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 16px;">
                        <span>連続:</span>
                        <span>${this.score.consecutiveCorrect}問</span>
                    </div>
                </div>
            `;
        } else if (this.startButton) {
            // ゲーム開始前は初期表示
            this.startButton.textContent = 'スタート';
        }
    }
    
    
    /**
     * 結果ポップアップが表示されているかチェック
     * @returns {boolean} 結果ポップアップが表示されているか
     */
    isResultPopupVisible() {
        const popup = document.getElementById('resultPopup');
        return popup && popup.style.display === 'flex';
    }
    
    /**
     * 結果ポップアップを表示
     */
    showResultPopup() {
        const popup = document.getElementById('resultPopup');
        const popupContent = document.getElementById('resultPopupContent');
        const totalQuestions = document.getElementById('popupTotalQuestions');
        const correctAnswers = document.getElementById('popupCorrectAnswers');
        const accuracy = document.getElementById('popupAccuracy');
        const maxConsecutive = document.getElementById('popupMaxConsecutive');
        const rankingButtons = document.getElementById('rankingButtons');
        
        // 正答率を計算
        const accuracyRate = this.score.totalQuestions > 0 
            ? Math.round((this.score.correctAnswers / this.score.totalQuestions) * 100)
            : 0;
        
        // データを設定
        totalQuestions.textContent = this.score.totalQuestions;
        correctAnswers.textContent = this.score.correctAnswers;
        accuracy.textContent = `${accuracyRate}%`;
        maxConsecutive.textContent = this.score.maxConsecutive;
        
        // ランキング記録ボタンの表示制御
        this.updateRankingButtons(accuracyRate);
        
        // ランキング入りエフェクトの制御
        this.checkRankingEffect(accuracyRate);
        
        // ポップアップを表示
        popup.style.display = 'flex';
    }
    
    /**
     * ランキング入りエフェクトの制御（豪華版）
     * @param {number} accuracyRate - 正答率
     */
    checkRankingEffect(accuracyRate) {
        console.log('=== ランキング入りエフェクトチェック開始 ===');
        console.log(`現在のスコア - 正解数: ${this.score.correctAnswers}, 連続正解数: ${this.score.maxConsecutive}`);
        
        const popupContent = document.getElementById('resultPopupContent');
        const sparkles = document.getElementById('rankingSparkles');
        const rankingMessage = document.getElementById('rankingMessage');
        
        // どちらか一方でもトップ5位以内に入るかチェック
        const isCorrectTop5 = this.ranking.isCorrectAnswersTop5(this.score.correctAnswers);
        const isConsecutiveTop5 = this.ranking.isConsecutiveAnswersTop5(this.score.maxConsecutive);
        
        console.log(`ランクイン判定結果 - 正解数: ${isCorrectTop5}, 連続正解数: ${isConsecutiveTop5}`);
        
        // どちらか一方でもランクインしていなければ演出なし
        if (!isCorrectTop5 && !isConsecutiveTop5) {
            console.log('❌ ランクインしていないため、動画・エフェクトなし');
            console.log('=== ランキング入りエフェクトチェック終了 ===');
            return;
        }
        
        console.log('✅ ランクイン確定！動画とエフェクトを再生します');
        
        // 実際のランクを計算するために一時的にエントリを追加してランクを取得
        let correctRank = null;
        let consecutiveRank = null;
        
        if (isCorrectTop5) {
            // 一時的にエントリを追加してランクを計算
            const tempRankings = [...this.ranking.rankings.correctAnswers, {
                playerName: 'temp',
                correctAnswers: this.score.correctAnswers,
                totalQuestions: this.score.totalQuestions,
                accuracy: accuracyRate,
                timestamp: new Date().toISOString()
            }];
            tempRankings.sort((a, b) => {
                if (b.correctAnswers !== a.correctAnswers) {
                    return b.correctAnswers - a.correctAnswers;
                }
                return b.accuracy - a.accuracy;
            });
            correctRank = tempRankings.findIndex(e => e.playerName === 'temp') + 1;
        }
        
        if (isConsecutiveTop5) {
            // 一時的にエントリを追加してランクを計算
            const tempRankings = [...this.ranking.rankings.consecutiveAnswers, {
                playerName: 'temp',
                consecutiveAnswers: this.score.maxConsecutive,
                totalQuestions: this.score.totalQuestions,
                accuracy: accuracyRate,
                timestamp: new Date().toISOString()
            }];
            tempRankings.sort((a, b) => {
                if (b.consecutiveAnswers !== a.consecutiveAnswers) {
                    return b.consecutiveAnswers - a.consecutiveAnswers;
                }
                return b.accuracy - a.accuracy;
            });
            consecutiveRank = tempRankings.findIndex(e => e.playerName === 'temp') + 1;
        }
        
        // どちらか一方でも1位かどうかを判定
        const isFirst = (correctRank === 1) || (consecutiveRank === 1);
        
        console.log(`実際のランク - 正解数: ${correctRank}, 連続正解数: ${consecutiveRank}, 1位判定: ${isFirst}`);
        
        // ランキング入り動画を表示（新しい動画管理システムを使用）
        this.videoManager.playBackgroundVideo();
        
        if (isFirst) {
            // どちらか一方でも1位: トップランキング入りオーバーレイ動画を表示
            this.videoManager.playTopOverlayVideo();
            console.log('🎬 トップ1位の動画を再生します (toprankin_overlay_animation.mp4)');
        } else {
            // 2～5位: 通常のランキング入りオーバーレイ動画を表示
            this.videoManager.playOverlayVideo();
            console.log('🎬 トップ5位の動画を再生します (rankin_overlay_animation.mp4)');
        }
        
        // ランキング入り特別メッセージを表示
        this.showRankingMessage(isCorrectTop5, isConsecutiveTop5, isFirst);
        
        // ランキング入りエフェクトを適用
        popupContent.classList.add('ranking-effect');
        sparkles.style.display = 'block';
        
        // パーティクルエフェクトを追加
        this.createParticleEffect(popupContent);
        
        // 画面全体に振動エフェクトを追加
        this.addScreenShake();
        
        // 動画の長さに合わせてエフェクトを停止（動画が終了したら自動的に非表示になる）
        // エフェクトは5秒後に停止（動画は自動的に終了時に非表示になる）
        setTimeout(() => {
            popupContent.classList.remove('ranking-effect');
            sparkles.style.display = 'none';
            rankingMessage.style.display = 'none';
        }, 5000);
        
        // ランキング入り音を再生
        this.playRankingFanfare();
        
        console.log('=== ランキング入りエフェクトチェック終了 ===');
    }
    
    /**
     * ランキング入り特別メッセージを表示
     * @param {boolean} isCorrectTop5 - 正解数ランキング入り
     * @param {boolean} isConsecutiveTop5 - 連続正解数ランキング入り
     * @param {boolean} isFirst - 1位かどうか
     */
    showRankingMessage(isCorrectTop5, isConsecutiveTop5, isFirst) {
        const rankingMessage = document.getElementById('rankingMessage');
        
        let message = '🎉 ランキング入り！ 🎉';
        
        // 1位の場合は特別なメッセージ
        if (isFirst) {
            if (isCorrectTop5 && isConsecutiveTop5) {
                message = '👑 ダブル1位！おめでとうございます！ 👑';
            } else if (isCorrectTop5) {
                message = '👑 正解数1位！おめでとうございます！ 👑';
            } else if (isConsecutiveTop5) {
                message = '👑 連続正解数1位！おめでとうございます！ 👑';
            }
        } 
        // トップ5の場合（2～5位）
        else {
            if (isCorrectTop5 && isConsecutiveTop5) {
                message = '🏆 ダブルランキング入り！ 🏆';
            } else if (isCorrectTop5) {
                message = '⭐ 正解数ランキング入り！ ⭐';
            } else if (isConsecutiveTop5) {
                message = '🔥 連続正解数ランキング入り！ 🔥';
            }
        }
        
        rankingMessage.textContent = message;
        rankingMessage.style.display = 'block';
        
        // メッセージのアニメーション
        setTimeout(() => {
            rankingMessage.style.opacity = '0';
            rankingMessage.style.transform = 'translateX(-50%) translateY(-20px) scale(0.8)';
        }, 4500);
    }
    
    /**
     * パーティクルエフェクトを作成
     * @param {HTMLElement} container - エフェクトのコンテナ
     */
    createParticleEffect(container) {
        const particleCount = 20;
        
        for (let i = 0; i < particleCount; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.style.position = 'absolute';
                particle.style.width = '6px';
                particle.style.height = '6px';
                particle.style.background = `hsl(${Math.random() * 360}, 100%, 50%)`;
                particle.style.borderRadius = '50%';
                particle.style.pointerEvents = 'none';
                particle.style.zIndex = '1002';
                
                // ランダムな位置から開始
                const startX = Math.random() * container.offsetWidth;
                const startY = Math.random() * container.offsetHeight;
                particle.style.left = startX + 'px';
                particle.style.top = startY + 'px';
                
                container.appendChild(particle);
                
                // アニメーション
                const animation = particle.animate([
                    { 
                        transform: 'translate(0, 0) scale(1)',
                        opacity: 1
                    },
                    { 
                        transform: `translate(${(Math.random() - 0.5) * 200}px, ${(Math.random() - 0.5) * 200}px) scale(0)`,
                        opacity: 0
                    }
                ], {
                    duration: 2000 + Math.random() * 1000,
                    easing: 'ease-out'
                });
                
                animation.onfinish = () => {
                    particle.remove();
                };
            }, i * 100);
        }
    }
    
    /**
     * 画面振動エフェクトを追加
     */
    addScreenShake() {
        const body = document.body;
        body.style.animation = 'screen-shake 0.5s ease-in-out';
        
        // CSS アニメーションを動的に追加
        if (!document.getElementById('screen-shake-style')) {
            const style = document.createElement('style');
            style.id = 'screen-shake-style';
            style.textContent = `
                @keyframes screen-shake {
                    0%, 100% { transform: translateX(0); }
                    10% { transform: translateX(-2px); }
                    20% { transform: translateX(2px); }
                    30% { transform: translateX(-1px); }
                    40% { transform: translateX(1px); }
                    50% { transform: translateX(-0.5px); }
                    60% { transform: translateX(0.5px); }
                    70% { transform: translateX(-0.25px); }
                    80% { transform: translateX(0.25px); }
                    90% { transform: translateX(-0.1px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            body.style.animation = '';
        }, 500);
    }
    
    
    /**
     * ランキング入りファンファーレを再生
     */
    playRankingFanfare() {
        // ランキング入り音（rankin.wav）
        this.audio.playRankinSound();
        
    }
    
    /**
     * ランキング記録ボタンの表示制御
     * @param {number} accuracyRate - 正答率
     */
    updateRankingButtons(accuracyRate) {
        const rankingButtons = document.getElementById('rankingButtons');
        const recordRankingBtn = document.getElementById('recordRankingBtn');
        
        // 正解数ランキングの上位5位以内に入るかチェック
        const isCorrectTop5 = this.ranking.isCorrectAnswersTop5(this.score.correctAnswers);
        // 連続正解数ランキングの上位5位以内に入るかチェック
        const isConsecutiveTop5 = this.ranking.isConsecutiveAnswersTop5(this.score.maxConsecutive);
        
        // ランキングボタンエリアの表示制御
        rankingButtons.style.display = (isCorrectTop5 || isConsecutiveTop5) ? 'block' : 'none';
        
        // イベントリスナーを設定
        recordRankingBtn.onclick = () => {
            this.audio.playButtonPushedSound();
            this.recordRanking(accuracyRate);
        };
    }
    
    /**
     * ランキングに記録（統合版）
     * @param {number} accuracyRate - 正答率
     */
    async recordRanking(accuracyRate) {
        const playerName = prompt('プレイヤー名を入力してください:');
        if (!playerName || !playerName.trim()) {
            return;
        }
        
        const trimmedName = playerName.trim();
        const results = [];
        
        try {
            // 正解数ランキングの上位5位以内に入るかチェック
            const isCorrectTop5 = this.ranking.isCorrectAnswersTop5(this.score.correctAnswers);
            // 連続正解数ランキングの上位5位以内に入るかチェック
            const isConsecutiveTop5 = this.ranking.isConsecutiveAnswersTop5(this.score.maxConsecutive);
            
            // 正解数ランキングに記録
            if (isCorrectTop5) {
                const correctResult = this.ranking.addCorrectAnswersEntry(
                    trimmedName,
                    this.score.correctAnswers,
                    this.score.totalQuestions,
                    accuracyRate
                );
                if (correctResult.isRanked) {
                    results.push(`正解数ランキング ${correctResult.rank}位`);
                }
            }
            
            // 連続正解数ランキングに記録
            if (isConsecutiveTop5) {
                const consecutiveResult = this.ranking.addConsecutiveAnswersEntry(
                    trimmedName,
                    this.score.maxConsecutive,
                    this.score.totalQuestions,
                    accuracyRate
                );
                if (consecutiveResult.isRanked) {
                    results.push(`連続正解数ランキング ${consecutiveResult.rank}位`);
                }
            }
            
            // 結果を表示
            if (results.length > 0) {
                alert(`${results.join('、')}に記録されました！`);
                // ランキング画面を自動で開く
                setTimeout(() => {
                    this.showRankings();
                }, 1000);
            } else {
                alert('ランキングに記録されませんでした。');
            }
            
        } catch (error) {
            console.error('ランキング記録エラー:', error);
            alert('ランキングの記録に失敗しました。');
        }
    }
    
    /**
     * 結果ポップアップを閉じる
     */
    closeResultPopup() {
        const popup = document.getElementById('resultPopup');
        popup.style.display = 'none';
        
        // ランキング入り動画も非表示にする
        this.videoManager.stopAllVideos();
        
        // 動画再生フラグをリセット
        this.videoManager.resetPlayedFlag();
    }
    
    /**
     * ゲームを再スタート
     */
    restartGame() {
        this.closeResultPopup();
        
        // ゲーム状態を完全にリセット
        this.resetGameState();
        
        // ゲームを開始
        this.startGame();
    }
    
    /**
     * ゲーム状態を完全にリセット
     */
    resetGameState() {
        // ゲーム状態をリセット
        this.gameStarted = false;
        this.score = { totalQuestions: 0, consecutiveCorrect: 0, correctAnswers: 0, maxConsecutive: 0 };
        this.timeLeft = 120;
        this.hasPlayedRankinGako = false; // ランクイン音再生フラグをリセット
        
        // タイマーをクリア
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
            console.log('resetGameState: タイマーをクリアしました');
        }
        
        // 全てのアニメーションを停止
        this.reels.forEach((reel, index) => {
            clearInterval(this.spinIntervals[index]);
            this.spinIntervals[index] = null;
            this.isSpinning[index] = false;
        });
        
        // リールの位置をリセット
        this.reels.forEach(reel => {
            reel.style.transform = 'translateY(0px)';
        });
        
        // 問題データをリセット
        this.currentQuestionData = null;
        this.currentQuestions = [null, null, null];
        this.finalPositions = [0, 0, 0];
        
        // UI要素をリセット（結果表示は削除済み）
        
        // 選択肢を非表示
        this.answerChoices.style.visibility = 'hidden';
        this.answerChoices.innerHTML = '';
        
        
        // ランキング入り動画を非表示
        this.videoManager.stopAllVideos();
        
        // 動画再生フラグをリセット
        this.videoManager.resetPlayedFlag();
        
        // スタートボタンをリセット、中断ボタンとスコア表示を非表示
        this.startButton.disabled = false;
        this.startButton.style.display = 'inline-block';
        this.startButton.textContent = 'スタート';
        this.stopButton.style.display = 'none';
        this.scoreDisplay.style.display = 'none';
        this.updateScoreDisplay();
        
    }
    
    /**
     * ランキング表示
     */
    showRankings() {
        const popup = document.getElementById('rankingPopup');
        const correctAnswersRanking = document.getElementById('correctAnswersRanking');
        const consecutiveAnswersRanking = document.getElementById('consecutiveAnswersRanking');
        
        // 表示前に最新データを強制読み込み（クリア後は不要）
        // this.ranking.refreshRankings(); // コメントアウト：クリア後に復活するのを防ぐ
        
        // ランキングデータを表示
        this.displayRanking(correctAnswersRanking, this.ranking.getCorrectAnswersRanking(), 'correctAnswers');
        this.displayRanking(consecutiveAnswersRanking, this.ranking.getConsecutiveAnswersRanking(), 'consecutiveAnswers');
        
        // ポップアップを表示
        popup.style.display = 'flex';
    }
    
    /**
     * ランキング表示
     */
    displayRanking(container, rankingData, type) {
        if (rankingData.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">ランキングデータがありません</div>';
            return;
        }
        
        let html = '';
        rankingData.forEach((entry, index) => {
            const rank = index + 1;
            const score = type === 'correctAnswers' ? entry.correctAnswers : entry.consecutiveAnswers;
            const scoreLabel = type === 'correctAnswers' ? '正解数' : '連続正解数';
            
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #333; ${rank <= 3 ? 'background: rgba(192, 0, 0, 0.2);' : ''}">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: bold; color: ${rank <= 3 ? '#ffff00' : '#ffd700'}; min-width: 20px;">${rank}位</span>
                        <span style="font-weight: bold; color: #ffd700;">${entry.playerName}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: #ffd700;">${score}${scoreLabel}</div>
                        <div style="font-size: 12px; color: #999;">正答率: ${entry.accuracy}%</div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    /**
     * ランキングポップアップを閉じる
     */
    closeRankingPopup() {
        const popup = document.getElementById('rankingPopup');
        popup.style.display = 'none';
    }
    
    /**
     * ランキングをクリア
     */
    clearRankings() {
        if (confirm('ランキングデータをすべて削除しますか？\n\n【削除される内容】\n・正解数ランキング\n・連続正解数ランキング\n・デバイスに保存されたローカルデータ\n\nこの操作は取り消せません。\n本当に削除しますか？')) {
            try {
                // ランキングデータをクリア
                this.ranking.clearRankings();
                
                // ランキング表示を更新（空の状態で）
                const correctAnswersRanking = document.getElementById('correctAnswersRanking');
                const consecutiveAnswersRanking = document.getElementById('consecutiveAnswersRanking');
                if (correctAnswersRanking) {
                    correctAnswersRanking.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">ランキングデータがありません</div>';
                }
                if (consecutiveAnswersRanking) {
                    consecutiveAnswersRanking.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">ランキングデータがありません</div>';
                }
                
                alert('✅ ランキングデータをクリアしました。\n\n・メモリ上のデータ: 削除完了\n・ローカルストレージ: 削除完了\n\n次回ゲーム開始時から新しいランキングが作成されます。');
                this.closeRankingPopup();
            } catch (error) {
                console.error('ランキングクリアエラー:', error);
                alert('❌ ランキングデータのクリアに失敗しました。\n\nエラー: ' + error.message);
            }
        }
    }
    
    /**
     * ランキングデータをエクスポート
     */
    exportRankings() {
        try {
            
            // エクスポート前に最新データを強制読み込み（クリア後は不要）
            // this.ranking.refreshRankings(); // コメントアウト：クリア後に復活するのを防ぐ
            
            // ランキングデータの存在確認（現在のメモリ上のデータで確認）
            const correctAnswers = this.ranking.getCorrectAnswersRanking();
            const consecutiveAnswers = this.ranking.getConsecutiveAnswersRanking();
            
            
            if (correctAnswers.length === 0 && consecutiveAnswers.length === 0) {
                alert('エクスポートするランキングデータがありません。\nまずゲームをプレイしてランキングデータを作成してください。');
                return;
            }
            
            const exportData = this.ranking.exportRankings();
            if (exportData) {
                // ファイル名を生成
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `slot-ranking-${timestamp}.json`;
                
                // ダウンロード用のBlobを作成
                const blob = new Blob([exportData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                // ダウンロードリンクを作成
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                alert(`ランキングデータをエクスポートしました。\n正解数ランキング: ${correctAnswers.length}件\n連続正解数ランキング: ${consecutiveAnswers.length}件\n\nファイル名: ${filename}`);
            } else {
                alert('エクスポートに失敗しました。データの処理中にエラーが発生しました。');
            }
        } catch (error) {
            console.error('エクスポートエラー:', error);
            alert(`エクスポートに失敗しました。\nエラー: ${error.message}`);
        }
    }
    
    /**
     * ランキングデータをインポート
     */
    importRankings() {
        try {
            // ファイル選択用のinput要素を作成
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = async (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const jsonData = e.target.result;
                            if (this.ranking.importRankings(jsonData)) {
                                alert('ランキングデータをインポートしました。');
                                // ランキング表示を更新
                                this.showRankings();
                            } else {
                                alert('インポートに失敗しました。データ形式を確認してください。');
                            }
                        } catch (error) {
                            console.error('インポートエラー:', error);
                            alert('インポートに失敗しました。');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        } catch (error) {
            console.error('インポートエラー:', error);
            alert('インポートに失敗しました。');
        }
    }
    
    
    /**
     * 完全再起動（システム全体をリセット）
     */
    fullRestart() {
        if (confirm('システム全体を完全に再起動しますか？\nゲーム状態とランキングデータがリセットされます。')) {
            try {
                // 結果ポップアップを閉じる
                this.closeResultPopup();
                
                // ランキング入り動画を非表示
                this.videoManager.stopAllVideos();
                
                // ゲーム状態を完全にリセット
                this.resetGameState();
                
                // ランキングシステムをリセット
                this.ranking.clearRankings();
                console.log('ランキングシステムをリセットしました');
                
                // 音響システムをリセット
                if (this.audio) {
                    this.audio = new window.SlotAudio();
                }
                
                // ロジックシステムをリセット
                if (this.logic) {
                    this.logic = new window.SlotLogic();
                }
                
                // アップロード画面に戻る
                document.getElementById('uploadScreen').style.display = 'flex';
                document.getElementById('slotScreen').style.display = 'none';
                
                alert('システムの完全再起動が完了しました。');
                
            } catch (error) {
                console.error('完全再起動に失敗しました:', error);
                alert('完全再起動に失敗しました。ページを手動で再読み込みしてください。');
            }
        }
    }
    
    /**
     * メニューに戻る（スロット画面の初期状態に戻る）
     */
    returnToMenu() {
        this.closeResultPopup();
        
        // ゲーム状態をリセット
        this.gameStarted = false;
        this.score = { totalQuestions: 0, consecutiveCorrect: 0, correctAnswers: 0, maxConsecutive: 0 };
        this.timeLeft = 120;
        this.hasPlayedRankinGako = false; // ランクイン音再生フラグをリセット
        
        // タイマーをクリア
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
            console.log('returnToMenu: タイマーをクリアしました');
        }
        
        // 全てのアニメーションを停止
        this.reels.forEach((reel, index) => {
            clearInterval(this.spinIntervals[index]);
        });
        
        
        // ランキング入り動画を非表示
        this.videoManager.stopAllVideos();
        
        // 動画再生フラグをリセット
        this.videoManager.resetPlayedFlag();
        
        // スタートボタンを復活、中断ボタンとスコア表示を非表示
        this.startButton.disabled = false;
        this.startButton.style.display = 'inline-block';
        this.startButton.textContent = 'スタート';
        this.stopButton.style.display = 'none';
        this.scoreDisplay.style.display = 'none';
        this.updateScoreDisplay();
        
        // 結果表示は削除済み
        
        // 選択肢を非表示
        this.answerChoices.style.visibility = 'hidden';
        this.answerChoices.innerHTML = '';
        
        // スロット画面に留まる（プレイボタンが表示される状態）
        // アップロード画面には戻らない
        document.getElementById('slotScreen').style.display = 'flex';
    }
}

// ページ読み込み完了後にUI初期化
let slotUI = null;

document.addEventListener('DOMContentLoaded', () => {
    slotUI = new SlotUI();
    
    // グローバル関数として公開（デバッグ・テスト用）
    window.getSlotDebugInfo = () => {
        if (slotUI) {
            return slotUI.logic.getDebugInfo();
        }
    };
    
    window.getCurrentSlotState = () => {
        if (slotUI) {
            return {
                currentQuestions: slotUI.currentQuestions,
                finalPositions: slotUI.finalPositions,
                isSpinning: slotUI.isSpinning,
                score: slotUI.score,
                currentQuestionData: slotUI.currentQuestionData
            };
        }
    };
    
    
    // グローバル関数として公開
    window.closeResultPopup = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.closeResultPopup();
        }
    };
    
    window.restartGame = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.restartGame();
        }
    };
    
    window.returnToMenu = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.returnToMenu();
        }
    };
    
    window.showRankings = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.showRankings();
        }
    };
    
    window.closeRankingPopup = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.closeRankingPopup();
        }
    };
    
    window.clearRankings = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.clearRankings();
        }
    };
    
    window.exportRankings = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.exportRankings();
        }
    };
    
    window.importRankings = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.importRankings();
        }
    };
    
    
    window.fullRestart = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.fullRestart();
        }
    };
    
    // メニューからランキング機能を呼び出す関数
    window.showRankingsFromMenu = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.showRankings();
        }
    };
    
    window.exportRankingsFromMenu = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.exportRankings();
        }
    };
    
    window.importRankingsFromMenu = () => {
        if (slotUI && slotUI.audio) {
            slotUI.audio.playButtonPushedSound();
        }
        if (slotUI) {
            slotUI.importRankings();
        }
    };
    
});
