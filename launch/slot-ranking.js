/**
 * 阪大作問サークルスロットのランキング機能（シンプル版）
 * ローカルストレージのみを使用
 */

class SlotRanking {
    constructor() {
        this.rankingKey = 'slotRanking';
        this.maxRankingEntries = 15; // ランキングの最大保存件数
        this.videoThreshold = 5; // 動画再生に必要な最小ランキング件数
        this.rankings = {
            correctAnswers: [],
            consecutiveAnswers: []
        };
        
        this.loadRankings();
    }
    
    /**
     * ランキングデータを読み込み
     */
    loadRankings() {
        try {
            const storedData = localStorage.getItem(this.rankingKey);
            
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                
                // データの整合性をチェック
                if (parsedData && typeof parsedData === 'object') {
                    this.rankings = {
                        correctAnswers: Array.isArray(parsedData.correctAnswers) ? parsedData.correctAnswers : [],
                        consecutiveAnswers: Array.isArray(parsedData.consecutiveAnswers) ? parsedData.consecutiveAnswers : []
                    };
                } else {
                    console.warn('無効なランキングデータ形式です。デフォルト値を使用します。');
                    this.rankings = {
                        correctAnswers: [],
                        consecutiveAnswers: []
                    };
                }
            } else {
                this.rankings = {
                    correctAnswers: [],
                    consecutiveAnswers: []
                };
            }
        } catch (error) {
            console.error('ランキングデータの読み込みに失敗:', error);
            // エラー時はデフォルト値を使用
            this.rankings = {
                correctAnswers: [],
                consecutiveAnswers: []
            };
        }
    }
    
    /**
     * ランキングデータを保存
     */
    saveRankings() {
        try {
            const dataToSave = JSON.stringify(this.rankings);
            localStorage.setItem(this.rankingKey, dataToSave);
        } catch (error) {
            console.error('ランキングデータの保存に失敗:', error);
        }
    }
    
    /**
     * 正解数ランキングに追加
     */
    addCorrectAnswersEntry(playerName, correctAnswers, totalQuestions, accuracy) {
        const entry = {
            playerName: playerName,
            correctAnswers: correctAnswers,
            totalQuestions: totalQuestions,
            accuracy: accuracy,
            timestamp: new Date().toISOString()
        };
        
        // 一時的にエントリを追加してランクを計算
        const tempRankings = [...this.rankings.correctAnswers, entry];
        tempRankings.sort((a, b) => {
            if (b.correctAnswers !== a.correctAnswers) {
                return b.correctAnswers - a.correctAnswers;
            }
            return b.accuracy - a.accuracy;
        });
        
        // 実際のランクを計算
        const rank = tempRankings.findIndex(e => 
            e.playerName === playerName && e.timestamp === entry.timestamp
        ) + 1;
        
        // ランキングに追加
        this.rankings.correctAnswers.push(entry);
        this.rankings.correctAnswers.sort((a, b) => {
            if (b.correctAnswers !== a.correctAnswers) {
                return b.correctAnswers - a.correctAnswers;
            }
            return b.accuracy - a.accuracy;
        });
        
        this.rankings.correctAnswers = this.rankings.correctAnswers.slice(0, this.maxRankingEntries);
        this.saveRankings();
        
        return {
            isRanked: rank <= this.maxRankingEntries,
            rank: rank,
            entry: entry
        };
    }
    
    /**
     * 連続正解数ランキングに追加
     */
    addConsecutiveAnswersEntry(playerName, consecutiveAnswers, totalQuestions, accuracy) {
        const entry = {
            playerName: playerName,
            consecutiveAnswers: consecutiveAnswers,
            totalQuestions: totalQuestions,
            accuracy: accuracy,
            timestamp: new Date().toISOString()
        };
        
        // 一時的にエントリを追加してランクを計算
        const tempRankings = [...this.rankings.consecutiveAnswers, entry];
        tempRankings.sort((a, b) => {
            if (b.consecutiveAnswers !== a.consecutiveAnswers) {
                return b.consecutiveAnswers - a.consecutiveAnswers;
            }
            return b.accuracy - a.accuracy;
        });
        
        // 実際のランクを計算
        const rank = tempRankings.findIndex(e => 
            e.playerName === playerName && e.timestamp === entry.timestamp
        ) + 1;
        
        // ランキングに追加
        this.rankings.consecutiveAnswers.push(entry);
        this.rankings.consecutiveAnswers.sort((a, b) => {
            if (b.consecutiveAnswers !== a.consecutiveAnswers) {
                return b.consecutiveAnswers - a.consecutiveAnswers;
            }
            return b.accuracy - a.accuracy;
        });
        
        this.rankings.consecutiveAnswers = this.rankings.consecutiveAnswers.slice(0, this.maxRankingEntries);
        this.saveRankings();
        
        return {
            isRanked: rank <= this.maxRankingEntries,
            rank: rank,
            entry: entry
        };
    }
    
    /**
     * 正解数ランキングを取得
     */
    getCorrectAnswersRanking() {
        return this.rankings.correctAnswers;
    }
    
    /**
     * 連続正解数ランキングを取得
     */
    getConsecutiveAnswersRanking() {
        return this.rankings.consecutiveAnswers;
    }
    
    /**
     * 正解数ランキングの上位5位以内に入るかチェック（動画再生用）
     * 動画再生条件：ランキングが5件埋まっていて、かつ5位以内にランクインする時のみ
     */
    isCorrectAnswersTop5(correctAnswers) {
        if (this.rankings.correctAnswers.length < this.videoThreshold) {
            return false;
        }
        
        if (correctAnswers <= 0) {
            return false;
        }
        
        const fifthScore = this.rankings.correctAnswers[this.videoThreshold - 1].correctAnswers;
        return correctAnswers > fifthScore;
    }
    
    /**
     * 連続正解数ランキングの上位5位以内に入るかチェック（動画再生用）
     * 動画再生条件：ランキングが5件埋まっていて、かつ5位以内にランクインする時のみ
     */
    isConsecutiveAnswersTop5(consecutiveAnswers) {
        if (this.rankings.consecutiveAnswers.length < this.videoThreshold) {
            return false;
        }
        
        if (consecutiveAnswers <= 0) {
            return false;
        }
        
        const fifthScore = this.rankings.consecutiveAnswers[this.videoThreshold - 1].consecutiveAnswers;
        return consecutiveAnswers > fifthScore;
    }
    
    /**
     * ランキングデータをクリア
     */
    clearRankings() {
        // メモリ上のデータをクリア
        this.rankings = {
            correctAnswers: [],
            consecutiveAnswers: []
        };
        
        // ローカルストレージからも完全に削除
        try {
            localStorage.removeItem(this.rankingKey);
            
            const keyAfter = localStorage.getItem(this.rankingKey);
            
            if (keyAfter === null) {
                // 削除成功
            } else {
                console.warn('⚠️ ローカルストレージからの削除が不完全な可能性があります');
            }
        } catch (error) {
            console.error('❌ ローカルストレージからの削除に失敗:', error);
            throw error;
        }
    }
    
    /**
     * 最新のランキングデータを強制読み込み
     */
    refreshRankings() {
        this.loadRankings();
    }

    /**
     * ランキングデータをエクスポート
     */
    exportRankings() {
        try {
            const exportData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                rankings: this.rankings,
                statistics: {
                    correctAnswersCount: this.rankings.correctAnswers.length,
                    consecutiveAnswersCount: this.rankings.consecutiveAnswers.length
                }
            };
            
            const jsonString = JSON.stringify(exportData, null, 2);
            return jsonString;
        } catch (error) {
            console.error('エクスポートに失敗:', error);
            return null;
        }
    }
    
    /**
     * ランキングデータをインポート
     */
    importRankings(jsonData) {
        try {
            const importData = JSON.parse(jsonData);
            if (importData.rankings) {
                this.rankings = {
                    correctAnswers: importData.rankings.correctAnswers || [],
                    consecutiveAnswers: importData.rankings.consecutiveAnswers || []
                };
                this.saveRankings();
                return true;
            }
        } catch (error) {
            console.error('インポートに失敗:', error);
        }
        return false;
    }
    
    /**
     * 正解数ランキングで一位かどうかを判定（新規スコアが1位になるかチェック）
     * @param {number} correctAnswers - 正解数
     * @returns {boolean} 一位かどうか
     */
    isCorrectAnswersFirst(correctAnswers) {
        // ランキングが空の場合は自動的に1位
        if (this.rankings.correctAnswers.length === 0) {
            return true;
        }
        
        const topEntry = this.rankings.correctAnswers[0];
        // 現在のトップスコアより高いか、同じなら1位
        return correctAnswers >= topEntry.correctAnswers;
    }
    
    /**
     * 連続正解数ランキングで一位かどうかを判定（新規スコアが1位になるかチェック）
     * @param {number} consecutiveAnswers - 連続正解数
     * @returns {boolean} 一位かどうか
     */
    isConsecutiveAnswersFirst(consecutiveAnswers) {
        // ランキングが空の場合は自動的に1位
        if (this.rankings.consecutiveAnswers.length === 0) {
            return true;
        }
        
        const topEntry = this.rankings.consecutiveAnswers[0];
        // 現在のトップスコアより高いか、同じなら1位
        return consecutiveAnswers >= topEntry.consecutiveAnswers;
    }
}

// グローバルに公開
window.SlotRanking = SlotRanking;