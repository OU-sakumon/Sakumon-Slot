import pandas as pd
import os
import sys
import argparse
import subprocess
import tempfile
import shutil
from pathlib import Path
import re

# ===== 設定 =====
WIDTH = 2000          # 画像の幅（ピクセル）
HEIGHT = 1600         # 画像の高さ（ピクセル）
DPI = 600            # 画像の解像度（高いほど高画質）

# ansシート用のサイズ設定
ANS_WIDTH = 1250      # ansシートの画像の幅（ピクセル）
ANS_HEIGHT = 1000     # ansシートの画像の高さ（ピクセル）

# 複数のシート・列セットを指定
# 各セットは (シート名, 開始列, 終了列) のタプル
# 終了列がNoneの場合は最後の列まで処理
SHEET_COLUMN_SETS = [
    ("Que_L","B","B"),
    ("Que_C","B","B"),
    ("Que_R","B","B"),
    ("Ans", "D", "G"),
    ("Ans", "I", "I"),
]

# 改行制御はTeXの自動改行機能を使用

# フォント設定（macOS用）
MAIN_FONT = "Hiragino Mincho ProN"  # メインフォント（明朝体）
# 他のフォント例:
# - "Hiragino Mincho ProN" (ヒラギノ明朝、数学問題に最適)
# - "Yu Mincho" (游明朝)
# - "MS Mincho" (MS明朝、Windows用)
# ================


class XlsxToTeXToPng:
    def __init__(self, input_file="スロット.xlsx", output_dir="output"):
        self.input_file = Path(input_file)
        self.output_dir = Path(output_dir)
        
        # 出力ディレクトリが存在しない場合は作成
        self.output_dir.mkdir(exist_ok=True)
        
        # 設定の妥当性チェック
        self.validate_config()
    
    def get_sheet_size(self, sheet_name):
        """
        シート名に応じて画像サイズを取得する
        
        Args:
            sheet_name (str): シート名
        
        Returns:
            tuple: (width, height) のタプル
        """
        if sheet_name.lower().startswith('ans'):
            return ANS_WIDTH, ANS_HEIGHT
        else:
            return WIDTH, HEIGHT
    
    def get_missing_rows(self, df, start_col_idx, end_col_idx, success_rows):
        """
        欠けている行番号を特定する
        
        Args:
            df (pandas.DataFrame): データフレーム
            start_col_idx (int): 開始列インデックス
            end_col_idx (int): 終了列インデックス
            success_rows (set): 成功した行番号のセット
        
        Returns:
            list: 欠けている行番号のリスト
        """
        missing_rows = []
        
        # 指定された列範囲でデータが存在する行を確認
        for row_idx in range(len(df)):
            has_data = False
            for col_idx in range(start_col_idx, end_col_idx):
                if col_idx < len(df.columns):
                    cell = df.iloc[row_idx, col_idx]
                    if not pd.isna(cell) and str(cell).strip() != "":
                        has_data = True
                        break
            
            if has_data and (row_idx + 1) not in success_rows:
                missing_rows.append(row_idx + 1)
        
        return missing_rows
    
    def validate_config(self):
        """設定の妥当性をチェックする"""
        if not SHEET_COLUMN_SETS:
            raise ValueError("SHEET_COLUMN_SETSが空です。少なくとも1つのシート・列セットを指定してください。")
        
        for i, (sheet_name, start_col, end_col) in enumerate(SHEET_COLUMN_SETS):
            if not sheet_name:
                raise ValueError(f"セット {i+1}: シート名が空です")
            
            # 列指定の妥当性チェック
            try:
                if start_col is not None:
                    self.column_to_index(start_col)
                if end_col is not None:
                    self.column_to_index(end_col)
            except ValueError as e:
                raise ValueError(f"セット {i+1}: {e}")
            
            # 開始列と終了列の順序チェック
            if start_col is not None and end_col is not None:
                start_idx = self.column_to_index(start_col)
                end_idx = self.column_to_index(end_col)
                if start_idx > end_idx:
                    raise ValueError(f"セット {i+1}: 開始列({start_col})が終了列({end_col})より後ろにあります")
    
    def column_to_index(self, column):
        """
        列指定を数値インデックスに変換する
        
        Args:
            column (str or int): 列指定（アルファベット: "A", "B", "C"... または数値: 0, 1, 2...）
        
        Returns:
            int: 0ベースの列インデックス
        """
        if column is None:
            return None
        
        if isinstance(column, int):
            return column
        
        if isinstance(column, str):
            # アルファベット列指定を数値に変換
            column = column.upper().strip()
            if not column.isalpha():
                raise ValueError(f"無効な列指定: {column}")
            
            result = 0
            for char in column:
                result = result * 26 + (ord(char) - ord('A') + 1)
            return result - 1  # 0ベースに変換
        
        raise ValueError(f"無効な列指定: {column}")
    
    def index_to_column(self, index):
        """
        数値インデックスをアルファベット列指定に変換する
        
        Args:
            index (int): 0ベースの列インデックス
        
        Returns:
            str: アルファベット列指定（"A", "B", "C"...）
        """
        if index is None:
            return None
        
        result = ""
        while index >= 0:
            result = chr(ord('A') + (index % 26)) + result
            index = index // 26 - 1
            if index < 0:
                break
        return result
    
    
    def get_xlsx_files(self):
        """指定されたxlsxファイルを取得"""
        if self.input_file.exists():
            return [self.input_file]
        else:
            print(f"エラー: ファイル '{self.input_file}' が見つかりません")
            return []
    
    def read_xlsx(self, file_path, sheet_name=0):
        """
        xlsxファイルを読み込む（空のセルに達したら処理終了）
        
        Args:
            file_path (str): xlsxファイルのパス
            sheet_name (int or str): シート名またはインデックス
        
        Returns:
            pandas.DataFrame: 読み込んだデータ
        """
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
            
            # 空のセルを検出して終了行を決定
            actual_end_row = 0
            for i in range(len(df)):
                # 行の全てのセルが空（NaN）かチェック
                row_data = df.iloc[i]
                if row_data.isna().all() or (row_data == '').all():
                    break
                actual_end_row = i + 1
            
            return df.iloc[0:actual_end_row]
        except Exception as e:
            print(f"エラー: xlsxファイルの読み込みに失敗しました: {e}")
            return None
    
    
    def cell_to_tex(self, cell_content):
        """
        単一セルの内容をTeX形式に変換する
        
        Args:
            cell_content (str): セルの内容
        
        Returns:
            str: TeX形式の文字列
        """
        if not cell_content or str(cell_content).strip() == "":
            return ""
        
        # 1) テキストのフォーマットを統一（\le→<、\ge→>）
        raw_content = self.unify_text_format(str(cell_content))
        
        # 2) セル内のリテラル "\\n" を実際の改行に変換
        raw_content = raw_content.replace('\\n', '\n')

        # 3) 行ごとに処理し、各行をTeXエスケープした上で結合（行末に強制改行 \\ を付与）
        lines = raw_content.splitlines()
        processed_lines = [self.process_cell_content(line) for line in lines]
        return "\\\\\n".join(processed_lines)
    
    def convert_cells_to_png(self, df, base_output_name, sheet_name, start_col, end_col, width=800, height=600):
        """
        DataFrameの各セルを個別のPNG画像に変換する
        
        Args:
            df (pandas.DataFrame): 変換するデータフレーム
            base_output_name (str): 出力ファイル名のベース
            sheet_name (str): シート名
            start_col (str or int): 開始列（アルファベット指定: A, B, C... または数値: 0, 1, 2...）
            end_col (str or int or None): 終了列（アルファベット指定: A, B, C... または数値: 0, 1, 2...、Noneの場合は最後の列まで）
            width (int): 画像の幅（ピクセル）
            height (int): 画像の高さ（ピクセル）
        
        Returns:
            int: 成功したセル数
        """
        if df is None or df.empty:
            return 0
        
        # シート名に応じてサイズを決定
        sheet_width, sheet_height = self.get_sheet_size(sheet_name)
        
        # 列の範囲を決定（アルファベット指定を数値に変換）
        start_col_idx = self.column_to_index(start_col) if start_col is not None else 0
        if end_col is not None:
            end_col_idx = self.column_to_index(end_col) + 1  # スライス用に+1
            end_col_idx = min(end_col_idx, len(df.columns))
        else:
            end_col_idx = len(df.columns)  # 最後の列まで
        
        
        # 指定された列の範囲でDataFrameをスライス
        df_filtered = df.iloc[:, start_col_idx:end_col_idx]
        
        
        # 出力フォルダを作成（シート名_列アルファベット）
        start_col_display = self.index_to_column(start_col_idx)
        if end_col is not None:
            end_col_display = self.index_to_column(self.column_to_index(end_col))
        else:
            end_col_display = self.index_to_column(len(df.columns) - 1)
        
        folder_name = f"{sheet_name}_{start_col_display}"
        output_folder = self.output_dir / folder_name
        
        # 既存のフォルダがある場合は削除
        if output_folder.exists():
            
            shutil.rmtree(output_folder)
        
        # 新しいフォルダを作成
        output_folder.mkdir(parents=True, exist_ok=True)
        
        
        success_count = 0
        success_rows = set()  # 成功した行番号を記録
        total_cells = df_filtered.size
        
        print(f"  列範囲 {start_col_display}-{end_col_display} の処理を開始... (サイズ: {sheet_width}x{sheet_height})")
        
        for row_idx, row in df_filtered.iterrows():
            for col_idx, cell in enumerate(row):
                if pd.isna(cell) or str(cell).strip() == "":
                    continue
                
                # セルをTeXに変換
                tex_content = self.cell_to_tex(cell)
                if not tex_content:
                    continue
                
                # 実際の列番号を計算（元のDataFrameでの列番号）
                actual_col_idx = start_col_idx + col_idx
                
                # 出力ファイル名を生成（行番号のみ）
                output_name = f"{row_idx+1}"
                output_path = output_folder / f"{output_name}.png"
                
                # TeXをPNGに変換（シート固有のサイズを使用）
                if self.tex_to_png(tex_content, output_path, sheet_width, sheet_height, DPI):
                    success_count += 1
                    success_rows.add(row_idx + 1)
        
        # 完了メッセージの詳細化
        # 指定された列範囲でデータが存在するセルの総数を計算
        total_items = 0
        for row_idx in range(len(df)):
            for col_idx in range(start_col_idx, end_col_idx):
                if col_idx < len(df.columns):
                    cell = df.iloc[row_idx, col_idx]
                    if not pd.isna(cell) and str(cell).strip() != "":
                        total_items += 1
        
        if success_count == total_items:
            print(f"  ✓ 列範囲 {start_col_display}-{end_col_display} 完了: {success_count}個のセルを変換（全{total_items}個）")
        else:
            missing_rows = self.get_missing_rows(df, start_col_idx, end_col_idx, success_rows)
            missing_info = f"欠けている行: {', '.join(map(str, missing_rows))}" if missing_rows else "欠けている行なし"
            print(f"  ✓ 列範囲 {start_col_display}-{end_col_display} 完了: {success_count}個のセルを変換（全{total_items}個中、{missing_info}）")
        
        return success_count
    
    def convert_single_column_range(self, df, base_output_name, sheet_name, start_col, end_col, width=800, height=600):
        """
        列範囲を処理し、各列ごとに個別のフォルダを作成する
        
        Args:
            df (pandas.DataFrame): 変換するデータフレーム
            base_output_name (str): 出力ファイル名のベース
            sheet_name (str): シート名
            start_col (str or int): 開始列
            end_col (str or int or None): 終了列
            width (int): 画像の幅（ピクセル）
            height (int): 画像の高さ（ピクセル）
        
        Returns:
            int: 成功したセル数
        """
        if df is None or df.empty:
            return 0
        
        # シート名に応じてサイズを決定
        sheet_width, sheet_height = self.get_sheet_size(sheet_name)
        
        # 列の範囲を決定
        start_col_idx = self.column_to_index(start_col) if start_col is not None else 0
        if end_col is not None:
            end_col_idx = self.column_to_index(end_col) + 1
            end_col_idx = min(end_col_idx, len(df.columns))
        else:
            end_col_idx = len(df.columns)
        
        total_success = 0
        
        # 各列を個別に処理
        for col_idx in range(start_col_idx, end_col_idx):
            col_display = self.index_to_column(col_idx)
            
            # フォルダ名を生成（シート名_列アルファベット）
            folder_name = f"{sheet_name}_{col_display}"
            output_folder = self.output_dir / folder_name
            
            # 既存のフォルダがある場合は削除
            if output_folder.exists():
                shutil.rmtree(output_folder)
            
            # 新しいフォルダを作成
            output_folder.mkdir(parents=True, exist_ok=True)
            
            # この列のデータを取得
            column_data = df.iloc[:, col_idx]
            
            success_count = 0
            success_rows = set()  # 成功した行番号を記録
            total_cells = len(column_data)
            
            print(f"  列 {col_display} の処理を開始... (サイズ: {sheet_width}x{sheet_height})")
            
            for row_idx, cell in enumerate(column_data):
                if pd.isna(cell) or str(cell).strip() == "":
                    continue
                
                # セルをTeXに変換
                tex_content = self.cell_to_tex(cell)
                if not tex_content:
                    continue
                
                # 出力ファイル名を生成（行番号のみ）
                output_name = f"{row_idx+1}"
                output_path = output_folder / f"{output_name}.png"
                
                # TeXをPNGに変換（シート固有のサイズを使用）
                if self.tex_to_png(tex_content, output_path, sheet_width, sheet_height, DPI):
                    success_count += 1
                    success_rows.add(row_idx + 1)
            
            # 完了メッセージの詳細化
            # この列でデータが存在するセルの総数を計算
            total_items = len([cell for cell in column_data if not pd.isna(cell) and str(cell).strip() != ""])
            
            if success_count == total_items:
                print(f"  ✓ 列 {col_display} 完了: {success_count}個のセルを変換（全{total_items}個）")
            else:
                missing_rows = [row_idx + 1 for row_idx, cell in enumerate(column_data) 
                               if not pd.isna(cell) and str(cell).strip() != "" and (row_idx + 1) not in success_rows]
                missing_info = f"欠けている行: {', '.join(map(str, missing_rows))}" if missing_rows else "欠けている行なし"
                print(f"  ✓ 列 {col_display} 完了: {success_count}個のセルを変換（全{total_items}個中、{missing_info}）")
            
            total_success += success_count
        
        return total_success
    
    
    
    
    
    def escape_tex_chars(self, text):
        """
        TeX特殊文字をエスケープする（関数名のバックスラッシュと数式内の記号は保護）
        
        Args:
            text (str): エスケープするテキスト
        
        Returns:
            str: エスケープされたテキスト
        """
        # まず関数名のバックスラッシュを保護
        protected_text = self.protect_function_backslashes(text)
        
        # 数式部分を一時的に保護
        math_parts = []
        temp_text = protected_text
        
        # 数式部分を抽出して保護
        for i, match in enumerate(re.finditer(r'\$[^$]+\$', temp_text)):
            placeholder = f"__MATH_PLACEHOLDER_{i}__"
            math_parts.append(match.group(0))
            temp_text = temp_text.replace(match.group(0), placeholder, 1)
        
        # テキスト部分のみをエスケープ
        special_chars = {
            '&': '\\&',
            '%': '\\%',
            '#': '\\#',
            '~': '\\textasciitilde{}',
            '^': '\\textasciicircum{}',
            '_': '\\_',
            '{': '\\{',
            '}': '\\}',
        }
        
        for char, replacement in special_chars.items():
            temp_text = temp_text.replace(char, replacement)
        
        # 保護した数式部分を復元
        for i, math_part in enumerate(math_parts):
            placeholder = f"__MATH_PLACEHOLDER_{i}__"
            temp_text = temp_text.replace(placeholder, math_part)
        
        return temp_text
    
    def protect_function_backslashes(self, text):
        """
        関数名のバックスラッシュを保護する
        
        Args:
            text (str): 処理するテキスト
        
        Returns:
            str: 関数名のバックスラッシュが保護されたテキスト
        """
        # 一般的な数学関数のリスト
        math_functions = [
            'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
            'arcsin', 'arccos', 'arctan', 'arccot', 'arcsec', 'arccsc',
            'sinh', 'cosh', 'tanh', 'coth', 'sech', 'csch',
            'log', 'ln', 'exp', 'sqrt', 'lim', 'max', 'min',
            'sum', 'prod', 'int', 'iint', 'iiint', 'oint',
            'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta',
            'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu',
            'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma',
            'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'
        ]
        
        protected_text = text
        
        # 各関数名のバックスラッシュを保護
        for func in math_functions:
            # 既にバックスラッシュが付いている関数名を保護
            pattern = rf'\\{func}\b'
            replacement = f'__PROTECTED_BACKSLASH_{func}__'
            protected_text = re.sub(pattern, replacement, protected_text)
        
        # 一般的なバックスラッシュをエスケープ（関数名以外）
        # 関数名のバックスラッシュは既に保護されているので、残りのバックスラッシュのみ処理
        protected_text = protected_text.replace('\\', '\\textbackslash{}')
        
        # 保護した関数名のバックスラッシュを復元
        for func in math_functions:
            replacement = f'__PROTECTED_BACKSLASH_{func}__'
            protected_text = protected_text.replace(replacement, f'\\{func}')
        
        return protected_text
    
    def protect_math_symbols(self, text):
        """
        数式内の記号（^, _）を保護する
        
        Args:
            text (str): 処理するテキスト
        
        Returns:
            str: 数式内の記号が保護されたテキスト
        """
        # 数式部分を一時的に保護
        math_parts = []
        protected_text = text
        
        # 数式部分を抽出して保護
        for i, match in enumerate(re.finditer(r'\$[^$]+\$', text)):
            placeholder = f"__MATH_SYMBOL_PLACEHOLDER_{i}__"
            math_parts.append(match.group(0))
            protected_text = protected_text.replace(match.group(0), placeholder, 1)
        
        # 保護した数式部分を復元
        for i, math_part in enumerate(math_parts):
            placeholder = f"__MATH_SYMBOL_PLACEHOLDER_{i}__"
            protected_text = protected_text.replace(placeholder, math_part)
        
        return protected_text
    
    def fix_math_content(self, math_content):
        """
        数式内容を修正する（関数名の後にスペースを追加、変数の補正など）
        
        Args:
            math_content (str): 数式内容（$を含む）
        
        Returns:
            str: 修正された数式内容
        """
        # 数式の内容部分を取得（$を除く）
        if math_content.startswith('$') and math_content.endswith('$'):
            inner_content = math_content[1:-1]
        else:
            inner_content = math_content
        
        # 1) 未バックスラッシュの関数名を補正（例: sinx -> \sin x, loga -> \log a）
        #   - sin, cos, tan は末尾が "h"（sinh, cosh, tanh）で始まる語は除外
        for func in ['sin', 'cos', 'tan']:
            pattern = rf'(?<!\\)\b{func}(?!h)'
            inner_content = re.sub(pattern, rf'\\{func}', inner_content)

        # よく使う他の関数（ハイパボリックでないもの）も補正
        for func in ['log', 'ln', 'exp']:
            pattern = rf'(?<!\\)\b{func}'
            inner_content = re.sub(pattern, rf'\\{func}', inner_content)

        # 2) 関数名の直後が変数・数字・別の制御綴（\\alpha など）の場合にスペースを補う
        space_fix_targets = ['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'sqrt', 'lim', 'max', 'min']
        for func in space_fix_targets:
            # 直後が英字/数字のとき（例: \\sinx, \\log10 -> それぞれ " ")
            inner_content = re.sub(rf'(\\{func})([A-Za-z0-9])', rf'\1 \2', inner_content)
            # 直後が別の制御綴（例: \\sin\\alpha -> "\\sin \\alpha"）
            inner_content = re.sub(rf'(\\{func})(\\[A-Za-z]+)', rf'\1 \2', inner_content)

        # 3) 変数の補正：数式内の単独の変数（x, y, z等）を適切に処理
        # ただし、既に$で囲まれている場合は除外
        inner_content = self.fix_variables_in_math(inner_content)

        # 4) よくあるUnicode記号をTeXに置換（数式内のみ）
        unicode_to_tex = {
            '×': r'\\times ',
            '·': r'\\cdot ',
            '∙': r'\\cdot ',
            '・': r'\\cdot ',
            '÷': r'\\div ',
            '±': r'\\pm ',
            '∓': r'\\mp ',
            '∞': r'\\infty ',
            'π': r'\\pi ',
            '≤': r'\\leq ',
            '≦': r'\\leq ',
            '≥': r'\\geq ',
            '≧': r'\\geq ',
            '≠': r'\\neq',
            '≈': r'\\approx ',
            '≒': r'\\simeq ',
            '→': r'\\to ',
            '←': r'\\leftarrow ',
            '↔': r'\\leftrightarrow ',
            '⇒': r'\\Rightarrow ',
            '⇔': r'\\Leftrightarrow ',
            '∈': r'\\in ',
            '∋': r'\\ni ',
            '⊂': r'\\subset ',
            '⊆': r'\\subseteq ',
            '⊃': r'\\supset ',
            '⊇': r'\\supseteq ',
            '∪': r'\\cup ',
            '∩': r'\\cap ',
            '°': r'^\\circ',
            '（': '(',
            '）': ')',
        }
        for uni, tex in unicode_to_tex.items():
            inner_content = inner_content.replace(uni, tex)

        # 元の形式に戻す
        if math_content.startswith('$') and math_content.endswith('$'):
            return f'${inner_content}$'
        else:
            return inner_content
    
    def fix_variables_in_math(self, math_content):
        """
        数式内の変数を適切に処理する
        
        Args:
            math_content (str): 数式内容（$を含まない）
        
        Returns:
            str: 修正された数式内容
        """
        # 一般的な変数名のリスト（数学でよく使われる変数）
        common_variables = ['x', 'y', 'z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w']
        
        # 数式内の変数を適切に処理
        # 変数が単独で存在し、前後に英数字や記号がない場合のみ処理
        for var in common_variables:
            # 変数が単独で存在する場合（前後に英数字や記号がない場合）
            # ただし、既にバックスラッシュで始まる場合は除外
            pattern = rf'(?<![A-Za-z0-9\\])\b{var}\b(?![A-Za-z0-9])'
            
            # 置換処理：変数をそのまま保持（数式内では変数はそのまま書く）
            # この関数では変数の補正は行わず、元の変数を保持
            pass
        
        return math_content
    
    def unify_text_format(self, text):
        """
        テキストのフォーマットを統一する（数式外のテキストのみ）
        \leを<に、\geを>に置換する
        \neqを≠（Unicode記号）に置換する
        
        Args:
            text (str): 処理するテキスト
        
        Returns:
            str: フォーマットが統一されたテキスト
        """
        # 数式部分を一時的に保護
        math_parts = []
        protected_text = text
        
        # 数式部分を抽出して保護
        for i, match in enumerate(re.finditer(r'\$[^$]+\$', text)):
            placeholder = f"__MATH_PLACEHOLDER_{i}__"
            math_parts.append(match.group(0))
            protected_text = protected_text.replace(match.group(0), placeholder, 1)
        
        # 数式外のテキストのみを処理
        # \leを<に置換
        protected_text = protected_text.replace('\\le', '<')
        # \geを>に置換
        protected_text = protected_text.replace('\\ge', '>')
        # \neqを≠（Unicode記号）に置換
        protected_text = protected_text.replace('\\neq', '≠')
        
        # 保護した数式部分を復元
        for i, math_part in enumerate(math_parts):
            placeholder = f"__MATH_PLACEHOLDER_{i}__"
            protected_text = protected_text.replace(placeholder, math_part)
        
        return protected_text

    def process_cell_content(self, text):
        """
        セルの内容を処理する
        数式部分（$...$で囲まれた部分）は保持し、それ以外をエスケープする
        TeXの自動改行機能を使用する
        
        Args:
            text (str): セルの内容
        
        Returns:
            str: 処理された文字列
        """
        # まず数式を修正
        text = re.sub(r'\$[^$]+\$', lambda m: self.fix_math_content(m.group(0)), text)
        
        # 数式でない部分で変数が単独で存在する場合の補正
        text = self.fix_standalone_variables(text)
        
        # テキスト部分をエスケープ（数式部分はそのまま）
        result = self.escape_text_parts(text)
        
        return result
    
    def escape_text_parts(self, text):
        """
        数式部分を保護しながら、テキスト部分のみをエスケープする
        
        Args:
            text (str): 処理するテキスト
        
        Returns:
            str: エスケープされたテキスト
        """
        # 数式部分を一時的に保護
        math_parts = []
        protected_text = text
        
        # 数式部分を抽出して保護（エスケープされないプレースホルダーを使用）
        for i, match in enumerate(re.finditer(r'\$[^$]+\$', text)):
            placeholder = f"@@MATHPLACEHOLDER{i}@@"
            math_parts.append(match.group(0))
            protected_text = protected_text.replace(match.group(0), placeholder, 1)
        
        # テキスト部分をエスケープ
        protected_text = self.escape_tex_chars(protected_text)
        
        # 保護した数式部分を復元
        for i, math_part in enumerate(math_parts):
            placeholder = f"@@MATHPLACEHOLDER{i}@@"
            protected_text = protected_text.replace(placeholder, math_part)
        
        return protected_text
    
    def fix_standalone_variables(self, text):
        """
        数式外で単独で存在する変数を適切に処理する
        
        Args:
            text (str): 処理するテキスト
        
        Returns:
            str: 修正されたテキスト
        """
        # 一般的な変数名のリスト
        common_variables = ['x', 'y', 'z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w']
        
        # 関数名として使われる可能性が高い文字を除外
        function_names = ['f', 'g', 'h']
        
        # 数式部分を一時的に保護
        math_parts = []
        protected_text = text
        
        # 数式部分を抽出して保護
        for i, match in enumerate(re.finditer(r'\$[^$]+\$', text)):
            placeholder = f"__MATH_PLACEHOLDER_{i}__"
            math_parts.append(match.group(0))
            protected_text = protected_text.replace(match.group(0), placeholder, 1)
        
        # 数式外の部分で変数を処理
        for var in common_variables:
            # 関数名として使われる可能性が高い場合は除外
            if var in function_names:
                # より厳密な条件：前が英字でない、後が英字・数字・括弧でない
                pattern = rf'(?<![A-Za-z0-9\\$]){var}(?![A-Za-z0-9\\$\(])'
            else:
                # 一般的な変数：前が英字でない、後が英字・数字でない
                pattern = rf'(?<![A-Za-z0-9\\$]){var}(?![A-Za-z0-9\\$])'
            
            protected_text = re.sub(pattern, f'${var}$', protected_text)
        
        # 保護した数式部分を復元
        for i, math_part in enumerate(math_parts):
            placeholder = f"__MATH_PLACEHOLDER_{i}__"
            protected_text = protected_text.replace(placeholder, math_part)
        
        return protected_text
    
    def tex_to_png(self, tex_content, output_path, width=400, height=300, dpi=600):
        """
        TeXコンテンツをPNG画像に変換する
        
        Args:
            tex_content (str): TeXコンテンツ
            output_path (str): 出力ファイルパス
            width (int): 画像の幅（ピクセル）
            height (int): 画像の高さ（ピクセル）
            dpi (int): 解像度
        """
        try:
            # 一時ディレクトリを作成
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # 完全なLaTeX文書を作成
                # standaloneクラスを使用して、コンテンツにぴったりのサイズで生成
                # 自動改行を有効にするため、minipage環境を使用
                full_tex = f"""
\\documentclass[border=10pt]{{standalone}}
\\usepackage{{amsmath}}
\\usepackage{{amsfonts}}
\\usepackage{{amssymb}}
\\usepackage{{fontspec}}
\\usepackage{{xcolor}}
\\usepackage{{varwidth}}
\\setmainfont{{{MAIN_FONT}}}
\\begin{{document}}
\\begin{{minipage}}{{\\textwidth}}
{tex_content}
\\end{{minipage}}
\\end{{document}}
"""
                
                # .texファイルを作成
                tex_file = temp_path / "temp.tex"
                with open(tex_file, 'w', encoding='utf-8') as f:
                    f.write(full_tex)
                
                # LaTeXをPDFにコンパイル（XeLaTeXを使用して日本語対応）
                latex_cmd = ["xelatex", "-interaction=nonstopmode", "-output-directory", str(temp_path), str(tex_file)]
                result = subprocess.run(latex_cmd, capture_output=True, text=True, cwd=temp_path)
                
                if result.returncode != 0:
                    print(f"エラー: LaTeXコンパイルに失敗しました: {result.stderr}")
                    return False
                
                # PDFをPNGに変換
                pdf_file = temp_path / "temp.pdf"
                if pdf_file.exists():
                    # ImageMagickを使用してPDFをPNGに変換
                    # 高解像度でPDFを読み込み、白背景で変換
                    convert_cmd = [
                        "magick",  # macOS用
                        "-density", str(dpi),
                        "-colorspace", "RGB",
                        "-background", "white",
                        "-alpha", "remove",
                        "-alpha", "off",
                        str(pdf_file),
                        "-quality", "100",
                        "-trim",  # 余白をトリミング
                        "+repage",
                        "-bordercolor", "white",
                        "-border", "20",  # 周囲に20pxの余白を追加
                        "-gravity", "center",
                        "-extent", f"{width}x{height}",  # 指定サイズに中央配置
                        str(output_path)
                    ]
                    
                    result = subprocess.run(convert_cmd, capture_output=True, text=True)
                    
                    # magickコマンドが失敗した場合、convertコマンドを試す
                    if result.returncode != 0:
                        convert_cmd = [
                            "convert",  # Linux用
                            "-density", str(dpi),
                            "-colorspace", "RGB",
                            "-background", "white",
                            "-alpha", "remove",
                            "-alpha", "off",
                            str(pdf_file),
                            "-quality", "100",
                            "-trim",
                            "+repage",
                            "-bordercolor", "white",
                            "-border", "20",
                            "-gravity", "center",
                            "-extent", f"{width}x{height}",
                            str(output_path)
                        ]
                        
                        result = subprocess.run(convert_cmd, capture_output=True, text=True)
                    
                    if result.returncode != 0:
                        print(f"エラー: ImageMagick変換に失敗しました: {result.stderr}")
                        return False
                    
                    return True
                else:
                    print("エラー: PDFファイルが生成されませんでした")
                    return False
                    
        except Exception as e:
            print(f"エラー: PNG変換に失敗しました: {e}")
            return False
    
    def convert_xlsx_to_png(self, xlsx_file=None, output_name=None):
        """
        xlsxファイルの各セルをPNG画像に変換する（複数シート・列セット対応）
        
        Args:
            xlsx_file (str): 入力xlsxファイル名（Noneの場合はself.input_fileを使用）
            output_name (str): 出力ファイル名（拡張子なし）
        """
        # 入力ファイルのパス
        if xlsx_file is None:
            input_path = self.input_file
        else:
            input_path = Path(xlsx_file)
        
        if not input_path.exists():
            print(f"エラー: ファイル '{input_path}' が見つかりません")
            return False
        
        # 出力ファイル名を決定
        if output_name is None:
            output_name = input_path.stem
        
        print(f"変換開始: {input_path}")
        print(f"処理セット: {len(SHEET_COLUMN_SETS)}個")
        for i, (sheet_name, start_col, end_col) in enumerate(SHEET_COLUMN_SETS, 1):
            print(f"  [{i}] シート: {sheet_name}, 列: {start_col} - {end_col if end_col else '最後'}")
        
        total_success = 0
        total_sets = len(SHEET_COLUMN_SETS)
        
        for i, (sheet_name, start_col, end_col) in enumerate(SHEET_COLUMN_SETS, 1):
            print(f"\n[{i}/{total_sets}] シート '{sheet_name}' の処理を開始...")
            
            # xlsxを読み込み
            df = self.read_xlsx(input_path, sheet_name)
            if df is None:
                print(f"✗ エラー: シート '{sheet_name}' の読み込みに失敗")
                continue
            
            # 列ごとに個別に処理
            success_count = self.convert_single_column_range(df, output_name, sheet_name, start_col, end_col)
            if success_count > 0:
                total_success += 1
                print(f"✓ シート '{sheet_name}' 完了")
        
        print(f"変換完了: {total_success}/{total_sets} セットが成功")
        return total_success > 0
    
    def process_all_files(self):
        """指定されたxlsxファイルを処理"""
        xlsx_files = self.get_xlsx_files()
        if not xlsx_files:
            print("エラー: 指定されたxlsxファイルが見つかりません")
            return False
        
        success_count = 0
        failed_files = []
        
        for i, xlsx_file in enumerate(xlsx_files, 1):
            # 出力ファイル名を決定
            output_name = xlsx_file.stem
            
            # 変換実行
            success = self.convert_xlsx_to_png(
                xlsx_file=xlsx_file,
                output_name=output_name
            )
            
            if success:
                success_count += 1
            else:
                failed_files.append(xlsx_file.name)
                print(f"✗ 失敗: {xlsx_file.name}")
        
        if failed_files:
            print(f"失敗したファイル: {', '.join(failed_files)}")
        
        return success_count > 0


def main():
    parser = argparse.ArgumentParser(description="スロット.xlsxファイルの各セルをPNG画像として出力する")
    parser.add_argument("--single", help="単一ファイル処理（ファイル名を指定）")
    
    args = parser.parse_args()
    
    # コンバーターを作成
    converter = XlsxToTeXToPng()
    
    if args.single:
        # 単一ファイル処理
        success = converter.convert_xlsx_to_png(
            xlsx_file=args.single,
            output_name=None
        )
    else:
        # 一括処理（デフォルト）
        success = converter.process_all_files()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
