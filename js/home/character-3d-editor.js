/* ============================================================
 * js/home/character-3d-editor.js — 家园 3D 人物编辑面板
 * ============================================================
 *
 * 右上角那个 .home-char-btn 一直调的是 openHomeCharEdit()，打开的是
 * character-2d.js 里的 2D 形象面板（图片 / 表情 / 头像三选一）。
 * 那套对 3D 模型毫无意义 —— 3D 人物不能是一张照片。所以在 3D 房间
 * 里那个按钮现在是白点的。
 *
 * 这个文件给它一个 3D 版本，只做能真做到的三件事：
 *
 *   大小   接 state.home.mySize（6…40，和 2D 共用同一个数，改一边两边一起变）
 *   姿势   六个姿势当场试摆，走路/挥手是活的（自带 rAF 循环）
 *   朝向   绕 Y 轴 -180…180
 *
 * 故意没做的：
 *   换颜色/换衣服 —— 模型是单材质烘焙贴图，改色得重新导出模型，
 *   浏览器里做不到。硬做只能整个换材质，出来的效果不会对。
 *
 * 按钮走 inline onclick，所以这几个函数必须挂 window。
 * 视觉沿用 style.css 里已有的 .char-edit-* / .char-src，
 * 只为姿势宫格和读数新加了几条 .c3d-* （见 style.css 末尾）。
 * ============================================================ */
(function (global) {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  function girl() { return global.HomeCharacter3DGirl; }
  function slot() { return global.HomeCharacter3D; }

  /** 当前开着哪个 3D 房间。
   *
   * 注意不要从 renderHome 的闭包里拿房间 id 传给这个面板 ——
   * 按钮用的是内联 onclick，跑在全局作用域，取不到闭包变量，
   * 会直接抛 ReferenceError（踩过：onclick="openHomeCharEdit3D(activeId)"）。
   * 所以面板自己从 DOM 判断。HomeRooms 也没有 current() 方法，别指望它。
   */
  function currentRoomId() {
    if (document.querySelector('.home-room.smallkitchen')) return 'smallkitchen';
    if (document.querySelector('.home-room.bedroom')) return 'bedroom';
    return 'bedroom';
  }

  /** 打开。房间 id 可选，缺省自己判断。 */
  function openHomeCharEdit3D(roomId) {
    var g = girl();
    var el = $('homeCharEdit');
    // 还没接上人物（模型加载中 / 加载失败）就别开面板，
    // 否则打开是一个什么都不动的空壳。
    if (!g || !slot() || !slot().has()) {
      if (typeof showIGToast === 'function') {
        showIGToast('3D 人物还没加载好，稍等一下再试');
      } else {
        console.warn('[home/character-3d-editor] 人物还没挂载，面板不打开');
      }
      return;
    }
    if (!el) return;

    var dbg = g.debug();
    var room = roomId || currentRoomId();
    var pose = g.currentPose();
    var size = g.currentSize();
    var yaw = Math.round(g.currentYaw() * 180 / Math.PI);

    var poseBtns = g.poses.map(function (p) {
      return '<button class="c3d-pose' + (p.id === pose ? ' on' : '') +
        '" data-pose="' + p.id + '" onclick="homeChar3DPose(this)">' + p.label + '</button>';
    }).join('');

    el.innerHTML =
      '<div class="char-edit-card c3d-card">' +
      '  <button class="char-edit-close" onclick="closeHomeCharEdit3D()" aria-label="关闭">' +
      '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '    <path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '  </button>' +
      '  <div class="char-edit-tabs"><button class="char-tab on">3D 人物</button></div>' +
      '  <div class="char-edit-hint">' + roomName(room) + ' · ' +
      (dbg.bones || 0) + ' 根骨骼</div>' +

      '  <div class="c3d-label">大小</div>' +
      '  <div class="char-edit-size">' +
      '    <input type="range" min="6" max="40" step="1" value="' + size +
      '      oninput="homeChar3DResize(this.value)">' +
      '    <span id="c3dSizeVal">' + size + '</span>' +
      '  </div>' +
      '  <div class="c3d-info" id="c3dHeight">' + heightText(dbg) + '</div>' +

      '  <div class="c3d-label">姿势</div>' +
      '  <div class="c3d-pose-grid" id="c3dPoses">' + poseBtns + '</div>' +

      '  <div class="c3d-label">朝向</div>' +
      '  <div class="char-edit-size">' +
      '    <input type="range" min="-180" max="180" step="5" value="' + yaw +
      '      oninput="homeChar3DYaw(this.value)">' +
      '    <span id="c3dYawVal">' + yaw + '°</span>' +
      '  </div>' +

      '  <div class="c3d-note">点房间地板，她会走过去</div>' +
      '</div>';

    el.style.display = 'flex';
  }

  function closeHomeCharEdit3D() {
    var el = $('homeCharEdit');
    if (el) el.style.display = 'none';
  }

  /** 大小。写回 state.home.mySize，2D 那边共用这个数，所以两边一起变。 */
  function homeChar3DResize(v) {
    v = Math.max(6, Math.min(40, parseInt(v, 10) || 11));
    // 走 HomeAvatar.setSize 才是"同一个数"的正解（它会 clamp + saveState）。
    // 没有 HomeAvatar 就退回直接写 state，两边共用 state.home.mySize。
    if (global.HomeAvatar && typeof HomeAvatar.setSize === 'function') {
      HomeAvatar.setSize(v);
    } else if (global.state && state.home) {
      state.home.mySize = v;
      if (typeof saveState === 'function') saveState();
    }
    if (slot()) slot().setConfig({ mySize: v });

    var lab = $('c3dSizeVal');
    if (lab) lab.textContent = String(v);
    var info = $('c3dHeight');
    if (info && girl()) info.textContent = heightText(girl().debug());
  }

  function homeChar3DPose(btn) {
    var pose = btn && btn.getAttribute ? btn.getAttribute('data-pose') : btn;
    if (!pose || !slot()) return;
    slot().setPose(pose, { moving: false });
    var grid = $('c3dPoses');
    if (grid) {
      Array.prototype.forEach.call(grid.querySelectorAll('.c3d-pose'), function (b) {
        b.classList.toggle('on', b.getAttribute('data-pose') === pose);
      });
    }
  }

  function homeChar3DYaw(v) {
    var deg = parseFloat(v) || 0;
    if (slot()) slot().setConfig({ yaw: deg * Math.PI / 180 });
    var lab = $('c3dYawVal');
    if (lab) lab.textContent = Math.round(deg) + '°';
  }

  function heightText(d) {
    if (!d || d.roomHeight == null) return '身高 —';
    return '身高 ' + d.roomHeight.toFixed(2) + ' 房间单位 · ' +
      (d.heightM != null ? d.heightM.toFixed(2) + ' 米' : '');
  }

  function roomName(roomId) {
    var map = { bedroom: '卧室', smallkitchen: '小厨房' };
    return map[roomId] || '3D 房间';
  }

  global.openHomeCharEdit3D = openHomeCharEdit3D;
  global.closeHomeCharEdit3D = closeHomeCharEdit3D;
  global.homeChar3DResize = homeChar3DResize;
  global.homeChar3DPose = homeChar3DPose;
  global.homeChar3DYaw = homeChar3DYaw;
})(window);