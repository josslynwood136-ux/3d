/* ============================================================
 * js/home/rooms-3d/bedroom-scene.js — 卧室 3D 场景
 * ============================================================
 *
 * 原来这段 840 行塞在 apps.js 的 initBedroom3D() 里，和 30 多个 app 的
 * 业务逻辑混在同一个 6000 行文件里。现在拆出来，和小厨房同构：
 *
 *   bedroom-scene.js     生命周期 / 相机 / 交互 / 拾取 / 动画
 *   bedroom-geometry.js  场景搭建（家具、材质、灯光）
 *
 * 行为和拆分前完全一致，包括：
 *   - 3D 资源没就绪时重试 100 次（renderHome 是异步的，THREE 可能还没 import 完）
 *   - mesh.userData.fid 拾取（比小厨房的对象引用比较更好，不用改几何体代码）
 *   - 点地板把 3D 人物移过去
 *   - 世界坐标 -> 屏幕像素投影，给结果泡泡定位
 *
 * 和小厨房的差异：卧室不常驻。场景包含 shadowMap 和 2048 阴影贴图，
 * 重建成本比小厨房高，而且卧室没有"打开很久"的价值需求。
 * ============================================================ */
(function (global) {
  'use strict';

  var scene = null;
  var renderer = null;
  var camera = null;
  var controls = null;
  var animId = null;
  var initTimer = null;
  // HUD 上绑过的按钮。hudUnbind 必须在模块级 —— destroyBedroom3D 是模块级
  // 函数，拿不到 initBedroom3D 里的局部函数。
  var hudHandlers = [];
  function hudUnbind() {
    hudHandlers.forEach(function (r) { r.el.removeEventListener('click', r.h); });
    hudHandlers = [];
  }
  var initAttempts = 0;
  var pointerHandlers = null;
  var resizeHandler = null;
  var lastFrame = 0;
  var destroyed = false;
  // 传给几何体的参数对象，销毁时用来释放 PMREM 的 render target
  var geoArgs = null;

  // -----------------------------------------------------------------
  // 背景色
  // -----------------------------------------------------------------
  // scene.background 是普通 Color，three 在 clear 时会把它转到"输出色彩
  // 空间"。我们用 sRGB 输出，所以这里必须先把目标 sRGB 色值换成线性值 ——
  // 否则屏幕上会比预期的亮一截。
  //
  // 不用 THREE.Color.convertSRGBToLinear()：ColorManagement.enabled =
  // false 时 three 的 convert() 直接 return，那个方法是空操作。
  // 下面这个 sRGB EOTF 就是 three 内部那一套。
  function makeBg(hex) {
    var c = new THREE.Color(hex);
    function f(u) {
      return u < 0.04045 ? u * 0.0773993808 : Math.pow(u * 0.9478672986 + 0.0521327014, 2.4);
    }
    return { r: f(c.r), g: f(c.g), b: f(c.b) };
  }
  var BG_DAY = null;      // 暖米色，原文件那圈渐变的中间色
  var BG_NIGHT = null;    // 夜间暗紫

  function showError(message) {
    var hint = document.querySelector('.bedroom3d-hint');
    if (hint) hint.textContent = message;
  }

  // ---- 3D 人物的加载状态 ----
  // character-3d-girl.js 派发 home:character 事件（loading / ready / error）。
  // 模型 10MB，本地也要下好几秒，没提示的话用户会以为房间是空的。
  // 提示条这个元素只在卧室打开时存在，所以监听挂一次就行，
  // 不需要跟着房间的起落走 —— 卧室没开时事件也压根不会派发。
  function onCharacterEvent(e) {
    var d = (e && e.detail) || {};
    var hint = document.querySelector('.bedroom3d-hint');
    if (!hint) return;
    if (d.state === 'loading') hint.textContent = d.text || '正在加载 3D 人物…';
    else if (d.state === 'error') hint.textContent = d.text || '3D 人物加载失败';
    else if (d.state === 'ready') hint.textContent = global.BEDROOM_HINT_DEFAULT;
  }
  global.addEventListener('home:character', onCharacterEvent);

  function initBedroom3D() {
    if (scene) return;
    if (initTimer) { clearTimeout(initTimer); initTimer = null; }
    // renderHome 是异步切房间的，three.js 的 import 可能还没完成。
    // 这里轮询等它就绪，最多 100 次（约 6 秒）。
    if (!global.THREE || !global.OrbitControls) {
      initAttempts++;
      if (initAttempts < 100) initTimer = setTimeout(initBedroom3D, 60);
      else showError('3D 资源加载失败，请检查网络后刷新');
      return;
    }
    var host = document.querySelector('.home-room.bedroom .bedroom-embed');
    if (!host) return;
    var THREE = global.THREE;
    var OrbitControls = global.OrbitControls;
    initAttempts = 0;
    destroyed = false;

    // ---- HUD（替代原来 index.js 里手写的 canvas + 提示条 + 圆按钮）----
    global.createBedroomHud(host);
    var canvas = host.querySelector('canvas.bd-canvas');
    if (!canvas) return;

    BG_DAY = makeBg(0xe2cdc3);
    BG_NIGHT = makeBg(0x3a3145);
    scene = new THREE.Scene();
    // 原文件没有雾：加雾会把 11 米宽的房间洗白，所以去掉。
    scene.background = new THREE.Color(BG_DAY.r, BG_DAY.g, BG_DAY.b);

    // =================================================================
    // 相机：45 度等距正交，和小厨房完全同一套
    // =================================================================
    // 为什么必须是正交而不是透视：
    // 这间房是"微缩景观"（diorama），全部家当都是按缩尺摆的。透视相机会让
    // 近处的沙发比远处的书架大一大截，微缩感立刻散掉，看着像走进了真房间。
    // 正交投影下所有物体等比缩放，才有"摆在盒子里"的感觉 —— 原作者用的
    // 也是正交。
    //
    // 视野按"设计尺寸"锁定，不直接吃容器宽高比：房间容器只有 ~900x560，
    // 比整屏视口小，直接用窗口宽高比会在某些比例下把地板或墙顶裁掉。
    // 以设计尺寸为基准算视野，容器更宽时按宽度反推垂直范围。
    var DESIGN_W = 1400, DESIGN_H = 900;   // 设计尺寸（取一个好构图的比例）
    // 10.0 是照原 HTML 抄的，但那个值是给"整屏视口"调的。
    // 房间容器只有 ~900x560，fitCamera 里的 Math.max(1, DESIGN_H/h)
    // 会把视野再放大 1.6 倍，结果房间只占画面一小块，看着很小。
    // 7.0 是试出来的：房间横向占满约九成，不会裁到也不会显空。
    var DESIGN_EXTENT = 7.0;
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

    function fitCamera() {
      var w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return false;   // 容器还没布局好，交给 onResize 重试
      var extentV = DESIGN_EXTENT * Math.max(1, DESIGN_H / h);
      var extentH = Math.max(DESIGN_EXTENT * (DESIGN_W / DESIGN_H), extentV * (w / h));
      camera.left = -extentH;
      camera.right = extentH;
      camera.top = extentV;
      camera.bottom = -extentV;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      return true;
    }
    // 机位：方向和厨房一致（delta 12.5 / 10.05 / 12.5，即仰角约 29.6 度），
    // 只是把注视点抬到房间实际重心（微缩景观高 6.9 米，不是原来 1.45）。
    var defaultCamPos = new THREE.Vector3(12.5, 13.05, 12.5);
    var defaultLookAt = new THREE.Vector3(0, 3.0, 0);
    camera.position.copy(defaultCamPos);
    camera.lookAt(defaultLookAt);

    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      scene = null;
      camera = null;
      showError('当前浏览器无法启动 3D 卧室，请开启 WebGL 后刷新');
      return;
    }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio, 2));
    // 容器尺寸可能还没算出来（刚 inject 完 HUD）。这时候 setSize 没跑成，
    // canvas 会停在 three 的默认 300x150 缓冲区，然后被 CSS 拉满 ——
    // 那就是"糊"。所以这里排队一帧再试。
    if (!fitCamera()) {
      requestAnimationFrame(function () {
        if (!destroyed) fitCamera();
      });
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 输出色彩空间：和 r128 的 LinearEncoding 对齐。
    // 输入侧（ColorManagement.enabled = false）在 index.html 统一关，
    // 输出侧在这里关 —— 两边不对称会让整个房间发灰。详见 kitchen-scene.js 里的说明。
    // 输出色彩空间：sRGB —— 和原 HTML 完全一致，**不要**改成 Linear。
    //
    // 为什么厨房是 Linear 而卧室不是：
    //   厨房几何体几乎全是纯色材质，1752 行的颜色当年就是照着
    //   "Linear 输出"这套管线一手挑亮的，用 sRGB 输出反而会过曝。
    //   卧室到处是 Canvas 贴图（地板 / 墙板 / 被子 / 藤筐 / 地毯 / 挂画），
    //   颜色是作者在 r128 的 sRGB 输出下调的。
    //
    // 少掉"线性 -> sRGB"这一步等于把线性值直接写进屏幕：中间调被压暗、
    // 对比度被拉平，看起来就是发灰、发糊 —— 就是"模模糊糊"。
    // 完整管线：材质色当线性用（ColorManagement 关）→ 贴图硬件 sRGB→线性
    // → ACES → 线性→sRGB 输出。和原文件逐级对齐。
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // 0.62 是原文件的值，但实测下来整张图像蒙了一层白纱：地板的陶土色被冲成
    // 灰粉、大面积白色全糊成一片。所谓"模模糊糊"就是这个。
    // 光源位置修正后层次已经出来了，但总量还是偏高，这个数要往下压。
    renderer.toneMappingExposure = 0.30;

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.panSpeed = 0.8;
    controls.target.copy(defaultLookAt);
    // 正交相机靠 zoom 缩放，不是 min/maxDistance
    controls.minZoom = 0.65;
    controls.maxZoom = 2.2;
    // 角度锁死在一个"设计好的等距窗口"里 —— 和厨房同一组数值。
    // 不锁的话能绕到地台底下看穿单面墙，或者转到墙背面对着空气，
    // 那正是"看着别扭"的来源。
    controls.minPolarAngle = Math.PI / 4.4;    // 约 41 度，最高
    controls.maxPolarAngle = Math.PI / 2.2;    // 约 82 度，最低
    controls.minAzimuthAngle = -Math.PI / 16; // 约 -11 度
    controls.maxAzimuthAngle = Math.PI / 1.75;// 约 103 度
    // 鼠标映射和厨房一致：左键平移、右键旋转、中键缩放
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };

    // 家具、材质、灯光都在 geometry 文件里搭。
    // 几何体不回传值，是往这个 api 对象上写东西（roomGroup / lights /
    // envRenderTarget），所以要把对象本身留着，销毁时才能释放 PMREM。
    var TWEEN = global.TWEEN;

    geoArgs = { THREE: THREE, scene: scene, renderer: renderer };
    global.buildBedroomGeometry(geoArgs);
    // 记一份落地灯的白天强度，关灯时才知道要恢复成多少
    if (geoArgs.lampLight) geoArgs.lampDay = geoArgs.lampLight.intensity;
    else geoArgs.lampDay = 0;

    // -----------------------------------------------------------------
    // HUD 按钮逻辑
    // -----------------------------------------------------------------
    // 和厨房一致：状态存在场景层，HUD 只负责标记。
    var L = geoArgs.lights || {};
    var lampLight = geoArgs.lampLight || null;

    // 几何体里已经乘过 π 的"白天"强度，夜晚从这里按比例往下压。
    var DAY = {
      sun: L.sun ? L.sun.intensity : 0,
      hemi: L.hemi ? L.hemi.intensity : 0,
      fill: L.fill ? L.fill.intensity : 0
    };
    var NIGHT = { sun: DAY.sun * 0.10, hemi: DAY.hemi * 0.42, fill: DAY.fill * 0.5 };

    var toast = host.querySelector('#interactive-toast');
    var toastTimer;
    function showNotification(txt) {
      if (!toast) return;
      toast.textContent = txt;
      toast.style.opacity = '1';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toast.textContent = '拖动平移视角 · 右键旋转 · 点地板走动';
        toast.style.opacity = '0';
      }, 2200);
    }

    var isDaylight = true;
    var isLampOn = true;
    var isCozy = false;

    function setMood(isDay) {
      isDaylight = isDay;
      var icon = host.querySelector('#bd-mood-icon');
      var text = host.querySelector('#bd-mood-text');
      var btn = host.querySelector('#bd-mood');
      var tgt = isDay ? DAY : NIGHT;

      if (icon) icon.textContent = isDay ? '☀️' : '🌙';
      if (text) text.textContent = isDay ? '午后暖阳' : '夜晚小灯';
      if (btn) btn.classList.toggle('bd-btn-on', isDay);

      // 夜间把阳光调暗、天空光调暖；场景背景同步压暗，
      // 否则暖色房间配亮背景会像白天。用 makeBg 算好的线性值。
      var bg = scene.background;
      var tgtBg = isDay ? BG_DAY : BG_NIGHT;
      new TWEEN.Tween(bg).to({ r: tgtBg.r, g: tgtBg.g, b: tgtBg.b }, 800).start();
      if (L.sun) new TWEEN.Tween(L.sun).to({ intensity: tgt.sun }, 800).start();
      if (L.hemi) new TWEEN.Tween(L.hemi).to({ intensity: tgt.hemi }, 800).start();
      if (L.fill) new TWEEN.Tween(L.fill).to({ intensity: tgt.fill }, 800).start();

      showNotification(isDay ? '已切换：午后暖阳模式 ☀️' : '已切换：夜晚小灯模式 🌙');
    }

    function toggleMood() { setMood(!isDaylight); }

    function toggleLamp() {
      isLampOn = !isLampOn;
      var btn = host.querySelector('#bd-lamp');
      if (btn) btn.classList.toggle('bd-btn-on', isLampOn);
      if (lampLight) {
        // 灯罩和灯泡也跟着暗下来，不然关了灯灯罩还是亮的，看着假。
        // 只处理有 emissive 的材质（灯罩 + 灯泡），地面和家具不动。
        new TWEEN.Tween(lampLight).to({
          intensity: isLampOn ? geoArgs.lampDay : 0
        }, 400).start();
        var g = lampLight.parent;
        if (g) {
          g.traverse(function (o) {
            if (!o.isMesh || !o.material || !o.material.emissive) return;
            // 第一次进来时把原值记下来，后面直接用它当恢复目标
            if (o.material.userData.emissiveDay === undefined) {
              o.material.userData.emissiveDay = o.material.emissiveIntensity;
            }
            new TWEEN.Tween(o.material).to({
              emissiveIntensity: isLampOn ? o.material.userData.emissiveDay : 0
            }, 400).start();
          });
        }
      }
      showNotification(isLampOn ? '落地灯亮起来了 💡' : '落地灯已关');
    }

    function toggleCozy() {
      isCozy = !isCozy;
      var btn = host.querySelector('#bd-glow');
      if (btn) btn.classList.toggle('bd-btn-on', isCozy);
      // 只动曝光度，不动灯 —— 这是最不破坏原本配色的柔化方式。
      new TWEEN.Tween(renderer)
        .to({ toneMappingExposure: isCozy ? 0.22 : 0.30 }, 700)
        .start();
      showNotification(isCozy ? '调暗一档，适合夜里看 🌙' : '恢复原本亮度 ✨');
    }

    function resetView() {
      if (!camera || !controls) return;
      camera.position.copy(defaultCamPos);
      camera.zoom = 1;
      controls.target.copy(defaultLookAt);
      controls.update();
      fitCamera();
      showNotification('视角已重置 ↺');
    }

    // attach() 时要能重新绑，和厨房的 bindHudButton 同一个理由：
    // 房间来回切，容器 innerHTML 被重建过。所以这里把 handler 记下来，
    // 销毁时能摘掉（见 hudUnbind）。
    function bindHudButton(sel, fn) {
      var el = host.querySelector(sel);
      if (!el) return;
      var h = function (e) {
        e.stopPropagation();
        fn();
      };
      el.addEventListener('click', h);
      hudHandlers.push({ el: el, h: h });
    }
    function rebindHudButtons() {
      hudUnbind();          // 模块级的那个
      bindHudButton('#bd-mood', toggleMood);
      bindHudButton('#bd-lamp', toggleLamp);
      bindHudButton('#bd-glow', toggleCozy);
      bindHudButton('#bd-reset', resetView);
    }
    rebindHudButtons();

    // ---- 动画循环 ----
    // 3D 小人已下线，这里只转场景；人物由 2D 覆盖层（.home-person）渲染。
    function animate(now) {
      if (destroyed || !renderer || !scene) return;
      animId = requestAnimationFrame(animate);
      lastFrame = now;
      // 容器尺寸还没稳定时继续重试取景
      if (fitRetry > 0 && !fitCamera()) fitRetry++;
      // HUD 的昼夜切换、落地灯、氛围都是 TWEEN 补间，必须每帧推进，
      // 不调 TWEEN.update() 的话这些补间永远不会动。
      if (TWEEN) TWEEN.update();
      controls.update();
      renderer.render(scene, camera);
    }
    lastFrame = 0;
    animate(performance.now());

    // ---- resize ----
    // 正交相机没有 aspect，取景由 fitCamera() 按容器尺寸重算。
    // 容器尺寸在刚 inject HUD 之后可能还是 0，所以连续几帧重试，
    // 直到拿到真实尺寸为止（拿到就停）。
    var fitRetry = 0;
    function onResize() {
      if (!host || !renderer || !camera) return;
      if (fitCamera()) fitRetry = 0;
      else if (fitRetry < 30) fitRetry++;
    }
    resizeHandler = onResize;
    global.addEventListener('resize', onResize);
    onResize();

    // ---- 世界坐标 -> 屏幕像素 ----
    // room-view-3d.js 用它把互动结果贴在点中的 3D 家具旁边
    function projectToScreen(world) {
      if (!world || !scene || !camera) return null;
      var roomHost = document.querySelector('.home-room');
      if (!roomHost) return null;
      var v = new THREE.Vector3(world.x, world.y || 0, world.z);
      v.project(camera);
      // 返回的坐标要落在外层 .home-room 上（泡泡是它的子节点）。
      // 注意别用 host（.bedroom-embed）—— 它 bottom:58px，尺寸和位置都不同。
      var rect = roomHost.getBoundingClientRect();
      return { x: (v.x * 0.5 + 0.5) * rect.width, y: (-v.y * 0.5 + 0.5) * rect.height };
    }
    if (global.Home3DRoom) {
      global.Home3DRoom.setProjector(projectToScreen, { roomId: 'bedroom' });
    }

    // ---- 3D 人物插槽 ----
    // 场景建好了才挂人。必须在 renderHome 之后（异步）调用 ——
    // 同步问的话此刻场景还不存在。
    if (typeof global.mountHomeCharacter3D === 'function') {
      global.mountHomeCharacter3D('bedroom', scene);
    }

    // ---- 拾取 ----
    function openFurniture(fid, hitPoint) {
      if (hitPoint && global.HomeCharacter3D) {
        // 卧室是 3D 房间：点地板把 3D 人物移过去。
        // 3D 人物位置由 character-3d.js 自己在场景里处理，
        // 这里只给世界坐标。
        // y 用实际命中高度，不要写死 0 —— 地毯、蒲团是浮在地板上的几层，
        // 写死 0 站在上面会陷进去。
        global.HomeCharacter3D.setPosition({ x: hitPoint.x, y: hitPoint.y, z: hitPoint.z });
      }
      if (typeof global.openFurniture === 'function') global.openFurniture(fid, hitPoint);
    }
    global.bedroom3DOpenFurniture = openFurniture;

    // 只在点击时算交点，拖动不触发（拖动是转视角）
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    var pointerDownPos = { x: 0, y: 0 };
    var pointerMoved = false;
    var onPointerDown = function (e) {
      pointerDownPos.x = e.clientX;
      pointerDownPos.y = e.clientY;
      pointerMoved = false;
    };
    var onPointerMove = function (e) {
      var dx = e.clientX - pointerDownPos.x;
      var dy = e.clientY - pointerDownPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > 8) pointerMoved = true;
    };
    var onPointerUp = function (e) {
      if (pointerMoved) return;
      var rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      var intersects = raycaster.intersectObjects(scene.children, true);
      if (!intersects.length) return;
      var hit = intersects[0];

      // 人物自己也在 scene.children 里，不排除的话射线会先打中她
      // （她 3.8 单位高，从相机看过去挡得很准），后面什么都不用判了。
      if (global.HomeCharacter3DGirl && global.HomeCharacter3DGirl.root) {
        var charRoot = global.HomeCharacter3DGirl.root();
        if (charRoot && isUnder(hit.object, charRoot)) return;
      }

      var obj = hit.object;
      // 家具 id 标在 mesh.userData.fid 上，向上找最近的带 id 的祖先
      var fid = null;
      while (obj) {
        if (obj.userData && obj.userData.fid) { fid = obj.userData.fid; break; }
        obj = obj.parent;
      }
      if (fid) {
        openFurniture(fid, hit.point);
      } else if (global.Home3DRoom && global.Home3DRoom.isFloorHit(hit, scene)) {
        // 点地面：让 3D 人物走过去。
        // 判定和坐标换算都在 room-view-3d.js 里，厨房用同一套。
        // 之前卧室自己写了一份 "hit.point.y < 0.3"，厨房压根没这个分支，
        // 所以在厨房点地面没反应；而且那份判断也认不出地毯（有厚度）。
        global.Home3DRoom.moveCharacterTo(hit.point);
      }
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    pointerHandlers = { onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp };
  }

  function resetBedroom3DView() {
    if (!camera || !controls) return;
    camera.position.set(12.5, 13.05, 12.5);
    camera.zoom = 1;
    controls.target.set(0, 3.0, 0);
    controls.update();
  }

  /** obj 是不是 root 的后代（自己也算）。用于把人从射线检测里排除掉。 */
  function isUnder(obj, root) {
    var p = obj;
    while (p) {
      if (p === root) return true;
      p = p.parent;
    }
    return false;
  }

  function destroyBedroom3D() {
    // 场景没了，投影函数必须撤掉 —— 它闭包引用了即将 dispose 的 camera
    if (global.Home3DRoom) global.Home3DRoom.clearProjector();
    // 3D 人物挂在场景里，销毁前先摘掉，否则残留孤儿 mesh
    if (global.HomeCharacter3D) global.HomeCharacter3D.dispose();
    destroyed = true;
    if (initTimer) { clearTimeout(initTimer); initTimer = null; }
    initAttempts = 0;
    // PMREM 的 render target 不在 scene.traverse 覆盖范围内，得单独释放
    if (geoArgs && geoArgs.envRenderTarget) {
      geoArgs.envRenderTarget.dispose();
      geoArgs = null;
    }
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    var cv = document.querySelector('.home-room.bedroom canvas.bd-canvas');
    if (cv && pointerHandlers) {
      cv.removeEventListener('pointerdown', pointerHandlers.onPointerDown);
      cv.removeEventListener('pointermove', pointerHandlers.onPointerMove);
      cv.removeEventListener('pointerup', pointerHandlers.onPointerUp);
    }
    pointerHandlers = null;
    hudUnbind();
    if (resizeHandler) { global.removeEventListener('resize', resizeHandler); resizeHandler = null; }
    if (controls) { controls.dispose(); controls = null; }
    if (renderer) { renderer.dispose(); renderer = null; }
    if (scene) {
      scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          var list = Array.isArray(obj.material) ? obj.material : [obj.material];
          list.forEach(function (m) { if (m) m.dispose(); });
        }
      });
      scene = null;
    }
    camera = null;
    lastFrame = 0;
  }

  global.initBedroom3D = initBedroom3D;
  global.destroyBedroom3D = destroyBedroom3D;
  global.resetBedroom3DView = resetBedroom3DView;
})(window);
