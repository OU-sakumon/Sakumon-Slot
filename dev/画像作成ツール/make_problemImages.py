import pandas as pd
import subprocess
import tempfile
import os
import sys
import argparse
import shutil
from pathlib import Path
import re
from pdf2image import convert_from_path
from PIL import Image

# ===== 設定 =====
WIDTH = 600          # 画像の幅（ピクセル）
HEIGHT = 480         # 画像の高さ（ピクセル）

# ansシート用のサイズ設定
ANS_WIDTH = 600      # ansシートの画像の幅（ピクセル）
ANS_HEIGHT = 450     # ansシートの画像の高さ（ピクセル）

# 複数のシート・列セットを指定
# 各セットは (シート名, 開始列, 終了列) のタプル
# 終了列がNoneの場合は最後の列まで処理
SHEET_COLUMN_SETS = [
    ("Que_L","B","B"),
    ("Que_C","B","B"),
    ("Que_R","B","B"),
    ("Ans", "D", "F"),
    ("Ans", "I", "I"),
]

# フォント設定（macOS用）
MAIN_FONT = "Hiragino Mincho ProN"  # メインフォント（明朝体）
FONT_SIZE = "80pt"  # フォントサイズ（10pt, 11pt, 12pt, 14pt, 17pt, 20ptなど）
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
        
        # 1) テキストのフォーマットを統一（\le→<、\ge→>、\neq→≠、\n→\n）
        #    (数式保護ロジックを含む unify_text_format を使用)
        raw_content = self.unify_text_format(str(cell_content))
        
        # 2) Unicodeエスケープシーケンスを実際の改行に変換
        raw_content = raw_content.replace('_x000D_', '\r')
        raw_content = raw_content.replace('_x000A_', '\n')
        
        # 3) 数式の$記号の対応をチェック・修正
        raw_content = self.fix_math_delimiters(raw_content)
        
        # 4) 全体を一度に処理してから行ごとに分割
        processed_content = self.process_cell_content(raw_content)
        
        # 5) 行ごとに分割して結合（行末に強制改行 \\ を付与）
        lines = processed_content.splitlines()
        return "\\\\\n".join(lines)
    
    def unify_text_format(self, text):
        """
        テキストのフォーマットを統一する（数式外のテキストのみ）
        \\leを<に、\\geを>に置換する
        \\neqを≠（Unicode記号）に置換する
        \\n（リテラル）を \n（改行文字）に置換する
        
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
        # \neqを≠（Unicode記号）に置換（数式内は既に保護済み）
        protected_text = protected_text.replace('\\neq', '≠')
        
        # \n（リテラル）を \n（改行文字）に置換
        # (\neq などは既に ≠ に置換されているか、数式として保護されているため影響を受けない)
        protected_text = protected_text.replace('\\n', '\n')
        
        # 保護した数式部分を復元
        for i, math_part in enumerate(math_parts):
            placeholder = f"__MATH_PLACEHOLDER_{i}__"
            protected_text = protected_text.replace(placeholder, math_part)
        
        return protected_text
    
    def fix_math_delimiters(self, text):
        """
        数式の$記号の対応をチェック・修正する
        
        Args:
            text (str): 処理するテキスト
        
        Returns:
            str: 修正されたテキスト
        """
        # $記号の数をカウント
        dollar_count = text.count('$')
        
        # $記号の数が奇数の場合、最後に$を追加
        if dollar_count % 2 != 0:
            print(f"警告: 数式の$記号が対応していません。自動修正します: '{text[:50]}...'")
            text = text + '$'
        
        return text

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
        # まず数式を修正（正規表現を修正）
        # 数式を検索して置換
        def replace_math(match):
            return self.fix_math_content(match.group(0))
        
        # 正規表現で数式を検索して置換
        text = re.sub(r'\$[^$]+?\$', replace_math, text)
        
        # テキスト部分をエスケープ（数式部分はそのまま）
        result = self.escape_text_parts(text)
        
        return result
    
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
        for func in ['sin', 'cos', 'tan']:
            pattern = rf'(?<!\\)\b{func}(?!h)'
            inner_content = re.sub(pattern, rf'\\{func}', inner_content)
        
        # 1.5) \d を \displaystyle に変換
        inner_content = re.sub(r'\\d\b', r'\\displaystyle', inner_content)

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
            # \displaystyle, \text などの特殊なコマンドは除外
            inner_content = re.sub(rf'(\\{func})(\\(?!displaystyle|text|mathrm|mathbb|d\b)[A-Za-z]+)', rf'\1 \2', inner_content)

        # 3) よくあるUnicode記号をTeXに置換（数式内のみ）
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
            '≤': r'\\leqq ',
            '≦': r'\\leqq ',
            '≥': r'\\geq ',
            '≧': r'\\geq ',
            '≠': r'\\neq ',
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
        
        # 4) 基本的なクリーンアップのみ（TeXコンパイラに任せる）
        # 連続するスペースを整理
        inner_content = re.sub(r'\s+', ' ', inner_content)
        
        # 5) 日本語文字を\text{}で囲む
        # 数式内の日本語文字を検出して\text{}で囲む
        inner_content = re.sub(r'([ひらがなカタカナ漢字]+)', r'\\text{\1}', inner_content)
        
        # 元の形式に戻す
        if math_content.startswith('$') and math_content.endswith('$'):
            return f'${inner_content}$'
        else:
            return inner_content
    
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
        
        # テキスト部分のみをエスケープ（数式部分は既に保護済み）
        protected_text = self.escape_tex_chars_direct(protected_text)
        
        # 保護した数式部分を復元
        for i, math_part in enumerate(math_parts):
            placeholder = f"@@MATHPLACEHOLDER{i}@@"
            protected_text = protected_text.replace(placeholder, math_part)
        
        return protected_text
    
    def escape_tex_chars_direct(self, text):
        """
        数式部分が既に保護されたテキストに対して、テキスト部分のみをエスケープする
        
        Args:
            text (str): 数式部分が既に保護されたテキスト
        
        Returns:
            str: エスケープされたテキスト
        """
        # 関数名のバックスラッシュを保護
        protected_text = self.protect_function_backslashes(text)
        
        # テキスト部分のみをエスケープ
        special_chars = {
            '&': '\\&',
            '%': '\\%',
            '#': '\\#',
            '~': '\\textasciitilde{}',
            '{': '\\{',
            '}': '\\}',
        }
        
        for char, replacement in special_chars.items():
            protected_text = protected_text.replace(char, replacement)
        
        # ^ と _ は数式外でのみエスケープ（数式内ではそのまま使用）
        # 数式外の ^ を \textasciicircum に変換
        protected_text = re.sub(r'([^$]*?)\^([^$]*?)(?=\$|$)', r'\1\\textasciicircum{}\2', protected_text)
        protected_text = re.sub(r'([^$]*?)_([^$]*?)(?=\$|$)', r'\1\\_\2', protected_text)
        
        return protected_text
    
    def escape_tex_chars(self, text):
        """
        TeX特殊文字をエスケープする（関数名のバックスラッシュと数式内の記号は保護）
        
        Args:
            text (str): エスケープするテキスト
        
        Returns:
            str: エスケープされたテキスト
        """
        # まず数式部分を保護（関数名のバックスラッシュ保護より先に）
        math_parts = []
        temp_text = text
        
        # 数式部分を抽出して保護
        for i, match in enumerate(re.finditer(r'\$[^$]+\$', temp_text)):
            placeholder = f"__MATH_PLACEHOLDER_{i}__"
            math_parts.append(match.group(0))
            temp_text = temp_text.replace(match.group(0), placeholder, 1)
        
        # 関数名のバックスラッシュを保護
        temp_text = self.protect_function_backslashes(temp_text)
        
        # テキスト部分のみをエスケープ
        special_chars = {
            '&': '\\&',
            '%': '\\%',
            '#': '\\#',
            '~': '\\textasciitilde{}',
            '{': '\\{',
            '}': '\\}',
        }
        
        for char, replacement in special_chars.items():
            temp_text = temp_text.replace(char, replacement)
        
        # ^ と _ は数式外でのみエスケープ（数式内ではそのまま使用）
        # 数式外の ^ を \textasciicircum に変換
        temp_text = re.sub(r'([^$]*?)\^([^$]*?)(?=\$|$)', r'\1\\textasciicircum{}\2', temp_text)
        temp_text = re.sub(r'([^$]*?)_([^$]*?)(?=\$|$)', r'\1\\_\2', temp_text)
        
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
        # 一般的な数学関数と記号のリスト
        math_functions = [
            'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
            'arcsin', 'arccos', 'arctan', 'arccot', 'arcsec', 'arccsc',
            'sinh', 'cosh', 'tanh', 'coth', 'sech', 'csch',
            'log', 'ln', 'exp', 'sqrt', 'lim', 'max', 'min',
            'sum', 'prod', 'int', 'iint', 'iiint', 'oint',
            'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta',
            'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu',
            'nu', 'xi', 'omicron', 'pi', 'rho', 'sigma',
            'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
            # 数学記号
            'neq', 'leq', 'geq', 'approx', 'simeq', 'to', 'leftarrow', 
            'rightarrow', 'leftrightarrow', 'Rightarrow', 'Leftrightarrow',
            'in', 'ni', 'subset', 'subseteq', 'supset', 'supseteq',
            'cup', 'cap', 'times', 'div', 'pm', 'mp', 'infty',
            'quad', 'qquad', 'hspace', 'vspace', 'ldots', 'cdots', 'vdots', 'ddots',
            # LaTeXコマンド
            'displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle',
            'text', 'mathrm', 'mathbb', 'mathcal', 'mathsf', 'mathtt',
            'mathit', 'mathbf', 'boldsymbol', 'vec', 'hat', 'bar',
            'par',  # 段落区切り
            'd',  # 微分のd
            # 特殊文字のエスケープ
            '%', '&', '#', '_', '{', '}', '$'
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

    def convert_tex_to_png(self, tex_content, output_png_path, width, height):
        """
        TeXの文字列を指定した幅と高さのPNG画像に変換します。

        Args:
            tex_content (str): \\documentclassなどを含む完全なTeXコード。
            output_png_path (str): 保存するPNGファイルへのパス。
            width (int): 出力PNGの幅 (ピクセル)。
            height (int): 出力PNGの高さ (ピクセル)。
        """
        
        # 一時ディレクトリで作業
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_tex_file = os.path.join(temp_dir, "input.tex")
            temp_pdf_file = os.path.join(temp_dir, "input.pdf")
            
            # 1. TeXファイルを作成
            # standaloneクラスは、内容に合わせた最小限のページサイズを生成するのに役立ちます
            full_tex_content = f"""
\\documentclass[border=10pt,{FONT_SIZE}]{{standalone}}
\\usepackage{{amsmath}}
\\usepackage{{amssymb}}
\\usepackage{{graphicx}}
\\usepackage{{fontspec}}
\\usepackage{{varwidth}}
\\usepackage[legacycolonsymbols]{{mathtools}}
\\setmainfont{{{MAIN_FONT}}}
\\renewcommand{{\\d}}{{\\displaystyle}}
\\begin{{document}}
\\begin{{varwidth}}{{\\textwidth}}
{tex_content}
\\end{{varwidth}}
\\end{{document}}
"""
            
            with open(temp_tex_file, 'w', encoding='utf-8') as f:
                f.write(full_tex_content)
            
                
            # 2. TeX を PDF にコンパイル (pdflatex)
            # -output-directory で一時ディレクトリに出力
            # -interaction=nonstopmode でエラーがあっても停止しない
            try:
                result = subprocess.run(
                    ["xelatex", "-interaction=nonstopmode", "-output-directory", temp_dir, temp_tex_file],
                    check=True,
                    capture_output=True,
                    text=True,
                    encoding='utf-8',
                    errors='replace'
                )
            except subprocess.CalledProcessError as e:
                print(f"エラー: xelatexの実行に失敗しました。")
                print(f"エラー詳細: {e}")
                print("TeX Live または MiKTeX がインストールされ、PATHが通っているか確認してください。")
                return False
            except FileNotFoundError as e:
                print(f"エラー: xelatexが見つかりません。")
                print(f"エラー詳細: {e}")
                print("TeX Live または MiKTeX がインストールされ、PATHが通っているか確認してください。")
                return False

            # 3. PDF を PNG に変換 (pdf2image)
            # 適切なDPIで変換（高DPIで生成してからリサイズ）
            try:
                # 高DPIで変換してからリサイズ
                target_dpi = 300  # 高品質な変換のためのDPI
                images = convert_from_path(
                    temp_pdf_file,
                    dpi=target_dpi,
                    fmt="png",
                    single_file=True # 複数ページの場合でも最初のページのみ
                )
                
                if images:
                    # 元の画像を取得
                    original_image = images[0]
                    original_width, original_height = original_image.size
                    
                    # アスペクト比を保持しながら、指定サイズに収まるようにリサイズ
                    # ただし、元のサイズより大きくしない
                    scale_factor = min(width / original_width, height / original_height, 1.0)
                    
                    if scale_factor < 1.0:
                        # 元のサイズが指定サイズより大きい場合は縮小
                        new_width = int(original_width * scale_factor)
                        new_height = int(original_height * scale_factor)
                        resized_image = original_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    else:
                        # 元のサイズが指定サイズ以下の場合はそのまま
                        resized_image = original_image
                        new_width, new_height = original_width, original_height
                    
                    # 白い背景の新しい画像を作成
                    new_image = Image.new('RGB', (width, height), 'white')
                    
                    # 中央に配置
                    x_offset = (width - new_width) // 2
                    y_offset = (height - new_height) // 2
                    new_image.paste(resized_image, (x_offset, y_offset))
                    
                    new_image.save(output_png_path, "PNG")
                    
                    return True
                else:
                    print("エラー: PDFから画像への変換に失敗しました。")
                    return False
                    
            except Exception as e:
                print(f"エラー: pdf2imageの実行に失敗しました。 {e}")
                print("Popplerが正しくインストールされているか確認してください。")
                return False

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
                try:
                    tex_content = self.cell_to_tex(cell)
                    if not tex_content:
                        continue
                    
                    # 出力ファイル名を生成（行番号のみ）
                    output_name = f"{row_idx+1}"
                    output_path = output_folder / f"{output_name}.png"
                    
                    # TeXをPNGに変換（シート固有のサイズを使用）
                    if self.convert_tex_to_png(tex_content, output_path, sheet_width, sheet_height):
                        success_count += 1
                        success_rows.add(row_idx + 1)
                    else:
                        print(f"  ✗ 行{row_idx+1}の変換に失敗: '{str(cell)[:50]}...'")
                        
                except Exception as e:
                    print(f"  ✗ 行{row_idx+1}の処理中にエラー: {e}")
                    print(f"    セル内容: '{str(cell)[:100]}...'")
                    continue
            
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
        if not self.input_file.exists():
            print(f"エラー: ファイル '{self.input_file}' が見つかりません")
            return False
        
        # 変換実行
        success = self.convert_xlsx_to_png(
            xlsx_file=self.input_file,
            output_name=self.input_file.stem
        )
        
        return success


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
