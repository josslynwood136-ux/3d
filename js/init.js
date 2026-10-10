// ============================================================
// init.js - 初始化 + 全局事件绑定 + window 导出
// ============================================================

// 错误捕获
window.onerror = function(msg, src, line, col, err) {
  alert('脚本报错：' + msg + '\n位置：行' + line + ' 列' + col + (err && err.stack ? '\n' + err.stack : ''));
  return false;
};
window.addEventListener('error', function(e) {
  if (e.message) alert('加载/运行错误：' + e.message);
});

// ===== 桌面 App 网格渲染 =====
var APP_ICONS = [
  { name: '打卡', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
  { name: 'API', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
  { name: '外观', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/><path d="M8 12h8M12 8v8"/></svg>' },
  { name: '家园', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { name: 'IG', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>' },
  { name: '恋爱日记', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
  { name: '自习室', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>' },
  { name: '养多肉', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M9 16h6"/><path d="M12 4v16"/><path d="M10 8c0-2 1-3 2-3s2 1 2 3"/><path d="M8 12c0-2 1-3 2-3s2 1 2 3"/><path d="M14 12c0-2 1-3 2-3s2 1 2 3"/><path d="M12 2l-2 4"/></svg>' },
  { name: '账本', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' },
  { name: '涂鸦', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>' },
  { name: '音乐', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
  { name: '线下', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' },
  { name: '相册', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' },
  { name: '许愿柳', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c-4-3-8-6-8-11a8 8 0 0 1 16 0c0 5-4 8-8 11z"/><path d="M12 11v5"/><path d="M9 14h6"/></svg>' },
  { name: '游戏房', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>' },
  { name: '直播间', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' }
];

function renderAppGrid() {
  var grid = $('appGrid');
  if (!grid) return;
  grid.innerHTML = '';
  APP_ICONS.forEach(function(app) {
    var el = document.createElement('div');
    el.className = 'app-icon';
    el.setAttribute('data-name', app.name);
    el.innerHTML = '<div class="app-icon-svg">' + (app.svg || app.icon) + '</div><div class="app-icon-label">' + app.name + '</div>';
    el.addEventListener('click', function() {
      if (app.name === '外观') { if (typeof openAppearance === 'function') openAppearance(); return; }
      if (app.name === '许愿柳') { showWillowPortal(); return; }
      openApp(app.name);
    });
    grid.appendChild(el);
  });
}

// 时钟更新
function updateClock() {
  var now = new Date();
  var h = String(now.getHours()).padStart(2, '0');
  var m = String(now.getMinutes()).padStart(2, '0');
  var timeEl = $('widgetTime');
  if (timeEl) timeEl.textContent = h + ':' + m;
  var dateEl = $('widgetDate');
  if (dateEl) dateEl.textContent = now.getFullYear() + '/' + (now.getMonth()+1) + '/' + now.getDate();
}

// ===== 天气小组件 =====
function renderWeatherWidget() {
  var el = $('widgetWeather');
  if (!el) return;
  // 模拟天气数据，可后续接入真实 API
  var weatherData = [
    { icon: '☀️', temp: '28°', desc: '晴朗', city: '北京' },
    { icon: '⛅', temp: '26°', desc: '多云转晴', city: '北京' },
    { icon: '🌧', temp: '22°', desc: '小雨', city: '北京' },
    { icon: '❄️', temp: '-2°', desc: '小雪', city: '北京' },
    { icon: '🌤', temp: '24°', desc: '晴间多云', city: '北京' }
  ];
  var today = new Date().getDate();
  var w = weatherData[today % weatherData.length];
  el.innerHTML = '<div class="widget-weather-icon">' + w.icon + '</div>' +
    '<div class="widget-weather-info"><div class="widget-weather-temp">' + w.temp + '</div>' +
    '<div class="widget-weather-desc">' + w.desc + '</div></div>' +
    '<div class="widget-weather-city">' + w.city + '</div>';
}

// ===== 待办小组件 =====
function renderTodoWidget() {
  var list = $('todoList');
  var count = $('todoCount');
  if (!list) return;
  var todos = [
    { text: '喝水 8 杯', done: false },
    { text: '运动 30 分钟', done: false },
    { text: '阅读 20 页', done: true },
    { text: '早睡早起', done: false }
  ];
  var doneCount = todos.filter(function(t) { return t.done; }).length;
  if (count) count.textContent = doneCount + '/' + todos.length;
  list.innerHTML = todos.map(function(t, i) {
    return '<div class="widget-todo-item">' +
      '<div class="widget-todo-check' + (t.done ? ' done' : '') + '" onclick="toggleTodo(' + i + ')"></div>' +
      '<span class="widget-todo-text' + (t.done ? ' done' : '') + '">' + t.text + '</span>' +
      '</div>';
  }).join('');
}

function toggleTodo(idx) {
  var todos = [
    { text: '喝水 8 杯', done: false },
    { text: '运动 30 分钟', done: false },
    { text: '阅读 20 页', done: true },
    { text: '早睡早起', done: false }
  ];
  todos[idx].done = !todos[idx].done;
  renderTodoWidget();
}

// 初始化入口
function init() {
  function setPhoneH() {
    document.documentElement.style.setProperty('--phone-h', window.innerHeight + 'px');
  }
  setPhoneH();
  window.addEventListener('resize', setPhoneH);
  renderEmojiPanel();
  if (!state.checkins.find(function(c) { return c.id === 'ck-water'; })) {
    var today = new Date();
    var weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);
    var fmt = function(d) { return d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate(); };
    state.checkins.push({ id: 'ck-water', name: '喝水打卡', start: fmt(today), end: fmt(weekLater), totalDays: 7, doneDays: 0, doneDates: [], charId: '', status: 'doing' });
    saveState();
  }
  var _prof = activeProfile();
  var _mp = state.myProfile || {};
  if (_prof && !_prof.avatar && _mp.avatarImage) {
    _prof.avatar = _mp.avatarImage;
    saveState();
  }
  renderChat();
  renderAppGrid();
  renderWeatherWidget();
  renderTodoWidget();
  updateClock();
  setInterval(updateClock, 30000);
  initDragDesktop();
  bindHotspots();
  // 更多面板：点击选项项后自动关闭
  var _mp = $('morePanel');
  if (_mp) _mp.addEventListener('click', function(e) {
    var item = e.target.closest('.panel-item');
    if (item) setTimeout(function() { var p = $('morePanel'); if (p && p.style.display === 'grid') p.style.display = 'none'; }, 80);
  });
  if (typeof loadNcmState === 'function') loadNcmState();
  if (typeof loadQqState === 'function') loadQqState();
  if (typeof maybeProbeNcm === 'function') maybeProbeNcm();
  if (typeof startRelateEngine === 'function') startRelateEngine();
  if (typeof startIdleProactive === 'function') startIdleProactive();
  if (typeof initPush === 'function') initPush();
  if (typeof checkinReminderTick === 'function') { checkinReminderTick(); setInterval(checkinReminderTick, 30000); }
  setupLaunchFullscreen();
}

// 从桌面图标启动（已安装 PWA）时，第一次用户手势进入真全屏（隐藏状态栏）。
// 浏览器禁止页面自动全屏，所以必须等首次点击/触摸；普通浏览器里不触发。
function setupLaunchFullscreen() {
  var mq = window.matchMedia;
  var launched = (mq && (mq('(display-mode: standalone)').matches || mq('(display-mode: fullscreen)').matches)) || window.navigator.standalone;
  if (!launched) return;
  var el = document.documentElement;
  var reqFs = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!reqFs) return;
  var hint = document.createElement('div');
  hint.id = 'fsHint';
  hint.textContent = '点击任意处进入全屏';
  hint.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;background:rgba(0,0,0,.7);color:#fff;font-size:13px;padding:8px 14px;border-radius:20px;pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.3)';
  document.body.appendChild(hint);
  var fired = false;
  function enter() {
    if (fired) return; fired = true;
    try { reqFs.call(el); } catch (e) {}
    if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
    window.removeEventListener('pointerdown', enter);
    window.removeEventListener('touchstart', enter);
    window.removeEventListener('click', enter);
  }
  window.addEventListener('pointerdown', enter);
  window.addEventListener('touchstart', enter);
  window.addEventListener('click', enter);
}

// 桌面热点绑定（兼容触摸 + 鼠标）
function bindHotspots() {
  document.querySelectorAll('.hotspot').forEach(hs => {
    const name = hs.getAttribute('data-name');
    if (!name) return;
    let touched = false;
    hs.addEventListener('touchstart', function(ev) {
      touched = true;
      ev.preventDefault();
      if (name === '许愿柳' || name === '许愿流') { showWillowPortal(); return; }
      openApp(name);
    }, { passive: false });
    hs.addEventListener('click', function(ev) {
      if (touched) { touched = false; return; }
      if (name === '许愿柳' || name === '许愿流') { showWillowPortal(); return; }
      openApp(name);
    });
  });
}

function toggleDebug() { document.getElementById('contentArea').classList.toggle('debug-mode'); }

// 桌面滑动
function initDragDesktop() {
  const slider = $('slider');
  let isDown = false, startX = 0, scrollLeft = 0, startY = 0, moved = false;

  slider.addEventListener('mousedown', e => {
    if ($('appModal').classList.contains('active')) return;
    isDown = true; moved = false;
    startX = e.pageX - slider.offsetLeft;
    startY = e.pageY;
    scrollLeft = slider.scrollLeft;
  });
  slider.addEventListener('mouseup', () => isDown = false);
  slider.addEventListener('mouseleave', () => isDown = false);
  slider.addEventListener('mousemove', e => {
    if (!isDown) return;
    if ($('appModal').classList.contains('active')) { isDown = false; return; }
    const dx = e.pageX - slider.offsetLeft - startX;
    if (Math.abs(dx) > 6 || Math.abs(e.pageY - startY) > 6) moved = true;
    if (moved) { e.preventDefault(); slider.scrollLeft = scrollLeft - dx * 1.5; }
  });

  slider.addEventListener('touchstart', e => {
    if ($('appModal').classList.contains('active')) return;
    isDown = true; moved = false;
    startX = e.touches[0].pageX - slider.offsetLeft;
    startY = e.touches[0].pageY;
    scrollLeft = slider.scrollLeft;
  }, { passive: true });
  slider.addEventListener('touchmove', e => {
    if (!isDown) return;
    if ($('appModal').classList.contains('active')) { isDown = false; return; }
    const dx = e.touches[0].pageX - slider.offsetLeft - startX;
    const dy = e.touches[0].pageY - startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
    if (moved) slider.scrollLeft = scrollLeft - dx * 1.5;
  }, { passive: true });
  slider.addEventListener('touchend', () => { isDown = false; moved = false; }, { passive: true });
}

// ===== 导出到 window（确保内联 onclick 正常工作）=====
var _w = window;
_w.toggleDebug = toggleDebug; _w.openApp = openApp; _w.closeApp = closeApp; _w.quickNotice = quickNotice;
_w.switchTab = switchTab; _w.openChat = openChat; _w.closeChat = closeChat; _w.openSettings = openSettings; _w.closeSettings = closeSettings;
_w.togglePin = togglePin; _w.clearHistory = clearHistory; _w.toggleMore = toggleMore; _w.toggleEmoji = toggleEmoji; _w.toggleAutoMem = toggleAutoMem; _w.setAutoMemLen = setAutoMemLen; _w.setAutoMemEvery = setAutoMemEvery; _w.manualSummarizeMemory = manualSummarizeMemory;
_w.sendChat = sendChat; _w.sendRed = sendRed; _w.selectRpAmount = selectRpAmount; _w.onRpAmountInput = onRpAmountInput; _w.confirmRedPacket = confirmRedPacket; _w.openRedPacket = openRedPacket; _w.saveApiConfig = saveApiConfig; _w.fetchModels = fetchModels; _w.filterModelSuggestions = filterModelSuggestions; _w.showAllModels = showAllModels;
_w.testConnection = testConnection; _w.exportAllData = exportAllData; _w.importAllData = importAllData; _w.resetAllData = resetAllData;
_w.renderCharacterEditor = renderCharacterEditor; _w.saveCharacter = saveCharacter; _w.deleteCharacter = deleteCharacter; _w.addMemory = addMemory;
_w.deleteMemory = deleteMemory; _w.uploadAvatar = uploadAvatar; _w.saveMyProfile = saveMyProfile; _w.settingsAddMemory = settingsAddMemory; _w.settingsDeleteMemory = settingsDeleteMemory;
_w.newProfile = newProfile; _w.editProfile = editProfile;
_w.doCheckin = doCheckin; _w.deleteCheckin = deleteCheckin; _w.submitNewCheckin = submitNewCheckin; _w.submitEditCheckin = submitEditCheckin;
_w.addDiary = addDiary; _w.setStudyMinutes = setStudyMinutes; _w.setBreak = setBreak;
_w.toggleStudy = toggleStudy; _w.finishStudy = finishStudy; _w.clearStudyRecords = clearStudyRecords; _w.companionSay = companionSay; _w.refreshCompanion = refreshCompanion; _w.inviteStudy = inviteStudy;
_w.switchStudyCompanion = switchStudyCompanion; _w.toggleStudySound = toggleStudySound; _w.studySoundStop = studySoundStop;
_w.addLedger = addLedger; _w.deleteLedger = deleteLedger; _w.editLedger = editLedger; _w.changeLedgerMonth = changeLedgerMonth;
_w.clearCanvas = clearCanvas; _w.saveDoodle = saveDoodle; _w.undoDoodle = undoDoodle; _w.uploadDoodleBg = uploadDoodleBg;
_w.uploadMusic = uploadMusic; _w.playSong = playSong; _w.playMusic = playSong; _w.renameMusic = renameMusic; _w.deleteMusic = deleteMusic; _w.togglePlay = togglePlay; _w.nextSong = nextSong; _w.prevSong = prevSong; _w.cycleMode = cycleMode; _w.toggleFav = toggleFav; _w.setFavView = setFavView; _w.searchMusic = searchMusic; _w.clearSearch = clearSearch; _w.playSearch = playSearch; _w.openNcmLogin = openNcmLogin; _w.closeNcmLogin = closeNcmLogin; _w.setSearchSrc = setSearchSrc; _w.openQqLogin = openQqLogin; _w.closeQqLogin = closeQqLogin;
_w.renderLive = renderLive; _w.renderLiveHall = renderLiveHall; _w.openLiveRoom = openLiveRoom; _w.filterHall = filterHall; _w.liveBack = liveBack; _w.liveOpenProfile = liveOpenProfile; _w.liveCloseProfile = liveCloseProfile; _w.liveProfileFollow = liveProfileFollow; _w.liveProfileMessage = liveProfileMessage; _w.liveSay = liveSay; _w.liveHeart = liveHeart; _w.liveFollow = liveFollow; _w.liveGift = liveGift; _w.toggleLiveGifts = toggleLiveGifts; _w.toggleLiveSongs = toggleLiveSongs; _w.toggleLiveBoard = toggleLiveBoard; _w.liveSong = liveSong; _w.liveSign = liveSign; _w.liveBar = liveBar; _w.liveMic = liveMic; _w.liveBagGrab = liveBagGrab; _w.startGame = startGame; _w.hitTarget = hitTarget; _w.submitGuess = submitGuess; _w.resetGuess = resetGuess; _w.initSnake = initSnake; _w.saveSpace = saveSpace; _w.spaceKiss = spaceKiss; _w.spaceTask = spaceTask; _w.spaceSwitchRole = spaceSwitchRole; _w.spaceLoveLine = spaceLoveLine; _w.renderOffline = renderOffline; _w.offlinePickScene = offlinePickScene; _w.toggleScenePicker = toggleScenePicker; _w.offlineInvite = offlineInvite; _w.offlineSend = offlineSend; _w.offlineEnd = offlineEnd; _w.offlineSubmitInvite = offlineSubmitInvite;
_w.startLiveMiniGame = startLiveMiniGame; _w.handleMiniGameHit = handleMiniGameHit; _w.toggleLiveTheme = toggleLiveTheme;
_w.deleteMessage = deleteMessage; _w.openAlbumPicker = openAlbumPicker; _w.startCapture = startCapture;
_w.exitMultiSelect = exitMultiSelect; _w.selectAllMsgs = selectAllMsgs; _w.deleteSelected = deleteSelected;
_w.showQuoteMenu = showQuoteMenu; _w.hideQuoteMenu = hideQuoteMenu; _w.onMsgRightClick = onMsgRightClick;
_w.onMsgTap = onMsgTap; _w.quoteMessage = quoteMessage;
_w.fertilizePlant = fertilizePlant; _w.plantMood = plantMood;
_w.addLedgerQuick = addLedgerQuick;
_w.renderAlbum = renderAlbum; _w.addPhoto = addPhoto; _w.uploadPhoto = uploadPhoto; _w.deletePhoto = deletePhoto; _w.viewPhoto = viewPhoto; _w.toggleAlbumUpload = toggleAlbumUpload;
_w.openAlbum = openAlbum; _w.newAlbum = newAlbum; _w.renameAlbum = renameAlbum; _w.delAlbum = delAlbum; _w.renderAlbumPhotos = renderAlbumPhotos;
_w.capturePhoto = capturePhoto; _w.renamePhoto = renamePhoto; _w.copyPhoto = copyPhoto; _w.movePhoto = movePhoto;
_w.renderHome = renderHome; _w.switchRoom = switchRoom; _w.openFurniture = openFurniture; _w.closeHomePanel = closeHomePanel; _w.closeSimsPie = closeSimsPie; _w.doFurnitureAction = doFurnitureAction; _w.spawnRoomEffect = spawnRoomEffect;
_w.toggleHomeLog = toggleHomeLog; _w.waterPlant = waterPlant; _w.touchPlant = touchPlant;
_w.cakeNewOrder = cakeNewOrder; _w.cakePick = cakePick; _w.cakeNextStep = cakeNextStep; _w.cakeRestart = cakeRestart;
_w.hidePanels = hidePanels; _w.toggleHabit = toggleHabit; _w.addHabit = addHabit; _w.delHabit = delHabit; _w.stopMusic = stopMusic;
_w.renderIGProfile = renderIGProfile; _w.switchProfileTab = switchProfileTab; _w.renderFeed = renderFeed; _w.renderCharLibrary = renderCharLibrary; _w.openCharFromLib = openCharFromLib; _w.bindStoryItems = bindStoryItems;
_w.createCharFromLib = createCharFromLib; _w.renderIGCharEditor = renderIGCharEditor; _w.igHandleAvatarUpload = igHandleAvatarUpload; _w.igClearAvatar = igClearAvatar; _w.saveIGCharEditor = saveIGCharEditor; _w.deleteIGChar = deleteIGChar;
_w.igAddMemory = igAddMemory; _w.igDeleteMemory = igDeleteMemory;
_w.renderDmList = renderDmList; _w.renderMyProfileContent = renderMyProfileContent;
_w.openProfileEditor = openProfileEditor; _w.closeProfileEditor = closeProfileEditor;
_w.handleProfileAvatarUpload = handleProfileAvatarUpload; _w.handleProfileCoverUpload = handleProfileCoverUpload;
_w.resetProfileAvatar = resetProfileAvatar; _w.saveProfile = saveProfile;
_w.openIGStory = openIGStory; _w.showIGToast = showIGToast;
_w.renderEmojiPanel = renderEmojiPanel; _w.sendSticker = sendSticker; _w.filterStickerPanel = filterStickerPanel; _w.filterStickerByCat = filterStickerByCat; _w.addStickerFolder = addStickerFolder; _w.toggleStickerManage = toggleStickerManage; _w.exitStickerManage = exitStickerManage; _w.toggleStickerSelect = toggleStickerSelect; _w.deleteSelectedStickers = deleteSelectedStickers; _w.moveSelectedStickers = moveSelectedStickers; _w.showStickerFolderPicker = showStickerFolderPicker; _w.moveSelectedToIdx = moveSelectedToIdx; _w.moveSelectedTo = moveSelectedTo; _w.addStickerFolderThenMove = addStickerFolderThenMove; _w.showStickerFolderDeletePicker = showStickerFolderDeletePicker; _w.deleteStickerFolderIdx = deleteStickerFolderIdx; _w.showFolderActionMenu = showFolderActionMenu; _w.renameStickerFolder = renameStickerFolder; _w.deleteStickerFolder = deleteStickerFolder;
_w.renderStickerManager = renderStickerManager; _w.openStickerForm = openStickerForm; _w.switchStickerCat = switchStickerCat; _w.batchUploadStickerFiles = batchUploadStickerFiles; _w.handleStickerBatchFiles = handleStickerBatchFiles; _w.showStickerImportDialog = showStickerImportDialog; _w.closeStickerImport = closeStickerImport; _w.doImportStickers = doImportStickers; _w.relayFetchImage = relayFetchImage;
_w.closeStickerForm = closeStickerForm; _w.stickerPickImage = stickerPickImage; _w.saveStickerForm = saveStickerForm; _w.pickEditStickerCat = pickEditStickerCat;
_w.toggleTodo = toggleTodo;
_w.deleteSticker = deleteSticker;
_w.renderWillow = renderWillow; _w.makeWish = makeWish; _w.clearWishToday = clearWishToday;
_w.currentWillowWish = currentWillowWish; _w.currentWillowRule = currentWillowRule; _w.willowContextText = willowContextText; _w.willowBlocksProactive = willowBlocksProactive; _w.willowBlocksReplyFor = willowBlocksReplyFor; _w.willowBreaksRelation = willowBreaksRelation; _w.willowParseRule = willowParseRule;
_w.startIdleProactive = startIdleProactive; _w.setIdleParams = setIdleParams;
_w.showInnerVoice = showInnerVoice; _w.closeInnerVoice = closeInnerVoice;
_w.toggleAutoVoice = toggleAutoVoice; _w.setTtsProvider = setTtsProvider; _w.setTtsUrl = setTtsUrl; _w.setTtsKey = setTtsKey; _w.setTtsModel = setTtsModel; _w.setCharTtsProvider = setCharTtsProvider; _w.setCharTtsVoice = setCharTtsVoice; _w.testTtsConnection = testTtsConnection; _w.toggleMsgVoice = toggleMsgVoice; _w.stopSpeak = stopSpeak; _w.speakText = speakText;
_w.startCall = startCall; _w.endCall = endCall; _w.openChatSearch = openChatSearch; _w.closeChatSearch = closeChatSearch; _w.doChatSearch = doChatSearch; _w.jumpToChatMsg = jumpToChatMsg;

// 离开时保存
window.addEventListener('beforeunload', saveState);

// DOM 就绪后启动
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => { try { init(); } catch (e) { alert('init 执行失败：' + e.message); } });
} else {
  try { init(); } catch (e) { alert('init 执行失败：' + e.message); }
}
