import type { LocaleMap } from './types';

const zh: LocaleMap = {
  // -- stdin / input area --
  'stdin.unsupported': '本程序需要标准输入，目前仅支持 Python。',
  'stdin.interactive.hint': '此程序使用交互式输入，每行对应一次 input() 调用。',
  'stdin.interactive.placeholder': '每行 = 一次 input() 调用。\n示例 — 为读取姓名、年龄、城市的程序预填 3 行：\nAlice\n25\n北京',
  'stdin.firstPromptPlaceholder': '输入第一个提示符的值…',
  'stdin.label.input': '输入 #{n}',
  'stdin.label.dynamic': '输入 #{n}（动态）',
  'stdin.insufficient.worker': '⚠️ 预输入数据不完整！已消耗所有 {lines} 行预填数据。\n程序继续请求输入（已连续10次空输入）。\n请在输入框中补充更多行数据后重新运行。',
  'stdin.insufficient.body': '预输入数据不完整！{label}缺少预填数据。\n已消耗 {consumed} 行预填数据，程序继续请求输入（已连续10次空输入）。\n请在输入框中补充更多行数据后重新运行。',

  // -- UI chrome --
  'ui.run': '运行（回车）',
  'ui.play': '运行',
  'ui.closeInput': '关闭输入',
  'ui.cancelStdin': '取消（发送空输入）',
  'ui.submit': '提交（回车）',
  'ui.stop': '停止',
  'ui.clearOutput': '清除输出',
  'ui.toggleInput': '切换输入区域',
  'ui.terminate': '立即终止执行',

  // -- settings tab --
  'settings.language.name': '插件语言',
  'settings.language.desc': '选择 Code Runner 界面的显示语言。',
  'settings.language.auto': '跟随 Obsidian',
  'settings.general': '通用',
  'settings.runtime': '运行时',
  'settings.experimental': '实验',
  'settings.pythonCdn.name': 'Pyodide CDN 地址',
  'settings.pythonCdn.desc': '加载 Pyodide（Python WebAssembly 运行时）的基础地址。如需使用镜像或自建实例，可在此修改。',
  'settings.comingSoon.heading': '即将推出',
  'settings.ioPrompts.name': 'I/O 上下文提示',
  'settings.ioPrompts.desc': '在输入和输出区域显示上下文提示。逐行输入时显示当前输入提示，移动端多行输入时显示全部待输入提示，以及输出行指引。',
  'settings.autoComplete.name': '代码自动补全',
  'settings.autoComplete.desc': '在代码块中输入时提供智能补全建议。',
  'settings.additionalPlugins.heading': '附加插件',
  'settings.additionalPlugins.desc': '更多语言后端和集成正在规划中，敬请期待。',

  // -- pyodide / worker --
  'worker.error': 'Worker 错误：{message}',
  'pyodide.loadError': '加载 Pyodide 失败：{message}',
  'pyodide.initError': 'Pyodide 初始化失败：{message}',
  'pyodide.notInitialized': 'Pyodide 未初始化',
  'pyodide.setupError': '[设置错误] {message}',
  'pyodide.injectError': '[设置错误] 注入 input 替换失败',
  'pyodide.genericError': '[Pyodide 错误] {message}',

  // -- sololearn diagnostics --
  'diag.defaultLabel': '诊断信息',
  'diag.errorCount': '{n} 个错误{s}',
  'diag.warningCount': '{n} 个警告{s}',

  // -- unsupported language (main.tsx API) --
  'api.unsupportedLang': '不支持的语言：{lang}。支持的语言：{list}',
};

export default zh;
