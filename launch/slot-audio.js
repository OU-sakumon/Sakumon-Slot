/**
 * 阪大作問サークルスロットの音響システム
 * Web Audio APIを使用して音を動的生成
 */

class SlotAudio {
    constructor() {
        this.audioContext = null;
        this.isEnabled = false;
        this.masterVolume = 0.3; // 音量調整（0.0-1.0）
        
        // プリロード用の音声オブジェクト
        this.preloadedSounds = {
            start: null,
            stop: null,
            rankin: null,
            heartMoving: null,
            buttonPushed: null,
            rankinGako: null,
            answerCorrect: null,
            answerMiss: null
        };
        
        // ハート音のリピート再生用
        this.heartMovingAudio = null;
        this.isHeartPlaying = false;
        
        this.initAudioContext();
        this.preloadSounds();
    }
    
    /**
     * Audio Contextの初期化
     */
    async initAudioContext() {
        try {
            // モダンブラウザ対応
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.isEnabled = true;
        } catch (error) {
            console.warn('Web Audio API is not supported:', error);
            this.isEnabled = false;
        }
    }
    
    /**
     * ユーザーインタラクション後にオーディオを有効化
     */
    async enableAudio() {
        if (!this.audioContext) return;
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        this.isEnabled = true;
    }
    
    /**
     * 音声ファイルをプリロード
     */
    preloadSounds() {
        const soundFiles = {
            start: './sounds/slot_start.wav',
            stop: window.slotStopAudioUrl || './sounds/slot_stop.mp3', // zipから読み込んだ音声を優先
            rankin: './sounds/rankin.wav',
            heartMoving: './sounds/heart_moving.mp3',
            buttonPushed: './sounds/button_pushed.mp3',
            rankinGako: './sounds/rankin_gako.mp3',
            answerCorrect: window.answerCorrectAudioUrl || './sounds/answer_correct.mp3', // zipから読み込んだ音声を優先
            answerMiss: window.answerMissAudioUrl || './sounds/answer_miss.mp3' // zipから読み込んだ音声を優先
        };
        
        Object.keys(soundFiles).forEach(key => {
            const audio = new Audio(soundFiles[key]);
            audio.preload = 'auto';
            audio.volume = this.masterVolume;
            
            audio.addEventListener('canplaythrough', () => {
                console.log(`${key}音声のプリロードが完了しました`);
            });
            
            audio.addEventListener('error', (e) => {
                console.warn(`${key}音声のプリロードに失敗しました:`, e);
            });
            
            this.preloadedSounds[key] = audio;
        });
    }
    
    /**
     * 基本的な音を生成
     * @param {number} frequency - 周波数（Hz）
     * @param {number} duration - 持続時間（秒）
     * @param {string} type - 波形タイプ
     * @param {number} volume - 音量（0.0-1.0）
     */
    playTone(frequency, duration, type = 'sine', volume = 0.5) {
        if (!this.isEnabled || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume * this.masterVolume, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    
    /**
     * 音量設定
     * @param {number} volume - 音量（0.0-1.0）
     */
    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }
    
    /**
     * 音響システムの有効/無効切り替え
     * @param {boolean} enabled - 有効フラグ
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
    }
    
    
    /**
     * スロット回転開始音（slot_start.wav）
     */
    playStartSound() {
        if (!this.isEnabled) return;
        
        try {
            if (this.preloadedSounds.start) {
                // プリロードされた音声を複製して再生（同時再生対応）
                const audio = this.preloadedSounds.start.cloneNode();
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('slot_start.wavの再生に失敗しました:', error);
                });
            } else {
                // フォールバック：新しくAudioオブジェクトを作成
                const audio = new Audio('./sounds/slot_start.wav');
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('slot_start.wavの再生に失敗しました:', error);
                });
            }
        } catch (error) {
            console.warn('slot_start.wavの読み込みに失敗しました:', error);
        }
    }
    
    /**
     * ランキング入り音（rankin.wav）
     */
    playRankinSound() {
        if (!this.isEnabled) return;
        
        try {
            if (this.preloadedSounds.rankin) {
                // プリロードされた音声を複製して再生（同時再生対応）
                const audio = this.preloadedSounds.rankin.cloneNode();
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('rankin.wavの再生に失敗しました:', error);
                });
            } else {
                // フォールバック：新しくAudioオブジェクトを作成
                const audio = new Audio('./sounds/rankin.wav');
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('rankin.wavの再生に失敗しました:', error);
                });
            }
        } catch (error) {
            console.warn('rankin.wavの読み込みに失敗しました:', error);
        }
    }
    
    /**
     * スロット停止音（slot_stop.mp3）
     */
    playStopSound() {
        if (!this.isEnabled) return;
        
        try {
            if (this.preloadedSounds.stop) {
                // プリロードされた音声を複製して再生（同時再生対応）
                const audio = this.preloadedSounds.stop.cloneNode();
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('slot_stop.mp3の再生に失敗しました:', error);
                });
            } else {
                // フォールバック：新しくAudioオブジェクトを作成
                const audioUrl = window.slotStopAudioUrl || './sounds/slot_stop.mp3';
                const audio = new Audio(audioUrl);
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('slot_stop.mp3の再生に失敗しました:', error);
                });
            }
        } catch (error) {
            console.warn('slot_stop.mp3の読み込みに失敗しました:', error);
        }
    }
    
    /**
     * ハート音のリピート再生開始（最後の10秒用）
     */
    startHeartMovingSound() {
        if (!this.isEnabled || this.isHeartPlaying) return;
        
        try {
            if (this.preloadedSounds.heartMoving) {
                this.heartMovingAudio = this.preloadedSounds.heartMoving.cloneNode();
                this.heartMovingAudio.volume = this.masterVolume;
                this.heartMovingAudio.loop = true; // リピート再生を有効化
                
                this.heartMovingAudio.addEventListener('ended', () => {
                    // ループ再生のため、endedイベントは通常発生しない
                    this.isHeartPlaying = false;
                });
                
                this.heartMovingAudio.play().then(() => {
                    this.isHeartPlaying = true;
                    console.log('ハート音のリピート再生を開始しました');
                }).catch(error => {
                    console.warn('heart_moving.mp3の再生に失敗しました:', error);
                    this.isHeartPlaying = false;
                });
            } else {
                // フォールバック：新しくAudioオブジェクトを作成
                this.heartMovingAudio = new Audio('./sounds/heart_moving.mp3');
                this.heartMovingAudio.volume = this.masterVolume;
                this.heartMovingAudio.loop = true;
                
                this.heartMovingAudio.addEventListener('ended', () => {
                    this.isHeartPlaying = false;
                });
                
                this.heartMovingAudio.play().then(() => {
                    this.isHeartPlaying = true;
                    console.log('ハート音のリピート再生を開始しました');
                }).catch(error => {
                    console.warn('heart_moving.mp3の再生に失敗しました:', error);
                    this.isHeartPlaying = false;
                });
            }
        } catch (error) {
            console.warn('heart_moving.mp3の読み込みに失敗しました:', error);
            this.isHeartPlaying = false;
        }
    }
    
    /**
     * ハート音のリピート再生停止
     */
    stopHeartMovingSound() {
        if (this.heartMovingAudio && this.isHeartPlaying) {
            try {
                this.heartMovingAudio.pause();
                this.heartMovingAudio.currentTime = 0;
                this.isHeartPlaying = false;
                console.log('ハート音のリピート再生を停止しました');
            } catch (error) {
                console.warn('ハート音の停止に失敗しました:', error);
            }
        }
    }
    
    /**
     * ボタンクリック音（button_pushed.mp3）
     */
    playButtonPushedSound() {
        if (!this.isEnabled) return;
        
        try {
            if (this.preloadedSounds.buttonPushed) {
                // プリロードされた音声を複製して再生（同時再生対応）
                const audio = this.preloadedSounds.buttonPushed.cloneNode();
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('button_pushed.mp3の再生に失敗しました:', error);
                });
            } else {
                // フォールバック：新しくAudioオブジェクトを作成
                const audio = new Audio('./sounds/button_pushed.mp3');
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('button_pushed.mp3の再生に失敗しました:', error);
                });
            }
        } catch (error) {
            console.warn('button_pushed.mp3の読み込みに失敗しました:', error);
        }
    }
    
    /**
     * ランク圏内入り音（rankin_gako.mp3）
     */
    playRankinGakoSound() {
        if (!this.isEnabled) return;
        
        try {
            if (this.preloadedSounds.rankinGako) {
                // プリロードされた音声を複製して再生（同時再生対応）
                const audio = this.preloadedSounds.rankinGako.cloneNode();
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('rankin_gako.mp3の再生に失敗しました:', error);
                });
            } else {
                // フォールバック：新しくAudioオブジェクトを作成
                const audio = new Audio('./sounds/rankin_gako.mp3');
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('rankin_gako.mp3の再生に失敗しました:', error);
                });
            }
        } catch (error) {
            console.warn('rankin_gako.mp3の読み込みに失敗しました:', error);
        }
    }
    
    /**
     * 正解音（answer_correct.mp3）
     */
    playAnswerCorrectSound() {
        if (!this.isEnabled) return;
        
        try {
            if (this.preloadedSounds.answerCorrect) {
                // プリロードされた音声を複製して再生（同時再生対応）
                const audio = this.preloadedSounds.answerCorrect.cloneNode();
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('answer_correct.mp3の再生に失敗しました:', error);
                });
            } else {
                // フォールバック：新しくAudioオブジェクトを作成
                const audioUrl = window.answerCorrectAudioUrl || './sounds/answer_correct.mp3';
                const audio = new Audio(audioUrl);
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('answer_correct.mp3の再生に失敗しました:', error);
                });
            }
        } catch (error) {
            console.warn('answer_correct.mp3の読み込みに失敗しました:', error);
        }
    }
    
    /**
     * 不正解音（answer_miss.mp3）
     */
    playAnswerMissSound() {
        if (!this.isEnabled) return;
        
        try {
            if (this.preloadedSounds.answerMiss) {
                // プリロードされた音声を複製して再生（同時再生対応）
                const audio = this.preloadedSounds.answerMiss.cloneNode();
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('answer_miss.mp3の再生に失敗しました:', error);
                });
            } else {
                // フォールバック：新しくAudioオブジェクトを作成
                const audioUrl = window.answerMissAudioUrl || './sounds/answer_miss.mp3';
                const audio = new Audio(audioUrl);
                audio.volume = this.masterVolume;
                audio.play().catch(error => {
                    console.warn('answer_miss.mp3の再生に失敗しました:', error);
                });
            }
        } catch (error) {
            console.warn('answer_miss.mp3の読み込みに失敗しました:', error);
        }
    }
}

// グローバルに公開
window.SlotAudio = SlotAudio;
