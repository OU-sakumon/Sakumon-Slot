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
        // ランキングが5件埋まっていない場合は動画再生なし
        if (this.rankings.correctAnswers.length < this.videoThreshold) {
            console.log(`❌ 正解数ランキングが埋まっていないため動画なし (現在: ${this.rankings.correctAnswers.length}件/${this.videoThreshold}件必要)`);
            return false;
        }
        
        // スコアが0以下の場合はランクイン対象外
        if (correctAnswers <= 0) {
            console.log('❌ 正解数が0以下のためランクイン対象外');
            return false;
        }
        
        // ランキングが5件以上ある場合、5位のスコアと比較
        const fifthScore = this.rankings.correctAnswers[this.videoThreshold - 1].correctAnswers;
        const isRanked = correctAnswers > fifthScore;
        console.log(`正解数ランクインチェック: ${correctAnswers} vs 5位 ${fifthScore} = ${isRanked ? '✅ランクイン（動画再生）' : '❌ランクイン圏外'}`);
        return isRanked;
    }
    
    /**
     * 連続正解数ランキングの上位5位以内に入るかチェック（動画再生用）
     * 動画再生条件：ランキングが5件埋まっていて、かつ5位以内にランクインする時のみ
     */
    isConsecutiveAnswersTop5(consecutiveAnswers) {
        // ランキングが5件埋まっていない場合は動画再生なし
        if (this.rankings.consecutiveAnswers.length < this.videoThreshold) {
            console.log(`❌ 連続正解数ランキングが埋まっていないため動画なし (現在: ${this.rankings.consecutiveAnswers.length}件/${this.videoThreshold}件必要)`);
            return false;
        }
        
        // スコアが0以下の場合はランクイン対象外
        if (consecutiveAnswers <= 0) {
            console.log('❌ 連続正解数が0以下のためランクイン対象外');
            return false;
        }
        
        // ランキングが5件以上ある場合、5位のスコアと比較
        const fifthScore = this.rankings.consecutiveAnswers[this.videoThreshold - 1].consecutiveAnswers;
        const isRanked = consecutiveAnswers > fifthScore;
        console.log(`連続正解数ランクインチェック: ${consecutiveAnswers} vs 5位 ${fifthScore} = ${isRanked ? '✅ランクイン（動画再生）' : '❌ランクイン圏外'}`);
        return isRanked;
    }
    
    /**
     * ランキングデータをクリア
     */
    clearRankings() {
        console.log('ランキングデータクリア処理を開始...');
        
        // メモリ上のデータをクリア
        this.rankings = {
            correctAnswers: [],
            consecutiveAnswers: []
        };
        console.log('メモリ上のランキングデータをクリアしました:', this.rankings);
        
        // ローカルストレージからも完全に削除
        try {
            const keyBefore = localStorage.getItem(this.rankingKey);
            console.log('削除前のローカルストレージデータ:', keyBefore);
            
            localStorage.removeItem(this.rankingKey);
            
            const keyAfter = localStorage.getItem(this.rankingKey);
            console.log('削除後のローカルストレージデータ:', keyAfter);
            
            if (keyAfter === null) {
                console.log('✅ ローカルストレージからランキングデータを完全に削除しました');
            } else {
                console.warn('⚠️ ローカルストレージからの削除が不完全な可能性があります');
            }
        } catch (error) {
            console.error('❌ ローカルストレージからの削除に失敗:', error);
            throw error; // エラーを上位に伝播させる
        }
        
        console.log('ランキングデータクリア処理が完了しました');
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
            // エクスポート前に最新データを強制読み込み（クリア後は不要）
            // this.refreshRankings(); // コメントアウト：クリア後に復活するのを防ぐ
            
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