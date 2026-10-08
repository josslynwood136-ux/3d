/* ============================================================
 * js/home/character-3d-ghost.js — 家园 3D 人物：Ghost（西蒙·莱利）
 * ============================================================
 *
 * 接在 character-3d.js 那个插槽上。房间层只认 mount / setPosition /
 * setPose / setConfig / dispose 这五个方法。
 *
 * 模型
 * ----
 * ghost-udt.glb
 *   使命召唤 MW2 官方 Ghost（Simon Riley）UDT 造型，
 *   由 GMod/Source 引擎包经 Blender + SourceIO 转换而来：
 *   ValveBiped 标准骨架 133 骨，网格 21 件（含 gear 挂件），贴图 webp。
 *   游戏内容版权归动视，仅限个人学习使用。
 *
 * 注意
 * ----
 *   * 必须走 http。file:// 下 fetch .glb 会被 CORS 挡掉。
 *   * 骨骼是 ValveBiped.Bip01_* 命名，姿势系统按它适配。
 * ============================================================ */
(function (global) {
  'use strict';

  var MODEL_URL = 'js/home/ghost-udt.glb';

  // 模块内状态
  var cached = null;
  var loading = null;
  var live = null;
  var currentPose = 'stand';
  var moving = false;
  var warnedConfig = false;
  // 点地走动：moveTo 只写目标，startLoop 的每帧 step 里推进位置
  var walking = false;
  var walkTarget = null;   // {x, y, z}
  var walkSpeed = 2.05;    // 房间单位/秒，mount 里算（见 mount）
  var walkTimeScale = 1;   // 步频 = 实际速度 ÷ 满速步幅，跟 walkSpeed 锁死

  function say(state, text) {
    try {
      global.dispatchEvent(new CustomEvent('home:character', {
        detail: { state: state, text: text }
      }));
    } catch (e) { }
    if (state === 'error') console.warn('[home/character-3d-ghost] ' + text);
  }

  // ------------------------------------------------------------
  // 加载 + 归一化
  // ------------------------------------------------------------

  function loadModel(THREE) {
    if (cached) return Promise.resolve(cached);
    if (loading) return loading;
    if (!global.GLTFLoader) {
      return Promise.reject(new Error('GLTFLoader 没加载'));
    }

    say('loading', '正在加载 Ghost 模型…');
    loading = new Promise(function (resolve, reject) {
      new global.GLTFLoader().load(MODEL_URL, function (gltf) {
        try {
          cached = prepare(THREE, gltf);
          loading = null;
          loadWalkClip(THREE);   // 顺便把下载来的走路动作重定向好
          resolve(cached);
        } catch (e) {
          loading = null;
          reject(e);
        }
      }, undefined, function (err) {
        loading = null;
        var msg = (err && err.message) ? err.message : String(err);
        if (global.location && global.location.protocol === 'file:') {
          msg = '浏览器不允许 file:// 直接读 .glb。请用本地服务器打开。';
        }
        reject(new Error(msg));
      });
    });
    return loading;
  }

  function prepare(THREE, gltf) {
    var model = gltf.scene || (gltf.scenes && gltf.scenes[0]);
    if (!model) throw new Error('GLB 里没有 scene');

    // 量原始包围盒
    model.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) throw new Error('GLB 几何体是空的');
    var size = new THREE.Vector3();
    var mid = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(mid);
    var rawHeight = Math.max(1e-4, size.y);

    // 四层结构：place → holder → turn → model
    var place = new THREE.Group();
    place.name = 'home-character-place';
    var holder = new THREE.Group();
    var turn = new THREE.Group();
    place.add(holder);
    holder.name = 'home-character';
    holder.scale.setScalar(1);
    holder.position.set(0, 0, 0);
    holder.add(turn);
    turn.add(model);
    place.updateWorldMatrix(true, true);

    // 收集骨骼。
    // GLB 里的名字带点（ValveBiped.Bip01_Pelvis），AnimationMixer 的轨道名
    // 是按 “节点名.属性” 解析的，名字里有点会解析错 —— 加载时先把点去掉。
    var bones = {};
    var parentName = {};
    model.traverse(function (o) {
      if (!o.isBone || !o.name) return;
      o.name = o.name.replace(/\./g, '');
      if (bones[o.name]) return;
      bones[o.name] = o;
      parentName[o.name] = (o.parent && o.parent.isBone && o.parent.name) ? o.parent.name : null;
    });

    // 存 bind 姿态
    var bindLocalQ = {};
    var bindLocalP = {};
    Object.keys(bones).forEach(function (name) {
      var b = bones[name];
      bindLocalQ[name] = b.quaternion.clone();
      bindLocalP[name] = b.position.clone();
    });

    // 存 bind 姿态的世界变换（位置 + 朝向 + 缩放），走路重定向要用
    model.updateMatrixWorld(true);
    var restW = {};
    var topParent = {};
    Object.keys(bones).forEach(function (name) {
      var b = bones[name];
      restW[name] = {
        pos: new THREE.Vector3().setFromMatrixPosition(b.matrixWorld),
        quat: new THREE.Quaternion().setFromRotationMatrix(b.matrixWorld),
        scale: new THREE.Vector3().setFromMatrixScale(b.matrixWorld)
      };
      // 最顶层的骨（父节点不是骨）记一下父节点矩阵：骨架上面可能还挂着
      // armature / 根节点，它们不参与动画，但坐标换算要用它们的变换
      if (!parentName[name] && b.parent) topParent[name] = b.parent.matrixWorld.clone();
    });

    // 网格设置
    model.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      o.frustumCulled = false;
    });

    // 记录左右臂在 bind 姿态下向世界哪一侧伸出（A-pose 下 L 臂朝 +X）
    var armOut = { L: 1, R: -1 };
    ['L', 'R'].forEach(function (side) {
      var b = bones['ValveBipedBip01_' + side + '_UpperArm'];
      if (!b) return;
      var wq = b.getWorldQuaternion(new THREE.Quaternion());
      var d = new THREE.Vector3(1, 0, 0).applyQuaternion(wq);
      armOut[side] = d.x >= 0 ? 1 : -1;
    });

    return {
      THREE: THREE,
      place: place,
      holder: holder,
      turn: turn,
      model: model,
      bones: bones,
      bindLocalQ: bindLocalQ,
      bindLocalP: bindLocalP,
      restW: restW,
      parentName: parentName,
      topParent: topParent,
      armOut: armOut,
      rawHeight: rawHeight,
      bbox: { min: box.min.clone(), max: box.max.clone(), size: size.clone() },
      bboxCenter: mid.clone()
    };
  }

  // ------------------------------------------------------------
  // 适配层
  // ------------------------------------------------------------

  var adapter = {
    poses: [
      { id: 'stand', label: '站立' },
      { id: 'walk', label: '走路' },
      { id: 'sit', label: '坐下' },
      { id: 'wave', label: '挥手' }
    ],
    currentPose: function () { return currentPose; },
    currentYaw: function () {
      return live ? live.turn.rotation.y : 0;
    },
    currentSize: function () { return 11; },

    mount: function (opts) {
      opts = opts || {};
      var THREE = opts.THREE || global.THREE;
      var scene = opts.scene;
      if (!THREE || !scene) return Promise.resolve(false);

      if (live && live.scene === scene && live.place.parent) {
        return Promise.resolve(true);
      }
      if (live) adapter.dispose();

      var roomId = opts.roomId;
      if (roomId) activeRoomId = roomId;
      return loadModel(THREE).then(function (m) {
        if (!scene) return false;

        scene.add(m.place);
        // 缩放：Ghost 要比女孩高一头，基准从 1.7 加到 2.0
        var roomScale = roomId === 'smallkitchen' ? 2.0 : 2.3;
        m.holder.scale.setScalar((2.0 * roomScale) / m.rawHeight);
        // 走路速度：跟女孩同一个步速感觉 —— 她 1.7 房间单位/秒、身高
        // 1.66 × roomScale，Ghost 身高 2.0 × roomScale，按身高等比 ≈ 2.05。
        // 满速步幅 = (walk.smd 根位移 80 单位/秒 ÷ 源模型高约 76 单位) × 身高，
        // 步频 timeScale = 实际速度 ÷ 满速步幅 —— 位移慢放也慢，
        // 步子和地面移动锁死，不会脚底打滑。
        walkSpeed = 1.7 * 2.0 / 1.66;
        walkTimeScale = walkSpeed / ((80 / 76) * 2.0 * roomScale);
        m.turn.rotation.y = -0.42;
        // 默认站位
        var dp = roomId === 'smallkitchen' ? { x: 2.0, z: 1.5 } : { x: 1.6, z: 1.8 };
        m.place.position.set(dp.x, 0, dp.z);

        live = { scene: scene, place: m.place, holder: m.holder, turn: m.turn, model: m.model };
        currentPose = 'stand';
        applyPose('stand');
        say('ready', '');

        console.info('[home/character-3d-ghost] 已挂载到 ' + (roomId || '?') +
          '：' + Math.round(m.bbox.size.y) + ' 模型单位');
        return true;
      }).catch(function (e) {
        say('error', e && e.message ? e.message : String(e));
        return false;
      });
    },

    setPosition: function (world) {
      if (!live || !world) return;
      // 瞬移（初始化/切房间）：把进行中的走动也一并掐掉
      walking = false;
      walkTarget = null;
      if (world.x != null) live.place.position.x = world.x;
      if (world.y != null) live.place.position.y = world.y;
      if (world.z != null) live.place.position.z = world.z;
      live.place.updateWorldMatrix(true, true);
    },

    /**
     * 走过去。只写目标点 + 面向，由 startLoop 的 step 每帧推进
     * place.position（带实时避障），到达后切回站立。
     * 瞬移请用 setPosition。
     *
     * world.y 必须是调用方（房间场景）验证过的地面高度，
     * 否则会陷进地板 / 飘起来。
     */
    moveTo: function (world) {
      if (!live || !world) return;
      var px = live.place.position.x;
      var pz = live.place.position.z;
      var dx = (world.x != null ? world.x : px) - px;
      var dz = (world.z != null ? world.z : pz) - pz;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.1) return;   // 目标太近，原地不动

      walkTarget = {
        x: px + dx,
        y: world.y != null ? world.y : live.place.position.y,
        z: pz + dz
      };
      // 面向目标（+Z 是模型正前方，所以 yaw = atan2(dx, dz)）
      live.turn.rotation.y = Math.atan2(dx, dz);
      live.place.updateWorldMatrix(true, true);

      walking = true;
      moving = true;
      adapter.setPose('walk', { moving: true });
    },

    /** 立刻停下，不再往 walkTarget 走，保持当前姿势。 */
    stop: function () {
      walking = false;
      walkTarget = null;
      moving = false;
      if (currentPose === 'walk') adapter.setPose('stand', { moving: false });
    },

    setPose: function (pose, opts) {
      opts = opts || {};
      // 换成别的姿势（家具动作等）就取消进行中的走动
      if (pose && pose !== 'walk') { walking = false; walkTarget = null; }
      if (pose) currentPose = pose;
      moving = !!opts.moving;
      if (live) applyPose(currentPose);
    },

    setConfig: function (config) {
      config = config || {};
      if (!live) return;
      if (config.yaw != null && isFinite(Number(config.yaw))) {
        live.turn.rotation.y = Number(config.yaw);
        live.place.updateWorldMatrix(true, true);
      }
    },

    dispose: function () {
      stopLoop();
      stopWalkAction();
      if (live && live.place.parent) live.place.parent.remove(live.place);
      live = null;
      currentPose = 'stand';
      walking = false;
      walkTarget = null;
      moving = false;
    },

    root: function () { return cached ? cached.place : null; },
    tick: function () { },
    debug: function () {
      if (!cached) return null;
      return {
        bones: Object.keys(cached.bones).length,
        height: cached.bbox.size.y,
        pos: live ? [live.place.position.x, live.place.position.y, live.place.position.z] : null,
        walking: walking,
        walkTarget: walkTarget ? [walkTarget.x, walkTarget.z] : null,
        walkSpeed: walkSpeed,
        walkTimeScale: walkTimeScale
      };
    },

    debugBones: function () {
      if (!cached) return [];
      return Object.keys(cached.bones).map(function (n) {
        return { name: n };
      });
    },

    debugTree: function () {
      if (!live) return null;
      var lines = [];
      (function walk(node, depth) {
        if (depth > 3) return;
        lines.push('  '.repeat(depth) + node.name + ' [' + node.type + ']');
        for (var i = 0; i < node.children.length; i++) walk(node.children[i], depth + 1);
      })(live.place, 0);
      return lines.join('\n');
    }
  };

  // 当前房间 ID
  var activeRoomId = null;

  // ------------------------------------------------------------
  // 真人走路动画：walking.fbx（Mixamo 免费走路循环，和女孩共用一个文件）
  //
  // 源骨架是 Mixamo（T-pose 绑姿），Ghost 是 ValveBiped（A-pose 绑姿），
  // 两边骨名、朝向、缩放都不一样，所以不能直接搬轨道，要重定向：
  //
  //   · 骨干（盆骨/脊柱/脖子/头）→ 世界空间 delta：
  //     两边站姿都是直立的，把源骨架“从绑姿到动画帧”的世界旋转整体搬过来，
  //     保留转身、前倾、肩部扭动。
  //
  //   · 四肢（大腿/小腿/脚/上臂/小臂）→ 方向对齐：
  //     Mixamo 绑姿手臂平举、Valve 手臂下垂，直接搬 delta 会把手臂甩进身体；
  //     改成“让这根骨指向动画里对应关节连线的方向”——只看绝对方向，
  //     跟绑姿无关，所以下垂的手臂自然跟着摆、膝盖也不会反弯。
  //
  //   · 坐标系对齐：先按「盆骨→头顶 + 左肩−右肩」给两个骨架各搭一个身体
  //     坐标系，求旋转 R；源骨架的方向/位移先乘 R 搬到 Ghost 的坐标系里，
  //     这样两边面朝方向不同（±Z）也不影响。
  //
  //   · 盆骨位置只保留上下起伏（沿 Ghost 朝上的轴投影），前进位移丢掉 ——
  //     前进由 moveTo 控制。
  // ------------------------------------------------------------
  var WALK_URL = 'js/home/walking.fbx';
  var SMD_WALK_URL = 'js/home/walk.smd';   // 原生 ValveBiped 走步（优先）
  var wk = { clip: null, mixer: null, action: null, loading: false, failed: false };

  // 世界空间 delta 的骨干：[源骨, 目标骨]
  var WALK_DELTA_MAP = [
    ['Hips', 'Bip01_Pelvis'],
    ['Spine', 'Bip01_Spine1'],
    ['Spine1', 'Bip01_Spine3'],
    ['Spine2', 'Bip01_Spine4'],
    ['Neck', 'Bip01_Neck1'],
    ['Head', 'Bip01_Head1']
  ];

  // 方向对齐的四肢：[源骨, 源参照关节, 目标骨, 目标参照关节]，方向 = 骨 → 参照关节
  var WALK_DIR_MAP = [
    ['LeftUpLeg', 'LeftLeg', 'Bip01_L_Thigh', 'Bip01_L_Calf'],
    ['LeftLeg', 'LeftFoot', 'Bip01_L_Calf', 'Bip01_L_Foot'],
    ['LeftFoot', 'LeftToeBase', 'Bip01_L_Foot', 'Bip01_L_Toe0'],
    ['RightUpLeg', 'RightLeg', 'Bip01_R_Thigh', 'Bip01_R_Calf'],
    ['RightLeg', 'RightFoot', 'Bip01_R_Calf', 'Bip01_R_Foot'],
    ['RightFoot', 'RightToeBase', 'Bip01_R_Foot', 'Bip01_R_Toe0'],
    ['LeftArm', 'LeftForeArm', 'Bip01_L_UpperArm', 'Bip01_L_Forearm'],
    ['LeftForeArm', 'LeftHand', 'Bip01_L_Forearm', 'Bip01_L_Hand'],
    ['RightArm', 'RightForeArm', 'Bip01_R_UpperArm', 'Bip01_R_Forearm'],
    ['RightForeArm', 'RightHand', 'Bip01_R_Forearm', 'Bip01_R_Hand']
  ];

  // 骨名归一化：mixamorig:Hips / mixamorigHips / ValveBiped.Bip01_Pelvis 都能对上
  function normBone(s) {
    return String(s == null ? '' : s).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  }

  function pickBone(table, key) {
    var k = normBone(key);
    if (!k) return null;
    if (table[k]) return table[k];
    var names = Object.keys(table);
    for (var i = 0; i < names.length; i++) {
      if (names[i].length >= k.length && names[i].slice(-k.length) === k) return table[names[i]];
    }
    return null;
  }

  // 身体坐标系：up = 盆骨→头顶，left = 左肩 − 右肩，fwd = left × up
  function makeFrame(THREE, hipsP, headP, lP, rP) {
    var up = headP.clone().sub(hipsP).normalize();
    var left = lP.clone().sub(rP).normalize();
    left.addScaledVector(up, -left.dot(up)).normalize();
    var fwd = left.clone().cross(up).normalize();     // left × up = 面朝方向
    up = fwd.clone().cross(left).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(left, up, fwd));
  }

  function loadWalkClip(THREE) {
    if (wk.clip || wk.failed || wk.loading) return;

    // 优先走 walk.smd：Source 引擎 ValveBiped 原生动作，骨名直接对得上，
    // 不需要跨骨架重定向。文件不在或解析失败就退回 walking.fbx（Mixamo）。
    if (global.SMDClip && global.fetch) {
      wk.loading = true;
      fetch(SMD_WALK_URL).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      }).then(function (text) {
        var clip = global.SMDClip.build(THREE, text, cached);
        wk.loading = false;
        wk.clip = clip;
        console.info('[home/character-3d-ghost] walk.smd 原生重定向完成：' + clip.name +
          '（' + clip.duration.toFixed(2) + 's，' + clip.tracks.length + ' 条轨道）');
        if (currentPose === 'walk' && live) applyPose('walk');
      }).catch(function (e) {
        wk.loading = false;
        console.info('[home/character-3d-ghost] walk.smd 不可用（' +
          (e && e.message ? e.message : e) + '），改走 walking.fbx');
        loadWalkClipFbx(THREE);
      });
      return;
    }
    loadWalkClipFbx(THREE);
  }

  function loadWalkClipFbx(THREE) {
    if (wk.clip || wk.failed || wk.loading) return;
    if (!global.FBXLoader) { wk.failed = true; return; }
    wk.loading = true;
    new global.FBXLoader().load(WALK_URL, function (fbx) {
      wk.loading = false;
      try {
        wk.clip = buildWalkClip(THREE, fbx);
        console.info('[home/character-3d-ghost] 走路动作重定向完成：' + wk.clip.name +
          '（' + wk.clip.duration.toFixed(2) + 's，' + wk.clip.tracks.length + ' 条轨道）');
        if (currentPose === 'walk' && live) applyPose('walk');
      } catch (e) {
        wk.failed = true;
        console.warn('[home/character-3d-ghost] 走路动作构建失败，退回程序摆腿', e);
      }
    }, undefined, function (e) {
      wk.loading = false;
      wk.failed = true;
      console.warn('[home/character-3d-ghost] walking.fbx 下载失败', e);
    });
  }

  /**
   * 把 walking.fbx 的走路循环重定向到 Ghost 的 ValveBiped 骨架上，
   * 返回一条可以直接给 AnimationMixer 用的 AnimationClip。
   */
  function buildWalkClip(THREE, fbx) {
    var m = cached;
    if (!m) throw new Error('Ghost 模型还没准备好');

    var clips = fbx.animations || [];
    var srcClip = null;
    for (var ci = 0; ci < clips.length; ci++) {
      if (clips[ci] && clips[ci].duration > 0.001) { srcClip = clips[ci]; break; }
    }
    if (!srcClip) throw new Error('walking.fbx 里没有动画');

    // 两边的骨名表
    var srcTable = {};
    fbx.traverse(function (o) {
      if (!o.isBone || !o.name) return;
      var k = normBone(o.name);
      if (!srcTable[k]) srcTable[k] = o;
    });
    var tgtTable = {};
    Object.keys(m.bones).forEach(function (n) { tgtTable[normBone(n)] = m.bones[n]; });

    function src(n) {
      var b = pickBone(srcTable, n);
      if (!b) throw new Error('动作骨架缺骨：' + n);
      return b;
    }
    function tgt(n) {
      var b = pickBone(tgtTable, n);
      if (!b) throw new Error('Ghost 缺骨：' + n);
      return b;
    }

    function sPos(b) { return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); }
    function sQuat(b) { return new THREE.Quaternion().setFromRotationMatrix(b.matrixWorld); }

    // ---- 源骨架绑姿（还没播放动画时读）----
    fbx.updateMatrixWorld(true);
    var sHips = src('Hips'), sHead = src('Head'), sLSh = src('LeftShoulder'), sRSh = src('RightShoulder');
    var sHipsRest = sPos(sHips), sHeadRest = sPos(sHead);
    var sFrame = makeFrame(THREE, sHipsRest, sHeadRest, sPos(sLSh), sPos(sRSh));
    var sDeltaRest = {};
    WALK_DELTA_MAP.forEach(function (p) { sDeltaRest[p[0]] = sQuat(src(p[0])); });

    // ---- Ghost 绑姿 ----
    var tHips = tgt('Bip01_Pelvis'), tHead = tgt('Bip01_Head1'),
      tLSh = tgt('Bip01_L_Clavicle'), tRSh = tgt('Bip01_R_Clavicle');
    var rHips = m.restW[tHips.name], rHead = m.restW[tHead.name];
    var tFrame = makeFrame(THREE, rHips.pos, rHead.pos,
      m.restW[tLSh.name].pos, m.restW[tRSh.name].pos);

    // 坐标系对齐旋转：源 → Ghost
    var R = tFrame.clone().multiply(sFrame.clone().invert());
    var scale = rHips.pos.distanceTo(rHead.pos) / sHipsRest.distanceTo(sHeadRest);

    // ---- 组装每一根要驱动的骨（按 父在前 子在后 排序）----
    var items = [];
    WALK_DELTA_MAP.forEach(function (p) {
      var tb = tgt(p[1]);
      items.push({ kind: 0, sb: src(p[0]), t: tb, sRest: sDeltaRest[p[0]], tRest: m.restW[tb.name].quat });
    });
    WALK_DIR_MAP.forEach(function (p) {
      var tb = tgt(p[2]), tr = tgt(p[3]);
      items.push({
        kind: 1, sb: src(p[0]), sr: src(p[1]), t: tb, tRest: m.restW[tb.name].quat,
        restDir: m.restW[tr.name].pos.clone().sub(m.restW[tb.name].pos).normalize()
      });
    });

    function depthOf(name) {
      var d = 0, n = name;
      while (m.parentName[n]) { n = m.parentName[n]; if (++d > 300) break; }
      return d;
    }
    items.sort(function (a, b) { return depthOf(a.t.name) - depthOf(b.t.name); });
    items.forEach(function (it) { it.pname = m.parentName[it.t.name] || null; });

    // ---- 每帧世界变换（用于父→子换算到本地空间）----
    var ID_W = null;
    var animW = {};
    function worldOf(name) {
      if (!name) {
        if (!ID_W) ID_W = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1) };
        return ID_W;
      }
      if (animW[name]) return animW[name];
      var pw, lscale;
      var p = m.parentName[name];
      if (p) {
        pw = worldOf(p);
        lscale = m.restW[name].scale.clone().divide(m.restW[p].scale);
      } else if (m.topParent[name]) {
        var e = m.topParent[name].clone().decompose(new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3());
        pw = { pos: e.position, quat: e.rotation, scale: e.scale };
        lscale = m.restW[name].scale.clone().divide(e.scale);
      } else {
        pw = worldOf(null);
        lscale = m.restW[name].scale.clone();
      }
      var pos = pw.pos.clone().add(
        m.bindLocalP[name].clone().applyQuaternion(pw.quat).multiplyScalar(pw.scale.x));
      var quat = pw.quat.clone().multiply(m.bindLocalQ[name]);
      animW[name] = { pos: pos, quat: quat, scale: pw.scale.clone().multiply(lscale) };
      return animW[name];
    }

    // ---- 抽样 ----
    var mixer = new THREE.AnimationMixer(fbx);
    var act = mixer.clipAction(srcClip);
    act.setLoop(THREE.LoopRepeat, Infinity);
    act.play();

    var fps = 60;
    var n = Math.max(2, Math.round(srcClip.duration * fps) + 1);
    var times = new Float32Array(n);
    var posVals = new Float32Array(n * 3);
    var quatVals = {};
    items.forEach(function (it) { quatVals[it.t.name] = new Float32Array(n * 4); });

    var qTmp = new THREE.Quaternion();
    var vTmp = new THREE.Vector3();
    var vTmp2 = new THREE.Vector3();

    for (var i = 0; i < n; i++) {
      times[i] = srcClip.duration * i / (n - 1);
      mixer.setTime(times[i]);
      fbx.updateMatrixWorld(true);
      animW = {};

      for (var k = 0; k < items.length; k++) {
        var it = items[k];
        var pw = worldOf(it.pname);
        var worldQ = new THREE.Quaternion();
        var worldP = null;

        if (it.kind === 0) {
          // 骨干：世界空间 delta
          var d = sQuat(it.sb).multiply(it.sRest.clone().invert());
          worldQ.copy(R).multiply(d).multiply(R.clone().invert()).multiply(it.tRest);
        } else {
          // 四肢：方向对齐
          vTmp.copy(sPos(it.sr)).sub(sPos(it.sb)).normalize().applyQuaternion(R);
          qTmp.setFromUnitVectors(it.restDir, vTmp);
          worldQ.copy(qTmp).multiply(it.tRest);
        }

        // 世界 → 本地
        var localQ = pw.quat.clone().invert().multiply(worldQ);
        var localP;
        if (it.kind === 0 && it.t === tHips) {
          // 盆骨位置：只留世界竖直方向的起伏。
          // 两个模型空间都是 Y-up，直接取源位移的 Y ——
          // 沿“身体轴线”投影不行：源骨架绑姿歪了 3°，而它每周期向前挪
          // 157 单位，沿歪轴（或先用 R 转到目标身体轴）投影都会把前进
          // 位移漏进起伏里，实测会虚高 2.6 倍。
          vTmp2.copy(sPos(it.sb)).sub(sHipsRest);
          var bob = vTmp2.y * scale;
          worldP = rHips.pos.clone().add(new THREE.Vector3(0, bob, 0));
          localP = worldP.sub(pw.pos).applyQuaternion(pw.quat.clone().invert())
            .divideScalar(pw.scale.x || 1);
        } else {
          localP = m.bindLocalP[it.t.name];
        }

        // 世界位置 = 父世界 × 本地（盆骨用算出来的，其余用绑姿的）
        var wpos = pw.pos.clone().add(
          localP.clone().applyQuaternion(pw.quat).multiplyScalar(pw.scale.x));
        animW[it.t.name] = { pos: wpos, quat: worldQ, scale: m.restW[it.t.name].scale.clone() };

        var av = quatVals[it.t.name];
        av[i * 4] = localQ.x; av[i * 4 + 1] = localQ.y;
        av[i * 4 + 2] = localQ.z; av[i * 4 + 3] = localQ.w;
        if (it.t === tHips) {
          posVals[i * 3] = localP.x;
          posVals[i * 3 + 1] = localP.y;
          posVals[i * 3 + 2] = localP.z;
        }
      }
    }
    mixer.stopAllAction();

    // ---- 拼成 AnimationClip ----
    var tracks = [];
    items.forEach(function (it) {
      tracks.push(new THREE.QuaternionKeyframeTrack(it.t.name + '.quaternion',
        times, quatVals[it.t.name]));
    });
    tracks.push(new THREE.VectorKeyframeTrack(tHips.name + '.position', times, posVals));
    return new THREE.AnimationClip('GhostWalk', srcClip.duration, tracks);
  }

  function ensureWalkAction(THREE) {
    if (!wk.clip || !cached) return false;
    if (!wk.mixer) {
      wk.mixer = new THREE.AnimationMixer(cached.model);
      wk.action = wk.mixer.clipAction(wk.clip);
      wk.action.setLoop(THREE.LoopRepeat, Infinity);
    }
    // 步频跟位移速度锁死（见 mount）。每次进入走路都同步一次，
    // 换房间 roomScale 变了也能跟上。
    wk.action.timeScale = walkTimeScale;
    if (!wk.action.isRunning()) { wk.action.reset(); wk.action.play(); }
    return true;
  }

  function stopWalkAction() {
    if (wk.action && wk.action.isRunning()) wk.action.stop();
  }

  // ------------------------------------------------------------
  // 姿势系统（ValveBiped 骨骼，世界方向瞄准法）
  //
  // 每根骨骼的 local +X 都指向它的子骨骼（肩→肘、髋→膝），
  // 所以“把某根骨骼摆到某个世界方向”= 在骨骼自身空间里把 +X
  // 旋到目标方向，不用猜旋转轴。
  // ------------------------------------------------------------

  var anim = { raf: 0, last: 0, phase: 0, target: null };

  function findBone(m, suffix) {
    var names = Object.keys(m.bones);
    for (var i = 0; i < names.length; i++) {
      if (names[i].indexOf(suffix) >= 0) return m.bones[names[i]];
    }
    return null;
  }

  function restoreBind(m) {
    var names = Object.keys(m.bones);
    for (var i = 0; i < names.length; i++) {
      var n = names[i], b = m.bones[n];
      b.quaternion.copy(m.bindLocalQ[n]);
      b.position.copy(m.bindLocalP[n]);
    }
    m.model.updateMatrixWorld(true);
  }

  // 骨骼 +X 轴的当前世界方向
  function worldDirOf(m, bone) {
    var wq = bone.getWorldQuaternion(new m.THREE.Quaternion());
    return new m.THREE.Vector3(1, 0, 0).applyQuaternion(wq).normalize();
  }

  // 把骨骼 local +X 瞄准到世界方向 dir
  function aim(m, bone, dir) {
    if (!bone) return;
    var wq = bone.getWorldQuaternion(new m.THREE.Quaternion());
    var tLocal = dir.clone().applyQuaternion(wq.clone().invert()).normalize();
    var q = new m.THREE.Quaternion().setFromUnitVectors(
      new m.THREE.Vector3(1, 0, 0), tLocal);
    bone.quaternion.multiply(q);
    m.model.updateMatrixWorld(true);
  }

  function aimBy(m, suffix, dir) { aim(m, findBone(m, suffix), dir); }

  // 在世界系里平移骨骼（如坐下时髋部下沉）
  function moveWorld(m, bone, dx, dy, dz) {
    if (!bone || !bone.parent) return;
    var pq = bone.parent.getWorldQuaternion(new m.THREE.Quaternion());
    var delta = new m.THREE.Vector3(dx, dy, dz).applyQuaternion(pq.clone().invert());
    bone.position.add(delta);
    m.model.updateMatrixWorld(true);
  }

  function V(m, x, y, z) { return new m.THREE.Vector3(x, y, z); }

  // 手臂自然下垂（站立 / 坐下共用）：上臂离身 0.22、前 0.10，
  // 肘 14° 微曲（之前上下臂几乎共线，像立正）
  function armsDown(m) {
    ['L', 'R'].forEach(function (side) {
      var out = m.armOut[side];
      aimBy(m, 'Bip01_' + side + '_UpperArm', V(m, 0.22 * out, -1, 0.10).normalize());
      aimBy(m, 'Bip01_' + side + '_Forearm', V(m, 0.14 * out, -1, 0.35).normalize());
    });
  }

  // 放松手型（定轴张开版）：绑姿是紧握拳，手指卷曲轴经实测是局部 Y。
  // slerp 版松了卷也松了展、效果不明显；欧拉版混轴会拧。
  // 这里回到绑姿、只绕 Y 转固定角度张开：单轴、无耦合、不可能拧。
  // ang>0 = 张开。指根 0.5 / 中节 0.6 / 指尖 0.45，拇指小一点。
  function extendJoint(m, fullName, ang) {
    var b = m.bones[fullName];
    if (!b) return;
    var bind = m.bindLocalQ[fullName];
    if (!bind) return;
    b.quaternion.copy(bind).multiply(
      new m.THREE.Quaternion().setFromAxisAngle(new m.THREE.Vector3(0, 1, 0), -ang));
  }
  function relaxHands(m) {
    ['L', 'R'].forEach(function (side) {
      var p = 'ValveBipedBip01_' + side + '_Finger';
      extendJoint(m, p + '0', 0.35);
      extendJoint(m, p + '01', 0.45);
      extendJoint(m, p + '02', 0.45);
      for (var f = 1; f <= 4; f++) {
        extendJoint(m, p + f + '0', 0.5);
        extendJoint(m, p + f, 0.5);
        extendJoint(m, p + f + '1', 0.6);
        extendJoint(m, p + f + '2', 0.45);
      }
    });
  }

  // 站立：手臂放下，腿本来就是直的
  function applyStand(m) {
    armsDown(m);
    relaxHands(m);
  }

  // ---- 走路摆臂（铰链轴重写版）----
  // 老写法每帧 aim()：数学上精确，但瞄错一次翻 180°、手指欧拉手术还会拧，
  // 出问题看不出来。新写法分两步，全部显式：
  //   ① 进入 walk 摆一次中性位（aim 精确，只一次）并缓存四根手臂骨局部角；
  //   ② 每帧复位中性 + 绕"铰链轴"转小角度。铰链轴 = 肢轴(+X) × 目标运动方向
  //      （局部），转正角肢端就往目标方向走——和骨骼 roll 无关，
  //      小角度不可能翻转，角度值就是弧度，一眼能审。
  var walkN = null; // 中性位缓存 {boneName: Quaternion}
  function cacheWalkNeutral(m) {
    ['L', 'R'].forEach(function (side) {
      var out = m.armOut[side];
      aimBy(m, 'Bip01_' + side + '_UpperArm', V(m, 0.34 * out, -1, 0).normalize());
      aimBy(m, 'Bip01_' + side + '_Forearm', V(m, 0.20 * out, -1, 0.30).normalize());
    });
    walkN = {};
    ['L', 'R'].forEach(function (side) {
      ['UpperArm', 'Forearm'].forEach(function (part) {
        var b = findBone(m, 'Bip01_' + side + '_' + part);
        if (b) walkN[b.name] = b.quaternion.clone();
      });
    });
    m.model.updateMatrixWorld(true);
  }
  // 骨骼绕铰链轴转 angle（+angle 把肢端往 worldDir 推）
  function rotateAbout(m, bone, worldDir, angle) {
    if (!bone || Math.abs(angle) < 1e-5) return;
    var wq = bone.getWorldQuaternion(new m.THREE.Quaternion());
    var mLocal = worldDir.clone().applyQuaternion(wq.clone().invert()).normalize();
    var hinge = new m.THREE.Vector3(1, 0, 0).cross(mLocal);
    if (hinge.lengthSq() < 1e-6) return;
    hinge.normalize();
    bone.quaternion.multiply(new m.THREE.Quaternion().setFromAxisAngle(hinge, angle));
  }
  // turn 空间 +Z（模型正前方）对应的世界方向
  function facingWorld(m) {
    var t = (live && live.turn) ? live.turn : null;
    var q = t ? t.getWorldQuaternion(new m.THREE.Quaternion()) : new m.THREE.Quaternion();
    return new m.THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
  }
  // 手臂一帧：复位中性 + 按腿相位反相摆（legPhase + = 腿在前）
  function armFrame(m, side, legPhase) {
    if (!walkN) return;
    var ub = findBone(m, 'Bip01_' + side + '_UpperArm');
    var fb = findBone(m, 'Bip01_' + side + '_Forearm');
    if (ub && walkN[ub.name]) ub.quaternion.copy(walkN[ub.name]);
    if (fb && walkN[fb.name]) fb.quaternion.copy(walkN[fb.name]);
    var fwd = facingWorld(m);
    var aU = -legPhase * 0.8, aF = aU * 0.5;
    rotateAbout(m, ub, fwd, aU);
    rotateAbout(m, fb, fwd, aF);
    m.model.updateMatrixWorld(true);
  }
  // SMD 分支：闭环读大腿解剖方向算相位（大腿 +X 经实测就是肢轴方向）
  function armFrameFromLegs(m) {
    if (!live) return;
    var yaw = live.turn.rotation.y;
    var fx = Math.sin(yaw), fz = Math.cos(yaw);
    ['L', 'R'].forEach(function (side) {
      var thigh = findBone(m, 'Bip01_' + side + '_Thigh');
      if (!thigh) return;
      var td = worldDirOf(m, thigh);
      armFrame(m, side, td.x * fx + td.z * fz);
    });
  }

  // 坐下：髋部下沉约 0.36 模型单位，大腿前伸、小腿下垂
  function applySit(m) {
    moveWorld(m, findBone(m, 'Bip01_Pelvis'), 0, -0.36, 0);
    ['L', 'R'].forEach(function (side) {
      var out = m.armOut[side];
      aimBy(m, 'Bip01_' + side + '_Thigh', V(m, 0.12 * out, -0.32, 1).normalize());
      aimBy(m, 'Bip01_' + side + '_Calf', V(m, 0.10 * out, -1, 0.10).normalize());
    });
    armsDown(m);
    relaxHands(m);
  }

  // 走路骨盆起伏：smd 轨道里只有旋转、没有位移，不补人像飘。
  // 一步一颠、一周期两颠；按 mixer 时间对周期取余算相位。
  function applyWalkBob() {
    if (!cached || !wk.action || !wk.clip || !wk.clip.duration) return;
    var t = wk.action.time % wk.clip.duration;
    var bob = -Math.abs(Math.sin(t / wk.clip.duration * Math.PI * 2)) * 0.018;
    var pb = findBone(cached, 'Bip01_Pelvis');
    if (!pb || !cached.bindLocalP[pb.name]) return;
    pb.position.y = cached.bindLocalP[pb.name].y + bob;
    cached.model.updateMatrixWorld(true);
  }

  // 兜底分支（smd/fbx 都没拿到）：腿也用铰链轴程序摆，不用 aim。
  // 中性位就是绑姿（直腿），摆幅和老参数一致：大腿 ±0.5rad、小腿 ±0.45rad+常曲。
  function walkFrameProcedural(m, t) {
    var p = t * 7.5;
    var fwd = facingWorld(m);
    ['L', 'R'].forEach(function (side) {
      var s = side === 'L' ? Math.sin(p) : -Math.sin(p);   // 腿的相位，+ = 腿前
      var th = findBone(m, 'Bip01_' + side + '_Thigh');
      var ca = findBone(m, 'Bip01_' + side + '_Calf');
      if (th && m.bindLocalQ[th.name]) {
        th.quaternion.copy(m.bindLocalQ[th.name]);
        rotateAbout(m, th, fwd, 0.5 * s);
      }
      if (ca && m.bindLocalQ[ca.name]) {
        ca.quaternion.copy(m.bindLocalQ[ca.name]);
        rotateAbout(m, ca, fwd, 0.45 * s + 0.06);
      }
      armFrame(m, side, 0.55 * s);
    });
    // 兜底分支也没有位移轨，同样补颠
    var pb = findBone(m, 'Bip01_Pelvis');
    if (pb && m.bindLocalP[pb.name]) {
      pb.position.y = m.bindLocalP[pb.name].y - Math.abs(Math.sin(p)) * 0.018;
    }
    m.model.updateMatrixWorld(true);
  }

  // 挥手：右手举过头顶小幅度摇摆，左手自然下垂
  function applyWaveFrame(m, t) {
    var out = m.armOut.R;
    var sw = Math.sin(t * 7);
    aimBy(m, 'Bip01_L_UpperArm', V(m, 0.16 * m.armOut.L, -1, 0.06).normalize());
    aimBy(m, 'Bip01_L_Forearm', V(m, 0.10 * m.armOut.L, -1, 0.03).normalize());
    aimBy(m, 'Bip01_R_UpperArm', V(m, 0.45 * out, 1, 0.15).normalize());
    aimBy(m, 'Bip01_R_Forearm', V(m, out * (0.55 + 0.45 * sw), 1, 0.05).normalize());
    relaxHands(m);
  }

  function stopLoop() {
    if (anim.raf) cancelAnimationFrame(anim.raf);
    anim.raf = 0;
  }

  // 往前走一段会不会撞到东西：从腰高打一条短射线探障碍。
  // 家具会挡住射线，地板不会（射线水平，起点已抬到腰高）。
  // Ghost 腰高按他 4.6 房间单位的身高取 1.1。
  function directCheck(THREE, p, vx, vz, len) {
    if (!THREE || !live || !live.scene) return true;
    var rc = new THREE.Raycaster();
    var start = new THREE.Vector3(
      p.x + vx * 0.15, p.y + 1.1, p.z + vz * 0.15
    );
    rc.set(start, new THREE.Vector3(vx, 0, vz));
    rc.far = Math.max(0.2, len);
    var hits = rc.intersectObjects(live.scene.children, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      if (!o || !o.visible) continue;
      // 自己的 mesh 不算障碍
      if (o === live.model || (live.place && isDescendant(o, live.place))) continue;
      // 薄纱 / 玻璃 / 窗 这些透明层不算，撞上也不该停
      if (o.material && o.material.transparent && o.material.opacity < 0.6) continue;
      return false;
    }
    return true;
  }

  function isDescendant(node, ancestor) {
    var p = node;
    while (p) { if (p === ancestor) return true; p = p.parent; }
    return false;
  }

  // 点地走动：每帧朝 walkTarget 推进 walkSpeed × dt，被家具挡住就沿
  // 扇形找最贴目标的可走方向绕开；到达后切回站立。
  // 只在 currentPose === 'walk' 时被 step 调用。
  function advanceWalk(dt) {
    var w = walkTarget;
    var p = live.place.position;
    var dx = w.x - p.x;
    var dz = w.z - p.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    var step = walkSpeed * dt;

    if (dist <= step || dist < 0.15) {
      // 到了
      p.x = w.x;
      p.z = w.z;
      p.y = w.y;
      walking = false;
      walkTarget = null;
      live.place.updateWorldMatrix(true, true);
      adapter.setPose('stand', { moving: false });
      return;
    }

    var THREE = cached.THREE;
    var th = Math.atan2(dx, dz);
    var vx = dx / dist;
    var vz = dz / dist;
    var reach = Math.max(0.3, step * 2.5);

    if (!directCheck(THREE, p, vx, vz, reach)) {
      // 被挡：在 ±69° 扇形里挑最贴目标又走得通的方向
      var bestScore = -Infinity, bestAng = th;
      for (var a = -1.2; a <= 1.2; a += 0.2) {
        var ang = th + a;
        var cvx = Math.sin(ang), cvz = Math.cos(ang);
        if (!directCheck(THREE, p, cvx, cvz, reach)) continue;
        var score = cvx * vx + cvz * vz;
        if (score > bestScore) { bestScore = score; bestAng = ang; }
      }
      if (bestScore > -Infinity) {
        vx = Math.sin(bestAng);
        vz = Math.cos(bestAng);
      } else {
        // 扇形全堵：原地转圈找任意可走方向，再不行就放弃走
        var rescued = false;
        for (var b = -Math.PI; b < Math.PI && !rescued; b += Math.PI / 8) {
          var bx = Math.sin(b), bz = Math.cos(b);
          if (directCheck(THREE, p, bx, bz, reach)) { vx = bx; vz = bz; rescued = true; }
        }
        if (!rescued) {
          console.info('[home/character-3d-ghost] 行走中止：360° 全堵，位置 (' +
            p.x.toFixed(2) + ', ' + p.z.toFixed(2) + ') 目标 (' +
            w.x.toFixed(2) + ', ' + w.z.toFixed(2) + ')');
          walking = false;
          walkTarget = null;
          adapter.setPose('stand', { moving: false });
          return;
        }
      }
    }

    p.x += vx * step;
    p.z += vz * step;
    p.y = w.y;
    live.turn.rotation.y = Math.atan2(vx, vz);
    live.place.updateWorldMatrix(true, true);
  }

  function startLoop() {
    if (anim.raf) return;
    anim.last = 0;
    var step = function (now) {
      anim.raf = requestAnimationFrame(step);
      var dt = anim.last ? Math.min(0.05, (now - anim.last) / 1000) : 0.016;
      anim.last = now;
      if (!cached || !live) { stopLoop(); return; }
      if (currentPose === 'walk') {
        // 相位按步频推进：动画没就绪时的程序摆腿兜底才和位移速度对得上
        anim.phase += dt * walkTimeScale;
        if (wk.action && wk.mixer) {
          wk.mixer.update(dt);              // 真人走路动画：腿 + 躯干
          armFrameFromLegs(cached);         // 手臂铰链轴摆（mixer 不碰手臂骨）
          applyWalkBob();                   // 骨盆起伏（smd 里没有位移轨，这里补）
        } else walkFrameProcedural(cached, anim.phase);   // 动画没就绪时的兜底
        // 点地走动的位移推进放在最后：到达时 setPose('stand')
        // 会 restoreBind + stopLoop，后面不该再有骨骼写入
        if (walking && walkTarget) advanceWalk(dt);
      } else if (currentPose === 'wave') {
        anim.phase += dt;
        applyWaveFrame(cached, anim.phase);
      } else {
        stopLoop();
      }
    };
    anim.raf = requestAnimationFrame(step);
  }

  function applyPose(name) {
    var m = cached;
    if (!m) return;
    restoreBind(m);
    if (name !== 'walk') stopWalkAction();
    if (name === 'sit') {
      applySit(m);
    } else if (name === 'walk') {
      cacheWalkNeutral(m);   // 中性臂形摆一次并缓存，后面只叠小角度
      // 手指不在任何轨道里，先摆成半握拳再让动画接管
      relaxHands(m);
      if (ensureWalkAction(m.THREE)) {
        wk.mixer.update(0);                    // 立刻摆到动画当前帧
      }
      startLoop();
    } else if (name === 'wave') {
      applyWaveFrame(m, anim.phase);
      startLoop();
    } else {
      applyStand(m);
      stopLoop();
    }
    m.place.updateWorldMatrix(true, true);
  }

  // 注册到 character-3d.js 的插槽
  if (global.HomeCharacter3D) {
    global.HomeCharacter3D.register('ghost', adapter);
  } else {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (global.HomeCharacter3D) {
        clearInterval(timer);
        global.HomeCharacter3D.register('ghost', adapter);
      } else if (tries > 100) {
        clearInterval(timer);
        console.warn('[home/character-3d-ghost] 等不到 character-3d.js');
      }
    }, 60);
  }

  global.HomeCharacter3DGhost = adapter;
})(typeof window !== 'undefined' ? window : this);
