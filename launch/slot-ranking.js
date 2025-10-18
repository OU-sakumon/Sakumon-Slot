/**
 * 阪大作問サークルスロットのランキング機能（シンプル版）
 * ローカルストレージのみを使用
 */

class SlotRanking {
    constructor() {
        this.rankingKey = 'slotRanking';
        this.maxRankingEntries = 15;
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
            console.log('ローカルストレージから取得したデータ:', storedData);
            
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                
                // データの整合性をチェック
                if (parsedData && typeof parsedData === 'object') {
                    this.rankings = {
                        correctAnswers: Array.isArray(parsedData.correctAnswers) ? parsedData.correctAnswers : [],
                        consecutiveAnswers: Array.isArray(parsedData.consecutiveAnswers) ? parsedData.consecutiveAnswers : []
                    };
                    console.log('ランキングデータを読み込みました:', this.rankings);
                } else {
                    console.warn('無効なランキングデータ形式です。デフォルト値を使用します。');
                    this.rankings = {
                        correctAnswers: [],
                        consecutiveAnswers: []
                    };
                }
            } else {
                console.log('ローカルストレージにランキングデータがありません。デフォルト値を使用します。');
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
            console.log('保存するランキングデータ:', this.rankings);
            console.log('保存するJSONデータ:', dataToSave);
            
            localStorage.setItem(this.rankingKey, dataToSave);
            console.log('ランキングデータを保存しました');
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
        
        this.rankings.correctAnswers.push(entry);
        this.rankings.correctAnswers.sort((a, b) => {
            if (b.correctAnswers !== a.correctAnswers) {
                return b.correctAnswers - a.correctAnswers;
            }
            return b.accuracy - a.accuracy;
        });
        
        this.rankings.correctAnswers = this.rankings.correctAnswers.slice(0, this.maxRankingEntries);
        this.saveRankings();
        
        const rank = this.rankings.correctAnswers.findIndex(e => 
            e.playerName === playerName && e.timestamp === entry.timestamp
        ) + 1;
        
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
        
        this.rankings.consecutiveAnswers.push(entry);
        this.rankings.consecutiveAnswers.sort((a, b) => {
            if (b.consecutiveAnswers !== a.consecutiveAnswers) {
                return b.consecutiveAnswers - a.consecutiveAnswers;
            }
            return b.accuracy - a.accuracy;
        });
        
        this.rankings.consecutiveAnswers = this.rankings.consecutiveAnswers.slice(0, this.maxRankingEntries);
        this.saveRankings();
        
        const rank = this.rankings.consecutiveAnswers.findIndex(e => 
            e.playerName === playerName && e.timestamp === entry.timestamp
        ) + 1;
        
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
     * 正解数ランキングの上位5位以内に入るかチェック
     */
    isCorrectAnswersTop5(correctAnswers) {
        if (this.rankings.correctAnswers.length < this.maxRankingEntries) {
            return true;
        }
        const lowestScore = this.rankings.correctAnswers[this.maxRankingEntries - 1].correctAnswers;
        return correctAnswers > lowestScore;
    }
    
    /**
     * 連続正解数ランキングの上位5位以内に入るかチェック
     */
    isConsecutiveAnswersTop5(consecutiveAnswers) {
        if (this.rankings.consecutiveAnswers.length < this.maxRankingEntries) {
            return true;
        }
        const lowestScore = this.rankings.consecutiveAnswers[this.maxRankingEntries - 1].consecutiveAnswers;
        return consecutiveAnswers > lowestScore;
    }
    
    /**
     * ランキングデータをクリア
     */
    clearRankings() {
        this.rankings = {
            correctAnswers: [],
            consecutiveAnswers: []
        };
        this.saveRankings();
        console.log('ランキングデータをクリアしました');
    }
    
    /**
     * 最新のランキングデータを強制読み込み
     */
    refreshRankings() {
        console.log('ランキングデータを最新状態に更新中...');
        this.loadRankings();
        console.log('更新後のランキングデータ:', this.rankings);
    }

    /**
     * ランキングデータをエクスポート
     */
    exportRankings() {
        try {
            // エクスポート前に最新データを強制読み込み
            this.refreshRankings();
            
            // デバッグ用：現在のランキングデータをコンソールに出力
            console.log('エクスポート対象のランキングデータ:', this.rankings);
            
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
            console.log('エクスポート用JSONデータ:', jsonString);
            
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
                console.log('ランキングデータをインポートしました');
                return true;
            }
        } catch (error) {
            console.error('インポートに失敗:', error);
        }
        return false;
    }
    
    /**
     * 正解数ランキングで一位かどうかを判定
     * @param {number} correctAnswers - 正解数
     * @returns {boolean} 一位かどうか
     */
    isCorrectAnswersFirst(correctAnswers) {
        if (this.rankings.correctAnswers.length === 0) {
            return false;
        }
        
        const topEntry = this.rankings.correctAnswers[0];
        return topEntry.correctAnswers === correctAnswers;
    }
    
    /**
     * 連続正解数ランキングで一位かどうかを判定
     * @param {number} consecutiveAnswers - 連続正解数
     * @returns {boolean} 一位かどうか
     */
    isConsecutiveAnswersFirst(consecutiveAnswers) {
        if (this.rankings.consecutiveAnswers.length === 0) {
            return false;
        }
        
        const topEntry = this.rankings.consecutiveAnswers[0];
        return topEntry.consecutiveAnswers === consecutiveAnswers;
    }
}

// グローバルに公開
window.SlotRanking = SlotRanking;