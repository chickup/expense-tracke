import React, { useState, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, addWeeks, subWeeks, startOfWeek, endOfWeek, addDays, subDays, startOfDay, endOfDay } from 'date-fns';
import { initOSSClient, isOSSInitialized, loadExpensesFromOSS, saveExpensesToOSS } from './aliyun-oss';

// 定义支出类型
interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
}

function App() {
  // 状态管理
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('food');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [collapseRange, setCollapseRange] = useState<'month' | 'week' | 'day'>('day');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // OSS配置
  const [ossConfig, setOssConfig] = useState({
    region: import.meta.env.VITE_OSS_REGION || 'oss-cn-shenzhen',
    accessKeyId: import.meta.env.VITE_OSS_ACCESS_KEY_ID || '',
    accessKeySecret: import.meta.env.VITE_OSS_ACCESS_KEY_SECRET || '',
    bucket: import.meta.env.VITE_OSS_BUCKET || 'expense-tracker-data'
  });
  const [ossConnected, setOssConnected] = useState(false);

  // 当切换时间范围时，重置展开和选中状态
  useEffect(() => {
    setExpandedGroups(new Set());
    setSelectedGroup(null);
  }, [collapseRange]);

  // 从OSS加载数据
  useEffect(() => {
    const loadData = async () => {
      console.log('开始加载数据...');

      // 检查OSS配置是否有效
      if (ossConfig.accessKeyId && ossConfig.accessKeySecret) {
        // 初始化OSS客户端
        initOSSClient(ossConfig);
        console.log('OSS客户端初始化成功');
        setOssConnected(true);

        // 从OSS加载数据
        try {
          const data = await loadExpensesFromOSS();
          console.log('从OSS加载数据:', data);
          setExpenses(data);
        } catch (error) {
          console.error('OSS加载失败:', error);
          // 如果加载失败，初始化空数组
          setExpenses([]);
        }
      } else {
        console.log('OSS配置不完整，无法初始化OSS客户端');
        setOssConnected(false);
        // 初始化空数组
        setExpenses([]);
      }

      console.log('OSS配置:', ossConfig);
    };

    loadData();
  }, [ossConfig]);

  // 文本解析函数
  const parseExpenseText = (text: string) => {
    try {
      // 重置错误信息

      // 按行分割文本
      const lines = text.trim().split('\n');
      const newExpenses: Expense[] = [];

      for (const line of lines) {
        // 匹配日期格式 (YYYY-MM-DD 或 YYYY/MM/DD)
        const dateMatch = line.match(/(\d{4}[-/])\d{2}[-/]\d{2}/);
        let expenseDate: Date;

        if (dateMatch) {
          const dateStr = dateMatch[0].replace('/', '-');
          expenseDate = new Date(dateStr);
        } else {
          // 如果没有日期，使用当前日期
          expenseDate = new Date();
        }

        // 匹配金额 (数字，可能带小数点)
        const amountMatch = line.match(/(\d+\.\d{2}|\d+)/);
        if (!amountMatch) continue;

        const expenseAmount = parseFloat(amountMatch[0]);

        // 提取描述（去除日期和金额）
        let expenseDescription = line
          .replace(/(\d{4}[-/])\d{2}[-/]\d{2}/, '')
          .replace(/(\d+\.\d{2}|\d+)/, '')
          .trim();

        // 简单分类逻辑
        let expenseCategory = '其他';
        const lowerDesc = expenseDescription.toLowerCase();

        if (lowerDesc.includes('餐') || lowerDesc.includes('饭') || lowerDesc.includes('食') || lowerDesc.includes('外卖') || lowerDesc.includes('餐厅')) {
          expenseCategory = 'food';
        } else if (lowerDesc.includes('交通') || lowerDesc.includes('打车') || lowerDesc.includes('地铁') || lowerDesc.includes('公交') || lowerDesc.includes('油费')) {
          expenseCategory = 'transportation';
        } else if (lowerDesc.includes('购物') || lowerDesc.includes('买')) {
          expenseCategory = 'shopping';
        } else if (lowerDesc.includes('娱乐') || lowerDesc.includes('电影') || lowerDesc.includes('游戏')) {
          expenseCategory = 'entertainment';
        } else if (lowerDesc.includes('医疗') || lowerDesc.includes('医院') || lowerDesc.includes('药店')) {
          expenseCategory = 'medical';
        } else if (lowerDesc.includes('教育') || lowerDesc.includes('学习') || lowerDesc.includes('培训')) {
          expenseCategory = 'education';
        }

        newExpenses.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          date: expenseDate.toISOString().split('T')[0],
          amount: expenseAmount,
          category: expenseCategory,
          description: expenseDescription
        });
      }

      if (newExpenses.length > 0) {
        const updatedExpenses = [...expenses, ...newExpenses];
        setExpenses(updatedExpenses);

        // 保存到OSS
        if (isOSSInitialized()) {
          saveExpensesToOSS(updatedExpenses);
        }
      }
    } catch (error) {
      console.error('解析失败:', error);
    }
  };

  // 添加支出
  const addExpense = () => {
    if (!amount || !category) return;

    const newExpense: Expense = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: date.toISOString().split('T')[0],
      amount: parseFloat(amount),
      category: category,
      description: description
    };

    const updatedExpenses = [...expenses, newExpense];
    setExpenses(updatedExpenses);

    // 保存到OSS
    if (isOSSInitialized()) {
      saveExpensesToOSS(updatedExpenses);
    }

    // 重置表单
    setAmount('');
    setDescription('');
  };

  // 删除支出
  const deleteExpense = (id: string) => {
    const updatedExpenses = expenses.filter(expense => expense.id !== id);
    setExpenses(updatedExpenses);

    // 保存到OSS
    if (isOSSInitialized()) {
      saveExpensesToOSS(updatedExpenses);
    }
  };

  // 搜索支出
  const filteredExpenses = expenses.filter(expense => {
    const searchLower = searchQuery.toLowerCase();
    return (
      expense.description.toLowerCase().includes(searchLower) ||
      expense.category.toLowerCase().includes(searchLower)
    );
  });

  // 按时间范围过滤支出
  const getExpensesInRange = (start: Date, end: Date) => {
    return filteredExpenses.filter(expense => {
      const expenseDate = parseISO(expense.date);
      return isWithinInterval(expenseDate, { start, end });
    });
  };

  // 计算总支出
  const calculateTotal = (expensesList: Expense[]) => {
    return expensesList.reduce((total, expense) => total + expense.amount, 0);
  };

  // 生成月份列表
  const generateMonthList = () => {
    const months = [];
    const currentMonth = new Date();

    for (let i = 6; i >= 0; i--) {
      const month = subMonths(currentMonth, i);
      months.push(month);
    }

    for (let i = 1; i <= 6; i++) {
      const month = addMonths(currentMonth, i);
      months.push(month);
    }

    return months;
  };

  // 按天分组支出
  const groupExpensesByDay = (expensesList: Expense[]) => {
    const grouped: { [key: string]: Expense[] } = {};

    expensesList.forEach(expense => {
      if (!grouped[expense.date]) {
        grouped[expense.date] = [];
      }
      grouped[expense.date].push(expense);
    });

    return grouped;
  };

  // 按周分组支出
  const groupExpensesByWeek = (expensesList: Expense[]) => {
    const grouped: { [key: string]: Expense[] } = {};

    expensesList.forEach(expense => {
      const expenseDate = parseISO(expense.date);
      const weekStart = startOfWeek(expenseDate, { weekStartsOn: 1 }); // 周一为一周的开始
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(expense);
    });

    return grouped;
  };

  // 按月份分组支出
  const groupExpensesByMonth = (expensesList: Expense[]) => {
    const grouped: { [key: string]: Expense[] } = {};

    expensesList.forEach(expense => {
      const expenseDate = parseISO(expense.date);
      const monthKey = format(expenseDate, 'yyyy-MM');

      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(expense);
    });

    return grouped;
  };

  // 切换展开/折叠状态
  const toggleExpand = (key: string) => {
    const newExpandedGroups = new Set(expandedGroups);
    if (newExpandedGroups.has(key)) {
      newExpandedGroups.delete(key);
    } else {
      newExpandedGroups.add(key);
    }
    setExpandedGroups(newExpandedGroups);
  };

  // 选择分组
  const selectGroup = (key: string | null) => {
    setSelectedGroup(key);
  };

  // 渲染分组支出
  const renderGroupedExpenses = () => {
    const currentMonthExpenses = getExpensesInRange(
      startOfMonth(selectedMonth),
      endOfMonth(selectedMonth)
    );

    let groupedExpenses: { [key: string]: Expense[] } = {};

    switch (collapseRange) {
      case 'day':
        groupedExpenses = groupExpensesByDay(currentMonthExpenses);
        break;
      case 'week':
        groupedExpenses = groupExpensesByWeek(currentMonthExpenses);
        break;
      case 'month':
        groupedExpenses = groupExpensesByMonth(currentMonthExpenses);
        break;
    }

    // 按日期排序（从新到旧）
    const sortedKeys = Object.keys(groupedExpenses).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    return sortedKeys.map(key => {
      const groupExpenses = groupedExpenses[key];
      const groupTotal = calculateTotal(groupExpenses);
      const isExpanded = expandedGroups.has(key);
      const isSelected = selectedGroup === key;

      let displayKey = key;
      if (collapseRange === 'week') {
        const weekStart = parseISO(key);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        displayKey = `${format(weekStart, 'MM/dd')} - ${format(weekEnd, 'MM/dd')}`;
      } else if (collapseRange === 'month') {
        displayKey = format(parseISO(key + '-01'), 'yyyy年MM月');
      } else {
        displayKey = format(parseISO(key), 'yyyy年MM月dd日');
      }

      return (
        <div key={key} className="mb-4">
          <div
            className={`flex justify-between items-center p-3 rounded-lg cursor-pointer ${isSelected ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-50 dark:bg-gray-800'}`}
            onClick={() => selectGroup(isSelected ? null : key)}
          >
            <div className="flex items-center">
              <button
                className="mr-2 text-gray-500"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(key);
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
              <h3 className="font-medium">{displayKey}</h3>
            </div>
            <span className="font-bold">¥{groupTotal.toFixed(2)}</span>
          </div>

          {isExpanded && (
            <div className="ml-6 mt-2 space-y-2">
              {groupExpenses.map(expense => (
                <div key={expense.id} className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <span className="text-sm text-gray-500">{expense.description}</span>
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                      {expense.category === 'food' && '餐饮'}
                      {expense.category === 'transportation' && '交通'}
                      {expense.category === 'shopping' && '购物'}
                      {expense.category === 'entertainment' && '娱乐'}
                      {expense.category === 'medical' && '医疗'}
                      {expense.category === 'education' && '教育'}
                      {expense.category === '其他' && '其他'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-4">¥{expense.amount.toFixed(2)}</span>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            记账网站
          </h1>
          <p className="text-gray-600 dark:text-gray-300">记录你的日常开支</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">版本：20260401v3</p>
        </div>

        {/* OSS配置面板 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
            阿里云OSS配置
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-200 mb-1">
                Region
              </label>
              <input
                type="text"
                value={ossConfig.region}
                onChange={(e) => setOssConfig({ ...ossConfig, region: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="例如: oss-cn-shenzhen"
              />
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-200 mb-1">
                Bucket
              </label>
              <input
                type="text"
                value={ossConfig.bucket}
                onChange={(e) => setOssConfig({ ...ossConfig, bucket: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="例如: expense-tracker-data"
              />
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-200 mb-1">
                AccessKey ID
              </label>
              <input
                type="text"
                value={ossConfig.accessKeyId}
                onChange={(e) => setOssConfig({ ...ossConfig, accessKeyId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="请输入AccessKey ID"
              />
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-200 mb-1">
                AccessKey Secret
              </label>
              <input
                type="password"
                value={ossConfig.accessKeySecret}
                onChange={(e) => setOssConfig({ ...ossConfig, accessKeySecret: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="请输入AccessKey Secret"
              />
            </div>
            {ossConnected && (
              <p className="text-green-500 text-sm">✓ 连接成功！数据将自动同步到云端</p>
            )}
          </div>
        </div>

        {/* 总支出卡片 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">
            总支出
          </h2>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-gray-500 dark:text-gray-400">本月</p>
              <p className="text-3xl font-bold text-gray-800 dark:text-white">
                ¥{calculateTotal(getExpensesInRange(startOfMonth(selectedMonth), endOfMonth(selectedMonth))).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">本周</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                ¥{calculateTotal(getExpensesInRange(startOfWeek(new Date(), { weekStartsOn: 1 }), endOfWeek(new Date(), { weekStartsOn: 1 }))).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">今日</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">
                ¥{calculateTotal(getExpensesInRange(startOfDay(new Date()), endOfDay(new Date()))).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* 月份选择器 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200">
              月度支出
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded"
              >
                上一月
              </button>
              <span className="font-medium">{format(selectedMonth, 'yyyy年MM月')}</span>
              <button
                onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded"
              >
                下一月
              </button>
            </div>
          </div>

          {/* 时间范围折叠选项 */}
          <div className="flex space-x-4 mb-4">
            <button
              onClick={() => setCollapseRange('day')}
              className={`px-4 py-2 rounded-lg ${collapseRange === 'day' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              按天
            </button>
            <button
              onClick={() => setCollapseRange('week')}
              className={`px-4 py-2 rounded-lg ${collapseRange === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              按周
            </button>
            <button
              onClick={() => setCollapseRange('month')}
              className={`px-4 py-2 rounded-lg ${collapseRange === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              按月
            </button>
          </div>

          {/* 分组支出列表 */}
          {renderGroupedExpenses()}
        </div>

        {/* 添加支出 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
            添加支出
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-200 mb-1">
                  日期
                </label>
                <input
                  type="date"
                  value={date.toISOString().split('T')[0]}
                  onChange={(e) => setDate(new Date(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-gray-700 dark:text-gray-200 mb-1">
                  金额
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="请输入金额"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-200 mb-1">
                分类
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="food">餐饮</option>
                <option value="transportation">交通</option>
                <option value="shopping">购物</option>
                <option value="entertainment">娱乐</option>
                <option value="medical">医疗</option>
                <option value="education">教育</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-200 mb-1">
                描述
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="请输入描述"
              />
            </div>
            <button
              onClick={addExpense}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              添加支出
            </button>
          </div>
        </div>

        {/* 文本解析 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
            批量添加
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-200 mb-1">
                粘贴文本（每行一条支出，包含日期、金额和描述）
              </label>
              <textarea
                onChange={(e) => parseExpenseText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                rows={5}
                placeholder="例如：
2026-03-01 35.5 午餐
2026-03-02 12.8 地铁
2026-03-03 199 购物"
              />
            </div>
          </div>
        </div>

        {/* 搜索功能 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
            搜索支出
          </h2>
          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="请输入关键词搜索"
              />
            </div>
            <div className="space-y-2">
              {filteredExpenses.map(expense => (
                <div key={expense.id} className="flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <span className="text-sm text-gray-500">{expense.date}</span>
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                      {expense.category === 'food' && '餐饮'}
                      {expense.category === 'transportation' && '交通'}
                      {expense.category === 'shopping' && '购物'}
                      {expense.category === 'entertainment' && '娱乐'}
                      {expense.category === 'medical' && '医疗'}
                      {expense.category === 'education' && '教育'}
                      {expense.category === '其他' && '其他'}
                    </span>
                    <span className="ml-2">{expense.description}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-4">¥{expense.amount.toFixed(2)}</span>
                    <button
                      onClick={() => deleteExpense(expense.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;