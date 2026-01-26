// ==UserScript==
// @name         北森工资单数据导出
// @namespace    https://github.com/amorphobia/tampermonkey-scripts
// @version      3.8
// @description  从北森工资单网页提取数据并导出
// @author       amorphobia
// @match        https://*/*
// @icon         https://www.beisen.com/favicon.ico
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @downloadURL  https://github.com/amorphobia/tampermonkey-scripts/raw/refs/heads/master/beisen-compensation-export.user.js
// @updateURL    https://github.com/amorphobia/tampermonkey-scripts/raw/refs/heads/master/beisen-compensation-export.user.js
// ==/UserScript==

(function() {
    'use strict';

    let isExtracting = false;

    // 创建toast消息
    function showToast(message, type = 'info', duration = 3000) {
        // 创建toast容器（如果不存在）
        let toastContainer = document.getElementById('payslip-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'payslip-toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999999;
                pointer-events: none;
            `;
            document.body.appendChild(toastContainer);
        }

        // 创建toast元素
        const toast = document.createElement('div');
        const bgColors = {
            success: '#28a745',
            error: '#dc3545',
            info: '#17a2b8',
            warning: '#ffc107'
        };
        
        toast.style.cssText = `
            background: ${bgColors[type] || bgColors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            font-weight: 500;
            max-width: 300px;
            word-wrap: break-word;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            pointer-events: auto;
        `;
        toast.textContent = message;

        // 添加到容器
        toastContainer.appendChild(toast);

        // 触发动画
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);

        // 自动移除
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // 注册菜单命令
    function registerMenuCommands() {
        GM_registerMenuCommand('👁️ 预览和导出数据', previewData);
        GM_registerMenuCommand('ℹ️ 关于脚本', showAbout);
    }

    // 检查是否包含工资单数据
    function hasPayslipData() {
        // 首先检查DOM元素
        if (document.querySelector('.salary-detail-wrap') || 
            document.querySelector('.salary-right-item')) {
            return true;
        }
        
        // 安全地检查文本内容
        const textContent = document.textContent || document.body?.textContent || '';
        return textContent.includes('工资详情') ||
               textContent.includes('实发工资') ||
               textContent.includes('税前收入') ||
               textContent.includes('社保福利');
    }

    // 格式化年月显示
    function formatYearMonth(year, month) {
        if (!year && !month) return '';
        if (!year) return month ? `${month}月` : '';
        if (!month) return `${year}年`;
        return `${year}年${month}月`;
    }

    // 格式化月份为两位数（用于文件名）
    function formatMonthForFilename(month) {
        if (!month) return 'unknown';
        const monthNum = parseInt(month);
        return isNaN(monthNum) ? month : monthNum.toString().padStart(2, '0');
    }

    // 数字格式化函数
    function parseNumericValue(value) {
        if (!value || typeof value !== 'string') {
            return value;
        }
        
        // 移除所有非数字字符（保留小数点和负号）
        const cleanValue = value.replace(/[^\d.-]/g, '');
        
        // 如果清理后的值为空或只包含非数字字符，返回原值
        if (!cleanValue || cleanValue === '-' || cleanValue === '.') {
            return value;
        }
        
        // 尝试转换为数字
        const numValue = parseFloat(cleanValue);
        
        // 如果转换成功且不是NaN，返回数字；否则返回原字符串
        return !isNaN(numValue) ? numValue : value;
    }

    // 判断字段是否应该转换为数字
    function shouldConvertToNumber(fieldName) {
        const numericFields = [
            '基本工资', '本月基本工资', '应发工资', '实发工资', '税前收入',
            '养老保险', '医疗保险', '失业保险', '住房公积金', '工伤保险', '生育保险',
            '个人社保公积金合计', '公司社保公积金合计',
            '工资个税', '个人所得税', '税收',
            '综合补助', '津贴', '奖金', '补贴', '扣款'
        ];
        
        // 检查字段名是否包含数字相关的关键词
        return numericFields.some(keyword => fieldName.includes(keyword)) ||
               /工资|收入|保险|公积金|个税|税收|补助|津贴|奖金|补贴|扣款|金额/.test(fieldName);
    }

    // 提取工资单数据
    function extractPayslipData() {
        console.log('开始提取数据...');
        
        const data = {
            extractTime: new Date().toISOString(),
            extractDate: new Date().toLocaleDateString('zh-CN'),
            year: null,
            month: null,
            employeeInfo: {},
            preTaxIncome: {},
            socialSecurity: {},
            incomeTax: {},
            netPay: {},
            summary: {}
        };

        try {
            // 检查是否在工资单页面
            if (!hasPayslipData()) {
                throw new Error('当前页面不包含工资单数据，请确保已登录并加载了工资单内容');
            }

            console.log('页面验证通过，开始提取具体数据...');

            // 提取年份和月份
            const yearElement = document.querySelector('.search-year span') || 
                               document.querySelector('.salary-year-select span');
            if (yearElement) {
                const yearText = yearElement.textContent.trim();
                data.year = parseNumericValue(yearText);
                console.log('提取到年份:', data.year);
            }

            const monthElement = document.querySelector('.salary-item-current .salary-item-month') ||
                                document.querySelector('.salary-left .salary-item-month');
            if (monthElement) {
                const monthText = monthElement.textContent.trim();
                // 将"1月"转换为数字1
                const monthMatch = monthText.match(/(\d+)月/);
                data.month = monthMatch ? parseInt(monthMatch[1]) : monthText;
                console.log('提取到月份:', data.month, '(原文本:', monthText + ')');
            }

            // 提取各个部分的数据
            const sections = [
                { key: 'employeeInfo', name: '员工信息' },
                { key: 'preTaxIncome', name: '税前收入' },
                { key: 'socialSecurity', name: '社保福利' },
                { key: 'incomeTax', name: '所得税' },
                { key: 'netPay', name: '实发金额' }
            ];

            sections.forEach(section => {
                console.log(`正在提取 ${section.name}...`);
                const sectionElement = Array.from(document.querySelectorAll('.salary-right-item')).find(item => 
                    item.querySelector('.right-filed-name')?.textContent.includes(section.name));
                
                if (sectionElement) {
                    const items = sectionElement.querySelectorAll('.salary-list-item');
                    items.forEach(item => {
                        const title = item.querySelector('.salary-list-item--text')?.textContent.trim();
                        const value = item.querySelector('.salary-list-item--number')?.textContent.trim();
                        if (title && value) {
                            // 根据字段名决定是否转换为数字
                            const processedValue = shouldConvertToNumber(title) ? parseNumericValue(value) : value;
                            data[section.key][title] = processedValue;
                            
                            if (typeof processedValue === 'number') {
                                console.log(`${title}: ${value} -> ${processedValue} (转换为数字)`);
                            }
                        }
                    });
                    console.log(`${section.name} 提取完成，项目数:`, Object.keys(data[section.key]).length);
                }
            });

            // 如果没有找到实发金额，尝试从左侧获取
            if (Object.keys(data.netPay).length === 0) {
                const netSalaryElement = document.querySelector('.salary-month-filed-num');
                if (netSalaryElement) {
                    const value = netSalaryElement.textContent.trim();
                    data.netPay['实发工资'] = parseNumericValue(value);
                    console.log('从左侧提取到实发工资:', data.netPay['实发工资']);
                }
            }

            // 生成汇总信息
            data.summary = {
                totalItems: Object.keys(data.employeeInfo).length + 
                           Object.keys(data.preTaxIncome).length + 
                           Object.keys(data.socialSecurity).length + 
                           Object.keys(data.incomeTax).length + 
                           Object.keys(data.netPay).length,
                hasEmployeeInfo: Object.keys(data.employeeInfo).length > 0,
                hasPreTaxIncome: Object.keys(data.preTaxIncome).length > 0,
                hasSocialSecurity: Object.keys(data.socialSecurity).length > 0,
                hasIncomeTax: Object.keys(data.incomeTax).length > 0,
                hasNetPay: Object.keys(data.netPay).length > 0
            };

            console.log('数据提取完成，总项目数:', data.summary.totalItems);

        } catch (error) {
            console.error('提取数据时出错:', error);
            throw new Error('提取数据失败: ' + error.message);
        }

        return data;
    }

    // 预览数据
    function previewData() {
        if (isExtracting) {
            showNotification('正在处理中，请稍候...', 'info');
            return;
        }

        isExtracting = true;
        try {
            const data = extractPayslipData();
            
            // 在控制台显示数据
            console.log('提取的数据:', data);
            
            // 显示预览界面，包含下载功能
            showPreviewWithDownload(data);
            
        } catch (error) {
            console.error('预览数据时出错:', error);
            showNotification('预览失败: ' + error.message, 'error');
        } finally {
            isExtracting = false;
        }
    }

    // 显示预览界面，包含下载功能
    function showPreviewWithDownload(data) {
        // 尝试打开新窗口
        let previewWindow;
        try {
            previewWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
        } catch (error) {
            console.warn('无法打开新窗口，可能被浏览器阻止:', error);
        }
        
        // 如果无法打开新窗口，使用当前页面显示
        if (!previewWindow || previewWindow.closed) {
            showPreviewInCurrentPage(data);
            return;
        }
        
        // 检查窗口是否有效
        if (!previewWindow.document) {
            console.warn('新窗口无效，使用当前页面显示预览');
            previewWindow.close();
            showPreviewInCurrentPage(data);
            return;
        }
        
        // 在新窗口中写入HTML内容
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>工资单数据预览和导出</title>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
                    .container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #333; text-align: center; margin-bottom: 30px; }
                    
                    .header-section { margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #ddd; }
                    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 20px; }
                    .stat-item { text-align: center; padding: 15px; background: white; border-radius: 5px; border: 1px solid #ddd; }
                    .stat-number { font-size: 24px; font-weight: bold; color: #007bff; }
                    .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
                    
                    .export-buttons { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
                    .btn { padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; font-weight: bold; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: all 0.3s; }
                    .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
                    .btn-primary { background: #007bff; color: white; }
                    .btn-success { background: #28a745; color: white; }
                    .btn-secondary { background: #6c757d; color: white; }
                    .btn-info { background: #17a2b8; color: white; }
                    
                    .section { margin-bottom: 25px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
                    .section-title { font-weight: bold; font-size: 16px; padding: 15px; color: white; margin: 0; }
                    .section-content { padding: 20px; background: white; }
                    .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                    .item:last-child { border-bottom: none; }
                    .key { font-weight: normal; color: #666; }
                    .value { font-weight: bold; color: #333; }
                    
                    .json-section { background: #f8f9fa; }
                    .json-content { background: white; padding: 20px; border-radius: 5px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-wrap: break-word; max-height: 400px; }
                    
                    .employee-info { background: #007bff; }
                    .pretax-income { background: #28a745; }
                    .social-security { background: #ffc107; }
                    .income-tax { background: #dc3545; }
                    .net-pay { background: #17a2b8; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📊 工资单数据预览和导出</h1>
                    
                    <div class="header-section">
                        <div class="stats">
                            <div class="stat-item">
                                <div class="stat-number">${data.summary.totalItems}</div>
                                <div class="stat-label">总项目数</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${formatYearMonth(data.year, data.month)}</div>
                                <div class="stat-label">年月</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${data.extractDate}</div>
                                <div class="stat-label">提取日期</div>
                            </div>
                        </div>
                        
                        <div class="export-buttons">
                            <button class="btn btn-info" onclick="downloadHTML()">📄 导出HTML文件</button>
                            <button class="btn btn-primary" onclick="downloadJSON()">📄 下载JSON文件</button>
                            <button class="btn btn-success" onclick="copyJSON()">📋 复制JSON数据</button>
                            <button class="btn btn-secondary" onclick="copyText()">📝 复制文本摘要</button>
                        </div>
                    </div>
        `);

        // 添加各个数据部分
        const sections = [
            { key: 'employeeInfo', title: '👤 员工信息', className: 'employee-info' },
            { key: 'preTaxIncome', title: '💰 税前收入', className: 'pretax-income' },
            { key: 'socialSecurity', title: '🛡️ 社保福利', className: 'social-security' },
            { key: 'incomeTax', title: '🧾 所得税', className: 'income-tax' },
            { key: 'netPay', title: '💵 实发金额', className: 'net-pay' }
        ];

        sections.forEach(section => {
            if (Object.keys(data[section.key]).length > 0) {
                previewWindow.document.write(`
                    <div class="section">
                        <h3 class="section-title ${section.className}">${section.title}</h3>
                        <div class="section-content">
                `);
                
                Object.entries(data[section.key]).forEach(([key, value]) => {
                    previewWindow.document.write(`
                        <div class="item">
                            <span class="key">${key}</span>
                            <span class="value">${value}</span>
                        </div>
                    `);
                });
                
                previewWindow.document.write(`
                        </div>
                    </div>
                `);
            }
        });

        // 添加JSON数据部分和JavaScript功能
        previewWindow.document.write(`
                    <div class="section json-section">
                        <h3 class="section-title" style="background: #6c757d;">🔍 完整JSON数据</h3>
                        <div class="section-content">
                            <div class="json-content" id="jsonContent">${JSON.stringify(data, null, 2)}</div>
                        </div>
                    </div>
                </div>
                
                <script>
                    const jsonData = ${JSON.stringify(data, null, 2)};
                    const filename = '工资单_${data.year || 'unknown'}_${formatMonthForFilename(data.month)}.json';
                    const htmlFilename = '工资单_${data.year || 'unknown'}_${formatMonthForFilename(data.month)}.html';
                    
                    // 格式化年月显示
                    function formatYearMonth(year, month) {
                        if (!year && !month) return '';
                        if (!year) return month ? month + '月' : '';
                        if (!month) return year + '年';
                        return year + '年' + month + '月';
                    }
                    
                    // 格式化月份为两位数（用于文件名）
                    function formatMonthForFilename(month) {
                        if (!month) return 'unknown';
                        const monthNum = parseInt(month);
                        return isNaN(monthNum) ? month : monthNum.toString().padStart(2, '0');
                    }
                    
                    // 创建toast消息
                    function showToast(message, type = 'info', duration = 3000) {
                        // 创建toast容器（如果不存在）
                        let toastContainer = document.getElementById('payslip-toast-container');
                        if (!toastContainer) {
                            toastContainer = document.createElement('div');
                            toastContainer.id = 'payslip-toast-container';
                            toastContainer.style.cssText = \`
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                z-index: 999999;
                                pointer-events: none;
                            \`;
                            document.body.appendChild(toastContainer);
                        }

                        // 创建toast元素
                        const toast = document.createElement('div');
                        const bgColors = {
                            success: '#28a745',
                            error: '#dc3545',
                            info: '#17a2b8',
                            warning: '#ffc107'
                        };
                        
                        toast.style.cssText = \`
                            background: \${bgColors[type] || bgColors.info};
                            color: white;
                            padding: 12px 20px;
                            border-radius: 6px;
                            margin-bottom: 10px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                            font-size: 14px;
                            font-weight: 500;
                            max-width: 300px;
                            word-wrap: break-word;
                            opacity: 0;
                            transform: translateX(100%);
                            transition: all 0.3s ease;
                            pointer-events: auto;
                        \`;
                        toast.textContent = message;

                        // 添加到容器
                        toastContainer.appendChild(toast);

                        // 触发动画
                        setTimeout(() => {
                            toast.style.opacity = '1';
                            toast.style.transform = 'translateX(0)';
                        }, 10);

                        // 自动移除
                        setTimeout(() => {
                            toast.style.opacity = '0';
                            toast.style.transform = 'translateX(100%)';
                            setTimeout(() => {
                                if (toast.parentNode) {
                                    toast.parentNode.removeChild(toast);
                                }
                            }, 300);
                        }, duration);
                    }
                    
                    function downloadHTML() {
                        try {
                            const htmlContent = generatePayslipHTML(jsonData);
                            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = htmlFilename;
                            a.style.display = 'none';
                            
                            document.body.appendChild(a);
                            a.click();
                            
                            setTimeout(() => {
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }, 100);
                            
                            showToast('HTML文件下载已开始！', 'success');
                        } catch (error) {
                            console.error('HTML导出失败:', error);
                            showToast('HTML导出失败: ' + error.message, 'error');
                        }
                    }
                    
                    function generatePayslipHTML(data) {
                        return \`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>工资单 - \${formatYearMonth(data.year, data.month)}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
            background: #f8f9fa;
            color: #2c3e50;
            line-height: 1.6;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 300;
            margin-bottom: 8px;
        }
        
        .header .period {
            font-size: 18px;
            opacity: 0.9;
        }
        
        .content {
            padding: 0;
        }
        
        .section {
            border-bottom: 1px solid #e9ecef;
        }
        
        .section:last-child {
            border-bottom: none;
        }
        
        .section-header {
            background: #f8f9fa;
            padding: 20px 30px;
            border-left: 4px solid;
            font-weight: 600;
            font-size: 16px;
            color: #495057;
        }
        
        .section-header.employee { border-left-color: #6c757d; }
        .section-header.income { border-left-color: #28a745; }
        .section-header.social { border-left-color: #ffc107; color: #856404; }
        .section-header.tax { border-left-color: #dc3545; }
        .section-header.net { border-left-color: #007bff; }
        
        .section-content {
            padding: 0;
        }
        
        .data-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 30px;
            border-bottom: 1px solid #f1f3f4;
            transition: background-color 0.2s ease;
        }
        
        .data-row:hover {
            background-color: #f8f9fa;
        }
        
        .data-row:last-child {
            border-bottom: none;
        }
        
        .data-label {
            color: #6c757d;
            font-weight: 500;
        }
        
        .data-value {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .data-value.number {
            font-family: 'Consolas', 'Monaco', monospace;
            color: #495057;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
        }
        
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
            .data-row:hover { background-color: transparent; }
        }
        
        @media (max-width: 768px) {
            .container { margin: 10px; border-radius: 8px; }
            .header { padding: 20px; }
            .header h1 { font-size: 24px; }
            .section-header, .data-row, .footer { padding: 15px 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>工资单</h1>
            <div class="period">\${formatYearMonth(data.year, data.month)}</div>
        </div>
        
        <div class="content">
            \${generateSectionHTML('employee', '👤 员工信息', data.employeeInfo)}
            \${generateSectionHTML('income', '💰 税前收入', data.preTaxIncome)}
            \${generateSectionHTML('social', '🛡️ 社保福利', data.socialSecurity)}
            \${generateSectionHTML('tax', '🧾 所得税', data.incomeTax)}
            \${generateSectionHTML('net', '💵 实发金额', data.netPay)}
        </div>
        
        <div class="footer">
            生成时间：\${new Date().toLocaleString('zh-CN')}
        </div>
    </div>
</body>
</html>\`;
                    }
                    
                    function generateSectionHTML(className, title, sectionData) {
                        if (!sectionData || Object.keys(sectionData).length === 0) {
                            return '';
                        }
                        
                        const rows = Object.entries(sectionData).map(([key, value]) => {
                            const isNumber = typeof value === 'number';
                            const displayValue = isNumber ? value.toLocaleString('zh-CN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            }) : value;
                            
                            return \`
                                <div class="data-row">
                                    <span class="data-label">\${key}</span>
                                    <span class="data-value \${isNumber ? 'number' : ''}">\${displayValue}</span>
                                </div>
                            \`;
                        }).join('');
                        
                        return \`
                            <div class="section">
                                <div class="section-header \${className}">\${title}</div>
                                <div class="section-content">
                                    \${rows}
                                </div>
                            </div>
                        \`;
                    }
                    
                    function downloadJSON() {
                        try {
                            const jsonString = JSON.stringify(jsonData, null, 2);
                            const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            a.style.display = 'none';
                            
                            document.body.appendChild(a);
                            a.click();
                            
                            setTimeout(() => {
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }, 100);
                            
                            showToast('JSON文件下载已开始！', 'success');
                        } catch (error) {
                            console.error('下载失败:', error);
                            showToast('下载失败，请尝试复制数据: ' + error.message, 'error');
                            copyJSON();
                        }
                    }
                    
                    function copyJSON() {
                        const jsonString = JSON.stringify(jsonData, null, 2);
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(jsonString).then(() => {
                                showToast('JSON数据已复制到剪贴板！', 'success');
                            }).catch(error => {
                                console.error('复制失败:', error);
                                fallbackCopy(jsonString);
                            });
                        } else {
                            fallbackCopy(jsonString);
                        }
                    }
                    
                    function copyText() {
                        let summary = '工资单数据摘要\\n==================\\n';
                        summary += '年月: ${formatYearMonth(data.year, data.month)}\\n';
                        summary += '提取日期: ${data.extractDate}\\n';
                        summary += '总项目数: ${data.summary.totalItems}\\n\\n';
                        
                        const sections = [
                            { key: 'employeeInfo', title: '员工信息' },
                            { key: 'preTaxIncome', title: '税前收入' },
                            { key: 'socialSecurity', title: '社保福利' },
                            { key: 'incomeTax', title: '所得税' },
                            { key: 'netPay', title: '实发金额' }
                        ];
                        
                        sections.forEach(section => {
                            if (Object.keys(jsonData[section.key]).length > 0) {
                                summary += section.title + ':\\n';
                                Object.entries(jsonData[section.key]).forEach(([key, value]) => {
                                    summary += '  ' + key + ': ' + value + '\\n';
                                });
                                summary += '\\n';
                            }
                        });
                        
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(summary).then(() => {
                                showToast('文本摘要已复制到剪贴板！', 'success');
                            }).catch(error => {
                                console.error('复制失败:', error);
                                fallbackCopy(summary);
                            });
                        } else {
                            fallbackCopy(summary);
                        }
                    }
                    
                    function fallbackCopy(text) {
                        const textArea = document.createElement('textarea');
                        textArea.value = text;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        textArea.style.top = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        
                        try {
                            document.execCommand('copy');
                            showToast('数据已复制到剪贴板！', 'success');
                        } catch (error) {
                            showToast('复制失败，请手动选择文本复制', 'error');
                        }
                        
                        document.body.removeChild(textArea);
                    }
                </script>
            </body>
            </html>
        `);
        
        previewWindow.document.close();
        showNotification('数据预览已在新窗口打开', 'success');
    }

    // 在当前页面显示预览（备选方案）
    function showPreviewInCurrentPage(data) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            width: 95%;
            max-width: 900px;
            max-height: 95%;
            overflow: auto;
            border-radius: 8px;
            padding: 20px;
            position: relative;
        `;

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #333;">📊 工资单数据预览</h2>
                <button id="closeBtn" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">❌ 关闭</button>
            </div>
            
            <div style="text-align: center; margin-bottom: 20px; padding: 15px; background: #fff3cd; border-radius: 5px; border: 1px solid #ffeaa7;">
                <strong>⚠️ 注意：</strong> 由于浏览器限制，无法打开新窗口。在当前页面的下载功能可能受到限制。<br>
                建议允许弹窗后重新尝试，或使用复制功能。
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 20px;">
                <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #ddd;">
                    <div style="font-size: 20px; font-weight: bold; color: #007bff;">${data.summary.totalItems}</div>
                    <div style="font-size: 12px; color: #666;">总项目数</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #ddd;">
                    <div style="font-size: 20px; font-weight: bold; color: #28a745;">${formatYearMonth(data.year, data.month)}</div>
                    <div style="font-size: 12px; color: #666;">年月</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #ddd;">
                    <div style="font-size: 20px; font-weight: bold; color: #17a2b8;">${data.extractDate}</div>
                    <div style="font-size: 12px; color: #666;">提取日期</div>
                </div>
            </div>

            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; justify-content: center;">
                <button id="downloadHtmlBtn" style="background: #17a2b8; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">📄 导出HTML</button>
                <button id="copyJsonBtn" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">📋 复制JSON</button>
                <button id="copyTextBtn" style="background: #6c757d; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">📝 复制文本</button>
            </div>
            
            <div style="max-height: 400px; overflow: auto; background: #f8f9fa; padding: 15px; border-radius: 5px;">
                <pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 12px;">${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;

        const closeBtn = content.querySelector('#closeBtn');
        const downloadHtmlBtn = content.querySelector('#downloadHtmlBtn');
        const copyJsonBtn = content.querySelector('#copyJsonBtn');
        const copyTextBtn = content.querySelector('#copyTextBtn');

        closeBtn.onclick = () => document.body.removeChild(modal);
        modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };

        downloadHtmlBtn.onclick = () => downloadHtmlFromModal(data);
        copyJsonBtn.onclick = () => copyToClipboard(JSON.stringify(data, null, 2), 'JSON数据已复制到剪贴板！');
        copyTextBtn.onclick = () => copyToClipboard(generateTextSummary(data), '文本摘要已复制到剪贴板！');

        modal.appendChild(content);
        document.body.appendChild(modal);
        showNotification('数据预览已显示（备选模式）', 'info');
    }

    // 从模态框导出HTML
    function downloadHtmlFromModal(data) {
        try {
            const htmlContent = generatePayslipHTML(data);
            const filename = `工资单_${data.year || 'unknown'}_${formatMonthForFilename(data.month)}.html`;
            
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            showToast('HTML文件下载已开始！', 'success');
        } catch (error) {
            console.error('HTML导出失败:', error);
            showToast('HTML导出失败: ' + error.message, 'error');
        }
    }

    // 生成工资单HTML内容
    function generatePayslipHTML(data) {
        const generateSectionHTML = (className, title, sectionData) => {
            if (!sectionData || Object.keys(sectionData).length === 0) {
                return '';
            }
            
            const rows = Object.entries(sectionData).map(([key, value]) => {
                const isNumber = typeof value === 'number';
                const displayValue = isNumber ? value.toLocaleString('zh-CN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }) : value;
                
                return `
                    <div class="data-row">
                        <span class="data-label">${key}</span>
                        <span class="data-value ${isNumber ? 'number' : ''}">${displayValue}</span>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="section">
                    <div class="section-header ${className}">${title}</div>
                    <div class="section-content">
                        ${rows}
                    </div>
                </div>
            `;
        };

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>工资单 - ${formatYearMonth(data.year, data.month)}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
            background: #f8f9fa;
            color: #2c3e50;
            line-height: 1.6;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 300;
            margin-bottom: 8px;
        }
        
        .header .period {
            font-size: 18px;
            opacity: 0.9;
        }
        
        .content {
            padding: 0;
        }
        
        .section {
            border-bottom: 1px solid #e9ecef;
        }
        
        .section:last-child {
            border-bottom: none;
        }
        
        .section-header {
            background: #f8f9fa;
            padding: 20px 30px;
            border-left: 4px solid;
            font-weight: 600;
            font-size: 16px;
            color: #495057;
        }
        
        .section-header.employee { border-left-color: #6c757d; }
        .section-header.income { border-left-color: #28a745; }
        .section-header.social { border-left-color: #ffc107; color: #856404; }
        .section-header.tax { border-left-color: #dc3545; }
        .section-header.net { border-left-color: #007bff; }
        
        .section-content {
            padding: 0;
        }
        
        .data-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 30px;
            border-bottom: 1px solid #f1f3f4;
            transition: background-color 0.2s ease;
        }
        
        .data-row:hover {
            background-color: #f8f9fa;
        }
        
        .data-row:last-child {
            border-bottom: none;
        }
        
        .data-label {
            color: #6c757d;
            font-weight: 500;
        }
        
        .data-value {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .data-value.number {
            font-family: 'Consolas', 'Monaco', monospace;
            color: #495057;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
        }
        
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
            .data-row:hover { background-color: transparent; }
        }
        
        @media (max-width: 768px) {
            .container { margin: 10px; border-radius: 8px; }
            .header { padding: 20px; }
            .header h1 { font-size: 24px; }
            .section-header, .data-row, .footer { padding: 15px 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>工资单</h1>
            <div class="period">${formatYearMonth(data.year, data.month)}</div>
        </div>
        
        <div class="content">
            ${generateSectionHTML('employee', '👤 员工信息', data.employeeInfo)}
            ${generateSectionHTML('income', '💰 税前收入', data.preTaxIncome)}
            ${generateSectionHTML('social', '🛡️ 社保福利', data.socialSecurity)}
            ${generateSectionHTML('tax', '🧾 所得税', data.incomeTax)}
            ${generateSectionHTML('net', '💵 实发金额', data.netPay)}
        </div>
        
        <div class="footer">
            生成时间：${new Date().toLocaleString('zh-CN')}
        </div>
    </div>
</body>
</html>`;
    }
    function fallbackDownload(content, filename, mimeType) {
        try {
            const dataUri = 'data:' + mimeType + ';charset=utf-8,' + encodeURIComponent(content);
            const a = document.createElement('a');
            a.href = dataUri;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showNotification('JSON文件已下载（备选方案）！', 'success');
        } catch (error) {
            console.error('备选下载也失败:', error);
            // 最后的备选方案：复制到剪贴板
            if (navigator.clipboard) {
                navigator.clipboard.writeText(content).then(() => {
                    showNotification('下载失败，数据已复制到剪贴板', 'info');
                }).catch(() => {
                    showNotification('下载失败，请检查浏览器设置', 'error');
                });
            } else {
                showNotification('下载失败，请检查浏览器设置', 'error');
            }
        }
    }

    // 复制到剪贴板
    function copyToClipboard(text, successMessage) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast(successMessage, 'success');
            }).catch(error => {
                console.error('复制失败:', error);
                showToast('复制失败，请手动选择文本复制', 'error');
            });
        } else {
            // 备选方案：创建临时文本区域
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                showToast(successMessage, 'success');
            } catch (error) {
                showToast('复制失败，请手动选择文本复制', 'error');
            }
            
            document.body.removeChild(textArea);
        }
    }

    // 生成文本摘要
    function generateTextSummary(data) {
        let summary = `工资单数据摘要\n`;
        summary += `==================\n`;
        summary += `年月: ${formatYearMonth(data.year, data.month)}\n`;
        summary += `提取日期: ${data.extractDate}\n`;
        summary += `总项目数: ${data.summary.totalItems}\n\n`;

        const sections = [
            { key: 'employeeInfo', title: '员工信息' },
            { key: 'preTaxIncome', title: '税前收入' },
            { key: 'socialSecurity', title: '社保福利' },
            { key: 'incomeTax', title: '所得税' },
            { key: 'netPay', title: '实发金额' }
        ];

        sections.forEach(section => {
            if (Object.keys(data[section.key]).length > 0) {
                summary += `${section.title}:\n`;
                Object.entries(data[section.key]).forEach(([key, value]) => {
                    summary += `  ${key}: ${value}\n`;
                });
                summary += '\n';
            }
        });

        return summary;
    }

    // 显示关于信息
    function showAbout() {
        const aboutText = `北森工资单数据导出 v3.7

功能特点：
• 智能数据提取和预览
• 支持JSON格式导出
• 支持HTML格式导出
• 数据复制到剪贴板
• 文本摘要生成
• 完全本地处理，保护隐私

导出格式：
• JSON：结构化数据，便于程序处理
• HTML：专业排版，适合打印和查看
• 文本：简洁摘要，便于快速浏览

数据格式：
• 金额字段自动转换为数字格式
• 员工信息保持文本格式
• 支持各种数字格式（含逗号、货币符号等）

使用方法：
1. 点击"预览和导出数据"
2. 在预览界面查看提取的数据
3. 选择导出或复制功能

注意：所有数据仅在本地处理，不会上传到任何服务器。`;

        // 创建关于信息的模态框
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            width: 90%;
            max-width: 600px;
            max-height: 80%;
            overflow: auto;
            border-radius: 8px;
            padding: 30px;
            position: relative;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `;

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #333; font-size: 24px;">ℹ️ 关于脚本</h2>
                <button id="aboutCloseBtn" style="background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 16px;">❌</button>
            </div>
            <div style="white-space: pre-line; line-height: 1.6; color: #555; font-size: 14px;">${aboutText}</div>
        `;

        const closeBtn = content.querySelector('#aboutCloseBtn');
        closeBtn.onclick = () => document.body.removeChild(modal);
        modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };

        modal.appendChild(content);
        document.body.appendChild(modal);
    }

    // 显示通知
    function showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        if (typeof GM_notification !== 'undefined') {
            const icons = {
                success: '✅',
                error: '❌',
                info: 'ℹ️'
            };
            
            GM_notification({
                text: message,
                title: `${icons[type] || 'ℹ️'} 工资单提取器`,
                timeout: 3000
            });
        } else {
            showToast(message, type);
        }
    }

    // 初始化
    function init() {
        console.log('北森工资单数据导出 已加载');
        registerMenuCommands();
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
