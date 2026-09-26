import type { LocaleMap } from './types';

const zh: LocaleMap = {
  // -- stdin / input area --
  'stdin.interactive.hint': '此程序使用交互式输入，每行对应一次 input() 调用。',
  'stdin.once.hint': '输入会在运行前一次性交给程序 —— 这些语言无法在运行中追加输入。每行一个值。',
  'stdin.interactive.placeholder': '每行 = 一次 input() 调用。\n示例 — 为读取姓名、年龄、城市的程序预填 3 行：\nAlice\n25\n北京',
  'stdin.firstPromptPlaceholder': '输入第一个提示符的值…',
  'stdin.label.input': '输入 #{n}',
  'stdin.label.dynamic': '输入 #{n}（动态）',
  'stdin.truncated': '⚠️ 输入内容过长，已截断为 {n} 字节。',
  'stdin.insufficient.body': '预输入数据不完整！{label}缺少预填数据。\n已消耗 {consumed} 行预填数据，程序继续请求输入（已连续10次空输入）。\n请在输入框中补充更多行数据后重新运行。',

  // -- output area --
  'output.truncated': '⚠️ 输出太多，前面的 {n} 行已省略，只显示最后 {max} 行。',

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
  'ui.queued': '等待其他代码块运行结束（前面还有 {n} 个）…',
  'ui.queuedLong': '已经等了 {n} 秒还没轮到。前面那个代码块可能卡住了 —— 可以点它的「{stop}」按钮中止它。',
  'ui.runningLong': '已经运行 {n} 秒了，该程序运行时间较长，需要中止程序请点「{stop}」。',
  'ui.runningLongLoop': '已经运行 {n} 秒了，可能遇到了死循环，需要中止程序请点「{stop}」。',
  'ui.runningLongNoStop': '已经运行 {n} 秒了，该程序运行时间较长。这类语言不能中途停止，如果一直没结果，请检查网络或稍后再试。',
  'ui.runningLongLoopNoStop': '已经运行 {n} 秒了，可能遇到了死循环（这类语言不能中途停止，只能等它结束或关掉这个代码块）。',

  // -- settings tab --
  'settings.language.name': '插件语言',
  'settings.language.desc': '选择 Code Runner 界面的显示语言。',
  'settings.language.auto': '跟随 Obsidian',
  'settings.general': '通用',
  'settings.runtime': '运行时',
  'settings.experimental': '实验',
  'settings.pythonCdn.name': 'Pyodide CDN 地址',
  'settings.pythonCdn.desc': '加载 Pyodide（Python WebAssembly 运行时）的基础地址。如需使用镜像或自建实例，可在此修改。',
  'settings.ioPrompts.name': 'I/O 上下文提示',
  'settings.ioPrompts.desc': '在输入和输出区域显示上下文提示。逐行输入时显示当前输入提示，移动端多行输入时显示全部待输入提示，以及输出行指引。',
  'settings.autoComplete.name': '代码自动补全',
  'settings.autoComplete.desc': '在代码块中输入时提供智能补全建议。',
  'settings.autoSkeleton.name': '自动补全程序骨架',
  'settings.autoSkeleton.desc': '运行代码块前，若片段缺少入口函数（如 main），自动套入该语言的标准框架，并补上它用到却没有写的 #include / import。输出区会先显示一行提示，展开可查看实际运行的完整代码。',
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
  'error.unknown': '未知错误',
  'python.aborted': '已停止。',
  'python.abortedReload': '已停止。程序没有响应中断信号，已重启 Python 运行时 —— 下次运行会重新加载。',
  'python.loading': '正在加载 Python 运行时（首次使用需下载约 10 MB，请稍候）…',
  'python.loadTimeout': 'Python 运行时 60 秒内没有加载完成。请检查网络，或在插件设置里换一个 Pyodide CDN 地址后重试。',

  // -- network failures (remote languages + CDN-loaded runtimes) --
  'net.unknownHost': '远端服务',
  'net.offline': '当前没有网络连接，无法访问 {host}。这类语言需要联网才能运行，请连上网后重试。',
  'net.failed': '无法连接到 {host}，请检查网络或代理设置后重试。',
  'net.timeout': '连接 {host} 超过 {n} 秒没有响应，请检查网络后重试。',
  'net.http': '{host} 返回了错误（HTTP {status}），请稍后重试。',
  'net.badLibrary': '从 {host} 下载的 {lib} 程序库已经加载成功，但它没有提供本插件需要的接口——CDN 上的这个文件可能变了。请稍后重试。',

  // -- sololearn diagnostics --
  'diag.defaultLabel': '诊断信息',
  'sololearn.noOutput': '⚠️ 程序运行结束，没有输出。',
  // No `{s}` here: Chinese does not inflect for number, and the caller's
  // suffix would land on screen as "3 个错误s". The placeholder is simply
  // absent, so the runtime leaves the string alone.
  'diag.errorCount': '{n} 个错误',
  'diag.warningCount': '{n} 个警告',
  // Full-width, like the rest of the line: "1 个错误, 1 个警告" reads as a
  // typo in Chinese, which is how it looked before this key existed.
  'diag.separator': '，',

  // -- 自动补全程序骨架 --
  'skeleton.notice': '⚠ 已自动补全代码片段：{added}（点开可查看实际运行的代码）',

  // -- unsupported language (main.tsx API) --
  'api.unsupportedLang': '不支持的语言：{lang}。支持的语言：{list}',
  'api.stdinUnavailable': '通过 API 运行时不支持交互式输入，程序已停止。',
};

export default zh;
