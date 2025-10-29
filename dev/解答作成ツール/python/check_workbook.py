#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excelファイルの基本構造チェック機能
シートの存在と列名のチェックのみを行う
"""

import openpyxl
import sys
import json

def check_workbook_structure(file_path):
    """
    Excelファイルの基本構造をチェックする
    
    Args:
        file_path: チェックするExcelファイルのパス
        
    Returns:
        dict: チェック結果
        {
            "valid": bool,
            "errors": list,
            "warnings": list
        }
    """
    errors = []
    warnings = []
    
    try:
        workbook = openpyxl.load_workbook(file_path)
    except Exception as e:
        return {
            "valid": False,
            "errors": [f"Excelファイルを開けませんでした: {str(e)}"],
            "warnings": []
        }
    
    # 必要なシートのリスト
    required_sheets = ['Que_L', 'Que_C', 'Que_R', 'Ans', 'LC', 'LR', 'CR']
    
    # シートの存在チェック
    existing_sheets = workbook.sheetnames
    missing_sheets = [sheet for sheet in required_sheets if sheet not in existing_sheets]
    
    if missing_sheets:
        errors.append(f"必要なシートが見つかりません: {', '.join(missing_sheets)}")
    
    # 各シートの列名チェック
    for sheet_name in required_sheets:
        if sheet_name in existing_sheets:
            sheet_errors = check_sheet_headers(workbook[sheet_name], sheet_name)
            errors.extend(sheet_errors)
    
    # 結果の判定
    valid = len(errors) == 0
    
    return {
        "valid": valid,
        "errors": errors,
        "warnings": warnings
    }

def check_sheet_headers(sheet, sheet_name):
    """
    シートの列名をチェックする
    
    Args:
        sheet: openpyxlのシートオブジェクト
        sheet_name: シート名
        
    Returns:
        list: エラーメッセージのリスト
    """
    errors = []
    
    if sheet_name in ['Que_L', 'Que_C', 'Que_R']:
        # Queシートの列名チェック
        if sheet['A1'].value != 'type':
            errors.append(f"{sheet_name}シートのA1セル: 'type'である必要があります（現在: {sheet['A1'].value}）")
        if sheet['B1'].value != 'question':
            errors.append(f"{sheet_name}シートのB1セル: 'question'である必要があります（現在: {sheet['B1'].value}）")
    
    elif sheet_name == 'Ans':
        # Ansシートの列名チェック
        expected_headers = ['row_L', 'row_C', 'row_R', 'ans', 'lie_answer1', 'lie_answer2', 'lie_answer3', 'question']
        
        for i, expected in enumerate(expected_headers):
            cell_address = f'{chr(65+i)}1'
            actual_value = sheet[cell_address].value
            if actual_value != expected:
                errors.append(f"{sheet_name}シートの{cell_address}セル: '{expected}'である必要があります（現在: {actual_value}）")
    
    elif sheet_name in ['LC', 'LR', 'CR']:
        # 制約シートの列名チェック
        if sheet_name == 'LC':
            if sheet['A1'].value != 'type_L':
                errors.append(f"{sheet_name}シートのA1セル: 'type_L'である必要があります（現在: {sheet['A1'].value}）")
            if sheet['B1'].value != 'type_C':
                errors.append(f"{sheet_name}シートのB1セル: 'type_C'である必要があります（現在: {sheet['A1'].value}）")
        elif sheet_name == 'LR':
            if sheet['A1'].value != 'type_L':
                errors.append(f"{sheet_name}シートのA1セル: 'type_L'である必要があります（現在: {sheet['A1'].value}）")
            if sheet['B1'].value != 'type_R':
                errors.append(f"{sheet_name}シートのB1セル: 'type_R'である必要があります（現在: {sheet['B1'].value}）")
        elif sheet_name == 'CR':
            if sheet['A1'].value != 'type_C':
                errors.append(f"{sheet_name}シートのA1セル: 'type_C'である必要があります（現在: {sheet['A1'].value}）")
            if sheet['B1'].value != 'type_R':
                errors.append(f"{sheet_name}シートのB1セル: 'type_R'である必要があります（現在: {sheet['B1'].value}）")
    
    return errors

def main():
    """
    コマンドラインから実行された場合の処理
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            "valid": False,
            "errors": ["ファイルパスが指定されていません"],
            "warnings": []
        }))
        sys.exit(1)
    
    file_path = sys.argv[1]
    result = check_workbook_structure(file_path)
    
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
