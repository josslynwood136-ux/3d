/* ============================================================
 * js/home/rooms-3d/bedroom-geometry.js — 卧室场景几何体
 * ============================================================
 *
 * 造型换成微缩景观那套：陶土木地板 + 鼠尾草绿竖板左墙、后墙整面门窗配
 * 波浪窗帘、拱形穿衣镜、不规则粉地毯、紫色镂空奶筐、左侧整面高书架与
 * 吊柜、抱心小熊、藤编筐、针织蒲团、暖气片、落地灯、单人沙发、斗柜、
 * 大叶绿植……全部由 Canvas 贴图 + 基本几何体程序化生成，不加载任何外部
 * 模型或图片。
 *
 * 和 kitchen-geometry.js 同一个套路：这里只管把房间搭出来，
 * 生命周期 / 相机 / 交互 / 拾取 / 动画都在 bedroom-scene.js。
 *
 * r128 -> r170 只改了三处 API：texture.encoding 换成 texture.colorSpace、
 * PMREMGenerator 需要 api.renderer、灯光强度按物理单位重新换算。
 * 亮度数值本身保持原样，只乘 DIR_SCALE / POINT_SCALE。
 * ============================================================ */
(function (global) {
  'use strict';

  function buildBedroomGeometry(api) {
    var THREE = api.THREE;
    var scene = api.scene;
    // PMREM 生成环境反射要用 renderer，几何体里没有别的理由需要它。
    var renderer = api.renderer;
    var ANISO = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4;

    // r170 的物理光照单位：directional / hemisphere 强度会被除以 π，
    // point / spot 被除以 4π。下面的亮度是原文件在 r128 时代调的，
    // 直接搬过来会暗一大截，所以乘回去。厨房那边用的是同一套换算。
    var DIR_SCALE = Math.PI;
    var POINT_SCALE = Math.PI;
    /* ================================================================
       程序化贴图 (Canvas Texture)
    ================================================================= */
    function makeTex(w, h, draw, rx, ry) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx || 1, ry || 1);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = ANISO;
      return t;
    }

    // 木地板：陶土色长条拼板 + 木纹
    // 配色加深了一档：原来那组色渲出来偏灰粉，和参考图的暖陶土差一截。
    const floorTex = makeTex(1024, 1024, (g, w, h) => {
      const rows = 9, ph = h / rows;
      const cols = ['#c07a58', '#b26e4e', '#c98563', '#ba7a5c', '#c28064', '#a96a4c', '#c47e5e', '#b57252', '#c68266'];
      for (let i = 0; i < rows; i++) {
        g.fillStyle = cols[i]; g.fillRect(0, i * ph, w, ph);
        for (let k = 0; k < 45; k++) {
          g.strokeStyle = 'rgba(100,52,34,0.11)';
          g.lineWidth = 1 + Math.random();
          const y = i * ph + Math.random() * ph;
          g.beginPath(); g.moveTo(0, y);
          g.bezierCurveTo(w * .3, y + (Math.random() - .5) * 7, w * .65, y + (Math.random() - .5) * 7, w, y + (Math.random() - .5) * 5);
          g.stroke();
        }
        g.fillStyle = 'rgba(92,50,34,0.32)'; g.fillRect(0, i * ph, w, 3);
        const off = (i % 2) * w * 0.45;
        g.fillRect((off + w * 0.5) % w, i * ph, 3, ph);
        g.fillStyle = 'rgba(255,235,220,0.05)'; g.fillRect(0, i * ph + 3, w, 3);
      }
    }, 2.4, 2.4);

    // 左墙：鼠尾草绿竖向木板（同样加深，原来偏灰白）
    const plankTex = makeTex(512, 512, (g, w, h) => {
      g.fillStyle = '#a9ba92'; g.fillRect(0, 0, w, h);
      const n = 12, pw = w / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = ['#b0c29a', '#a6b78f', '#b3c59d', '#9fb088'][i % 4];
        g.fillRect(i * pw, 0, pw, h);
        for (let k = 0; k < 14; k++) {
          g.strokeStyle = 'rgba(74,92,58,0.14)'; g.lineWidth = 1;
          const x = i * pw + Math.random() * pw;
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - .5) * 8, h); g.stroke();
        }
        g.fillStyle = 'rgba(88,102,72,0.35)'; g.fillRect(i * pw, 0, 2, h);
      }
    }, 3, 2);

    // 被子绗缝格
    // 原来只是白底 + 几根淡线，渲出来和床垫、枕头全糊成一块白板。
    // 改成"每格中间鼓起来"：格子中心亮、四边压暗，再压一道明显的绗缝线 ——
    // 方格靠明暗读出来，不只是靠颜色差。
    const quiltTex = makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#f4ece1'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const cx = i * 64 + 32, cy = j * 64 + 32;
        const grd = g.createRadialGradient(cx, cy, 3, cx, cy, 48);
        grd.addColorStop(0, 'rgba(255,253,249,0.95)');
        grd.addColorStop(0.62, 'rgba(250,244,236,0.55)');
        grd.addColorStop(1, 'rgba(163,148,131,0.62)');
        g.fillStyle = grd;
        g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      }
      g.strokeStyle = 'rgba(142,127,110,0.95)'; g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.stroke();
        g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
      }
    }, 2.2, 2.2);

    // 毛线针织
    const knitTex = makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#f7f2ea'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(196,182,168,0.8)'; g.lineWidth = 3;
      for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
        g.beginPath(); g.arc(x + 8, y + 8, 7, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
        g.beginPath(); g.arc(x + 8, y + 8, 7, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      }
    }, 4, 3);

    // 藤编 / 筐子
    const weaveTex = makeTex(256, 256, (g, w, h) => {
      g.fillStyle = '#d8b98d'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 18) {
        for (let x = 0; x < w; x += 18) {
          g.fillStyle = (x / 18 + y / 18) % 2 ? '#c9a878' : '#e2c69c';
          g.fillRect(x + 1, y + 1, 16, 16);
        }
      }
      g.strokeStyle = 'rgba(120,90,55,0.35)'; g.lineWidth = 2;
      for (let y = 0; y < h; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    }, 4, 2);

    // 窗外花园光斑
    const gardenTex = makeTex(1024, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#fdfbf3'); grd.addColorStop(.45, '#eef2dc'); grd.addColorStop(1, '#c9d9ac');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = ['rgba(160,190,120,.35)', 'rgba(190,210,150,.3)', 'rgba(120,155,95,.25)'][i % 3];
        g.beginPath(); g.arc(Math.random() * w, h * 0.35 + Math.random() * h * 0.65, 20 + Math.random() * 60, 0, 7); g.fill();
      }
      for (let i = 0; i < 25; i++) {
        g.fillStyle = 'rgba(255,255,235,.5)';
        g.beginPath(); g.arc(Math.random() * w, Math.random() * h * 0.6, 6 + Math.random() * 18, 0, 7); g.fill();
      }
    });

    // 地毯：粉色毛面
    const rugTex = makeTex(512, 512, (g, w, h) => {
      g.fillStyle = '#e2b6b0'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) {
        g.fillStyle = ['rgba(255,235,230,.5)', 'rgba(205,160,155,.4)', 'rgba(235,200,196,.5)'][i % 3];
        g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
    }, 2, 2);

    // 挂画
    function artTex(kind) {
      return makeTex(256, 320, (g, w, h) => {
        g.fillStyle = '#f5efe6'; g.fillRect(0, 0, w, h);
        if (kind === 'arch') {
          g.fillStyle = '#dfa891';
          g.beginPath(); g.moveTo(44, h - 40); g.lineTo(44, 150); g.arc(128, 150, 84, Math.PI, 0); g.lineTo(212, h - 40); g.closePath(); g.fill();
          g.fillStyle = '#8fa87f';
          g.beginPath(); g.arc(128, 140, 44, 0, 7); g.fill();
          g.fillStyle = '#f5efe6'; g.fillRect(96, 196, 64, 84);
        } else if (kind === 'leaf') {
          g.strokeStyle = '#7f9c68'; g.lineWidth = 6; g.lineCap = 'round';
          g.beginPath(); g.moveTo(128, h - 50); g.quadraticCurveTo(110, 160, 140, 60); g.stroke();
          for (let i = 0; i < 5; i++) {
            const y = 90 + i * 42;
            g.fillStyle = i % 2 ? '#8fae78' : '#6f8f5c';
            g.beginPath(); g.ellipse(128 + (i % 2 ? 46 : -46), y, 44, 20, i % 2 ? -0.4 : 0.4, 0, 7); g.fill();
          }
        } else {
          g.fillStyle = '#e0a58e'; g.beginPath(); g.arc(96, 110, 52, 0, 7); g.fill();
          g.fillStyle = '#8f7fa6'; g.beginPath(); g.arc(166, 180, 40, 0, 7); g.fill();
          g.fillStyle = '#c9b184'; g.fillRect(52, 220, 150, 14);
          g.fillStyle = '#a9b894'; g.fillRect(52, 250, 100, 14);
        }
        g.strokeStyle = 'rgba(160,140,125,.5)'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      });
    }

    /* ================================================================
       环境反射 (简易 PMREM) + 灯光
    ================================================================= */
    try {
      const ec = document.createElement('canvas'); ec.width = 256; ec.height = 128;
      const eg = ec.getContext('2d');
      const grd = eg.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, '#fff8ef'); grd.addColorStop(.5, '#eadfd4'); grd.addColorStop(1, '#b9a193');
      eg.fillStyle = grd; eg.fillRect(0, 0, 256, 128);
      const envTex = new THREE.CanvasTexture(ec);
      envTex.mapping = THREE.EquirectangularReflectionMapping;
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      var envRT = pmrem.fromEquirectangular(envTex);
      scene.environment = envRT.texture;
      envTex.dispose(); pmrem.dispose();
    } catch (e) { console.warn('env skip', e); }

    var hemi = new THREE.HemisphereLight(0xfff7ee, 0xd7bcae, 0.26 * DIR_SCALE);
    scene.add(hemi);
    var ambient = new THREE.AmbientLight(0xffeadf, 0.1);
    scene.add(ambient);

    // 阳光：从后墙门窗斜射入室内，在地板上留下窗棂影子
    const sun = new THREE.DirectionalLight(0xfff1d9, 1.45 * DIR_SCALE);
    // 原来 sun 在 (6, 16, -26)，也就是后墙外侧 —— 后墙把光挡住了，只有中间
    // 那扇窗能进光，而床和书柜都在窗户左边（x -5..-1），整天泡在阴影里，
    // 只剩半球光和环境光这种平光照明，整个房间又平又灰（"模模糊糊"）。
    // 挪到开口那一侧（相机这侧）斜射进来：左墙、床、书柜都能被打亮，
    // 家具也会在地板上留下影子，体积感才出来。
    sun.position.set(15, 17, 13);
    sun.target.position.set(-1, 1, -1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
    sun.shadow.camera.near = 4; sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    sun.shadow.camera.updateProjectionMatrix();

    // 正面补光 (不投影)
    const fill = new THREE.DirectionalLight(0xf2e4d8, 0.18 * DIR_SCALE);
    fill.position.set(14, 11, 16);
    scene.add(fill);

    /* ================================================================
       材质库
    ================================================================= */
    function M(color, opts) {
      return new THREE.MeshStandardMaterial(Object.assign(
        { color: color, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.1 }, opts || {}));
    }
    const matWood      = M(0xd0a87e, { roughness: 0.72 });           // 浅橡木
    const matWoodDark  = M(0xb0886a, { roughness: 0.7 });
    const matWoodTop   = M(0xe0c4a4, { roughness: 0.65 });
    const matFloor     = M(0xffffff, { map: floorTex, roughness: 0.88 });
    const matPlankWall = M(0xffffff, { map: plankTex, roughness: 0.95 });
    const matWall      = M(0xf7f1ea, { roughness: 1.0 });
    const matBase      = M(0xf1e8df, { roughness: 1.0 });            // 踢脚线
    const matFrame     = M(0xdcb1a2, { roughness: 0.95 });           // 外壳粉框
    const matFrameDark = M(0xc79b8e, { roughness: 0.95 });
    const matWhite     = M(0xfbf8f3, { roughness: 0.95, envMapIntensity: 0.25 }); // 布艺白
    const matQuilt     = M(0xffffff, { map: quiltTex, roughness: 0.95, envMapIntensity: 0.2 });
    const matKnit      = M(0xffffff, { map: knitTex, roughness: 1.0, envMapIntensity: 0.15 });
    const matCurtain   = M(0xfaf4ea, { roughness: 1.0, side: THREE.DoubleSide, envMapIntensity: 0.2 });
    const matWeave     = M(0xffffff, { map: weaveTex, roughness: 0.95 });
    const matRug       = M(0xffffff, { map: rugTex, roughness: 1.0, envMapIntensity: 0.1 });
    const matLilac     = M(0x8f7fa6, { roughness: 0.95 });
    const matSage      = M(0x9ab086, { roughness: 0.95 });
    const matCoral     = M(0xe0897a, { roughness: 0.95 });
    const matPurple    = M(0x9486ad, { roughness: 0.8 });
    const matCard      = M(0xdfc49c, { roughness: 0.95 });
    const matDark      = M(0x5f4d44, { roughness: 0.8 });
    const matMetal     = M(0xd6cdc4, { roughness: 0.35, metalness: 0.7, envMapIntensity: 0.9 });
    const matGlass     = new THREE.MeshStandardMaterial(
      { color: 0xdfeef2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, envMapIntensity: 1.2, depthWrite: false });
    const matMirror    = M(0xe6ecef, { roughness: 0.05, metalness: 0.55, envMapIntensity: 1.4 });
    const matGold      = M(0xd8b46a, { roughness: 0.3, metalness: 0.85, envMapIntensity: 1.1 });
    const matLeafA     = M(0x7f9c68, { roughness: 0.9, envMapIntensity: 0.2 });
    const matLeafB     = M(0x6f8f5c, { roughness: 0.9, envMapIntensity: 0.2 });
    const matLeafC     = M(0x93b07c, { roughness: 0.9, envMapIntensity: 0.2 });
    const bookMats = [M(0xb3695f), M(0x5f7a88), M(0xdbb473), M(0xf3ece2), M(0x8f7fa6), M(0x6f8f5c), M(0xc98f76)];

    const roomGroup = new THREE.Group();

    /* ================================================================
       建模辅助
    ================================================================= */
    function box(w, h, dep, mat, x, y, z, parent) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      (parent || roomGroup).add(m);
      return m;
    }
    function cyl(rt, rb, h, mat, x, y, z, seg, parent) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      (parent || roomGroup).add(m);
      return m;
    }
    function sph(r, mat, x, y, z, parent) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      (parent || roomGroup).add(m);
      return m;
    }
    function roundedShape(w, h, r) {
      r = Math.max(0.001, Math.min(r, Math.min(w, h) / 2 - 0.001));
      const s = new THREE.Shape();
      const x = -w / 2, y = -h / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
      s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
      return s;
    }
    // 圆角盒 (用带倒角的挤出几何体，边缘更柔和)
    function rbox(w, h, dep, r, mat, x, y, z, parent) {
      const bev = Math.min(0.04, r * 0.5, dep * 0.15);
      const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
        depth: dep, bevelEnabled: true, bevelSize: bev, bevelThickness: bev,
        bevelSegments: 2, curveSegments: 5
      });
      g.translate(0, 0, -dep / 2);
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      (parent || roomGroup).add(m);
      return m;
    }
    function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

    // 书架上的立书 —— 书脊朝 +x（书架正面朝向房间的那一侧）
    // 原来写的是 box(0.6, bh, bw)：0.6 的宽面朝着 +x，从正面看就是一格一格
    // 的大色块，像马赛克而不是书。
    // 立书的正确比例：薄的那面是"进深"（沿 X，约 0.26），
    // 宽的那面是"书宽"（沿 Z，0.14~0.26），一本本沿 Z 排开，
    // 从正面看到的就是一排细竖条的书脊。
    function shelfBooks(x, y, z0, z1, count, hScale) {
      hScale = hScale || 1;
      const DEPTH = 0.26;
      let z = z0;
      for (let i = 0; i < count; i++) {
        const bw = 0.14 + Math.random() * 0.12;
        if (z + bw > z1) break;
        const bh = (0.72 + Math.random() * 0.34) * hScale;
        const b = box(DEPTH, bh, bw, pick(bookMats), x + DEPTH / 2, y + bh / 2, z + bw / 2);
        if (Math.random() < 0.16) b.rotation.x = (Math.random() - 0.5) * 0.55;
        z += bw + 0.012;
      }
    }
    // 摞起来的书
    function bookStack(x, y, z, n, rot) {
      const g = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const b = box(0.62 - i * 0.03, 0.1, 0.46 - i * 0.02, pick(bookMats),
          0, 0.05 + i * 0.1, 0, g);
        b.rotation.y = (Math.random() - 0.5) * 0.5;
      }
      g.position.set(x, y, z); g.rotation.y = rot || 0;
      roomGroup.add(g);
      return g;
    }
    // 盆栽
    function pottedPlant(x, y, z, s, potMat) {
      s = s || 1;
      const g = new THREE.Group();
      cyl(0.26 * s, 0.19 * s, 0.34 * s, potMat || matWhite, 0, 0.17 * s, 0, 18, g);
      cyl(0.23 * s, 0.23 * s, 0.04 * s, matDark, 0, 0.34 * s, 0, 14, g);
      for (let i = 0; i < 7; i++) {
        const leaf = sph(0.16 * s, pick([matLeafA, matLeafB, matLeafC]),
          Math.sin(i * 1.9) * 0.2 * s, 0.45 * s + Math.random() * 0.3 * s,
          Math.cos(i * 1.9) * 0.2 * s, g);
        leaf.scale.set(1.4, 0.7, 1.0);
      }
      g.position.set(x, y, z);
      roomGroup.add(g);
      return g;
    }
    // 垂吊绿植
    function trailingPlant(x, y, z, strands, len) {
      const g = new THREE.Group();
      cyl(0.24, 0.17, 0.32, matWoodTop, 0, 0, 0, 16, g);
      for (let s = 0; s < strands; s++) {
        const phase = s * 1.7, tilt = 0.7 + Math.random() * 0.6;
        for (let k = 1; k <= 9; k++) {
          const t = k / 9;
          const leaf = sph(0.09 + Math.random() * 0.05, pick([matLeafA, matLeafB, matLeafC]),
            Math.sin(phase + t * 3.2) * tilt * t * 0.7,
            -0.16 - t * len,
            Math.cos(phase + t * 3.2) * tilt * t * 0.5, g);
          leaf.scale.set(1.3, 0.75, 1.0);
        }
      }
      g.position.set(x, y, z);
      roomGroup.add(g);
      return g;
    }
    // 挂画 / 相框
    function wallArt(x, y, z, w, h, tex, rotY) {
      const g = new THREE.Group();
      box(w + 0.14, h + 0.14, 0.09, matWoodDark, 0, 0, 0, g);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, envMapIntensity: 0.2 }));
      p.position.z = 0.055; p.receiveShadow = true;
      g.add(p);
      g.position.set(x, y, z); g.rotation.y = rotY || 0;
      roomGroup.add(g);
      return g;
    }
    // 波浪窗帘
    function curtainPanel(w, h, folds, x, y, z) {
      const g = new THREE.PlaneGeometry(w, h, folds * 6, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i);
        p.setZ(i, Math.sin((px / w + 0.5) * Math.PI * 2 * folds) * 0.1);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, matCurtain);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      roomGroup.add(m);
      return m;
    }

    /* ================================================================
       1. 房间外壳：圆角地台 + 双面墙 + 前挡板
    ================================================================= */
    const SIZE = 11, WALLH = 6.5, T = 0.4;

    rbox(SIZE + 0.8, 0.6, SIZE + 0.8, 0.3, matFrameDark, 0, -0.32, 0);   // 圆角地台
    box(SIZE, 0.14, SIZE, matFloor, 0, -0.07, 0);                          // 木地板

    // 前方两道矮挡板 (圆角)
    rbox(SIZE + 0.8, 1.0, 0.5, 0.22, matFrame, 0, 0.42, SIZE / 2 + 0.18);
    rbox(0.5, 1.0, SIZE + 0.8, 0.22, matFrame, SIZE / 2 + 0.18, 0.42, 0);

    // 左墙 (内侧绿色木板 / 外侧粉框)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(T, WALLH, SIZE),
      [matPlankWall, matFrame, matWall, matWall, matWall, matWall]);
    leftWall.position.set(-SIZE / 2 - T / 2, WALLH / 2, 0);
    leftWall.castShadow = true; leftWall.receiveShadow = true;
    roomGroup.add(leftWall);

    // 后墙：留出整面门窗洞 (阳光可穿过)
    const wz = -SIZE / 2 - T / 2;              // -5.7
    const winX0 = -1.4, winX1 = 2.6, winTop = 4.85;
    function backSeg(x0, x1, y0, y1) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, T),
        [matWall, matWall, matWall, matWall, matWall, matFrame]);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, wz);
      m.castShadow = true; m.receiveShadow = true;
      roomGroup.add(m);
      return m;
    }
    backSeg(-SIZE / 2, winX0, 0, WALLH);
    backSeg(winX1, SIZE / 2, 0, WALLH);
    backSeg(winX0, winX1, winTop, WALLH);

    // 踢脚线
    box(0.12, 0.26, SIZE, matBase, -SIZE / 2 + 0.06, 0.13, 0);
    box(SIZE, 0.26, 0.12, matBase, 0, 0.13, -SIZE / 2 + 0.06);

    /* ================================================================
       2. 门窗、窗帘、窗外光景
    ================================================================= */
    // 门框
    box(0.16, winTop, 0.5, matWood, winX0, winTop / 2, wz + 0.04);
    box(0.16, winTop, 0.5, matWood, winX1, winTop / 2, wz + 0.04);
    box(winX1 - winX0 + 0.3, 0.18, 0.5, matWood, (winX0 + winX1) / 2, winTop, wz + 0.04);
    box(winX1 - winX0 + 0.3, 0.14, 0.42, matWood, (winX0 + winX1) / 2, 0.07, wz + 0.04);
    // 中梃与横档 (在地板上投出格子光影)
    box(0.12, winTop, 0.24, matWood, (winX0 + winX1) / 2, winTop / 2, wz + 0.1);
    [1.55, 3.15].forEach(y => {
      box(winX1 - winX0, 0.1, 0.22, matWood, (winX0 + winX1) / 2, y, wz + 0.1);
    });
    // 玻璃
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(winX1 - winX0 - 0.2, winTop - 0.2), matGlass);
    glass.position.set((winX0 + winX1) / 2, winTop / 2, wz + 0.05);
    roomGroup.add(glass);

    // 窗外的柔光花园 (只贴在门窗洞后方，不超出房子轮廓)
    const garden = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6.3),
      new THREE.MeshBasicMaterial({ map: gardenTex }));
    garden.position.set(0.6, 3.2, -6.7);
    roomGroup.add(garden);

    // 窗帘杆 + 波浪帘
    const rod = cyl(0.055, 0.055, 6.4, matWoodDark, 0.4, 5.15, -SIZE / 2 + 0.42, 12);
    rod.rotation.z = Math.PI / 2;
    sph(0.1, matWoodDark, -2.8, 5.15, -SIZE / 2 + 0.42);
    sph(0.1, matWoodDark, 3.6, 5.15, -SIZE / 2 + 0.42);
    curtainPanel(1.15, 4.5, 4, -1.95, 2.85, -SIZE / 2 + 0.34);
    curtainPanel(1.0, 4.5, 4, 3.05, 2.85, -SIZE / 2 + 0.34);
    // 窗内一层薄纱
    const sheer = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.4),
      new THREE.MeshStandardMaterial({ color: 0xfff9f0, transparent: true, opacity: 0.28,
        roughness: 1, side: THREE.DoubleSide, depthWrite: false }));
    sheer.position.set(0.2, 2.7, -SIZE / 2 + 0.3);
    roomGroup.add(sheer);

    // 悬挂绿植
    cyl(0.015, 0.015, 1.3, matDark, -0.9, 6.0, -SIZE / 2 + 0.5, 6);
    trailingPlant(-0.9, 5.3, -SIZE / 2 + 0.5, 5, 1.9);

    /* ================================================================
       3. 左墙：衣柜 + 悬空搁板 + 装饰画
    ================================================================= */
    // 原来这里是一整面落地书柜（z -5.15..0.2），按要求删掉了。
    // 左墙现在只剩：衣柜（z 1.0..3.6）+ 悬空搁板（z -4.6..-2.3）。

    // ---- 衣柜（左墙，两幅画挪到旁边之后）----
    // 左墙 z 1.0..3.6 这段。和书柜（z -5.15..0.2）之间留 0.8 空档，
    // 和暖气片（x -4.15..-3.69）在 x 上错开 0.08，不打架。
    // 4.2 米高 —— 2.6 米那版太矮，和 6.15 米的书柜并排像个小柜子。
    (function wardrobe() {
      const cx = -4.78, cz = 2.3;              // 柜体中心
      const depth = 1.1, width = 2.6, height = 4.2;
      const PLINTH = 0.16;                     // 底座高
      const DOOR_Y = PLINTH + height / 2;       // 门板中心高度
      // 底座：内缩 + 踢脚线，做出"落地"的阴影缝
      rbox(depth - 0.16, PLINTH, width - 0.16, 0.03, matWoodDark, cx, PLINTH / 2, cz);
      // 柜体
      rbox(depth, height, width, 0.06, matWood, cx, DOOR_Y, cz);
      // 顶部：一块直直的顶板。原来做了两层叠级压线，太花，改成平板。
      rbox(depth + 0.1, 0.14, width + 0.1, 0.04, matWoodTop, cx, PLINTH + height + 0.07, cz);
      // 两扇门：门板 + 内凹面板 + 细边框 + 金色长把手
      [-0.65, 0.65].forEach(o => {
        const doorW = width / 2 - 0.16;
        // 门板
        box(0.05, height - 0.3, doorW, matWoodTop, cx + depth / 2 + 0.025, DOOR_Y, cz + o);
        // 内凹面板（比门板小一圈，四周留缝）
        box(0.02, height - 1.05, doorW - 0.34, matWood, cx + depth / 2 + 0.06, DOOR_Y, cz + o);
        // 面板细边框：四条细木条，做出"框"的感觉
        const fr = 0.05, fy = height - 1.05, fw = doorW - 0.34;
        const fx = cx + depth / 2 + 0.075, fz = cz + o;
        box(0.015, fy, fr, matWoodTop, fx, DOOR_Y, fz - fw / 2 + fr / 2);
        box(0.015, fy, fr, matWoodTop, fx, DOOR_Y, fz + fw / 2 - fr / 2);
        box(0.015, fr, fw - fr * 2, matWoodTop, fx, DOOR_Y + fy / 2 - fr / 2, fz);
        box(0.015, fr, fw - fr * 2, matWoodTop, fx, DOOR_Y - fy / 2 + fr / 2, fz);
        // 金色长把手（竖的，靠门缝那一侧）
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 1.1, 10), matGold);
        handle.position.set(cx + depth / 2 + 0.1, DOOR_Y,
          cz + o + (o < 0 ? doorW - 0.14 : -doorW + 0.14));
        handle.castShadow = true;
        roomGroup.add(handle);
      });
      // 柜顶：收纳箱 + 盆栽 + 书堆
      const topY = PLINTH + height + 0.24;
      box(0.78, 0.5, 0.7, matCard, cx + 0.05, topY + 0.25, cz - 0.85);
      box(0.74, 0.05, 0.66, M(0xcfae80), cx + 0.05, topY + 0.51, cz - 0.85);
      pottedPlant(cx - 0.05, topY, cz + 0.95, 0.6, matSage);
      bookStack(cx + 0.05, topY, cz + 0.2, 3, -0.25);
    })();

    // ---- 悬空搁板（左墙，加长后和衣柜接上）----
    // 不要门，就是一条通长的开放搁板，上面摆书和植物。
    // 加长到 5.5 米（z -4.6..0.9），前端正好接到衣柜（z 1.0 起）的侧面，
    // 顶板高度和衣柜顶齐平（4.48），看起来是一整条沿墙的柜子。
    (function wallShelf() {
      const cx = -4.85, cz = -1.85;
      const depth = 0.85, length = 5.5, y = 3.76;
      // 底板 + 顶板 + 两端侧板，正面全开
      box(depth, 0.07, length, matWood, cx, y, cz);
      box(depth, 0.07, length, matWood, cx, y + 0.72, cz);
      box(depth, 0.72, 0.07, matWood, cx, y + 0.36, cz - length / 2 + 0.035);
      box(depth, 0.72, 0.07, matWood, cx, y + 0.36, cz + length / 2 - 0.035);
      // 背板（贴墙，东西不会往后掉）
      box(0.05, 0.72, length, matWoodDark, cx - depth / 2 + 0.025, y + 0.36, cz);
      // 上面摆东西：书、盆栽、收纳盒，沿全长铺开
      bookStack(cx + 0.05, y + 0.07, cz - 2.1, 3, 0.3);
      bookStack(cx + 0.05, y + 0.07, cz - 0.9, 4, -0.2);
      bookStack(cx + 0.05, y + 0.07, cz + 0.4, 3, 0.15);
      pottedPlant(cx + 0.05, y + 0.07, cz - 1.5, 0.55, matCard);
      pottedPlant(cx + 0.05, y + 0.07, cz + 1.1, 0.5, matSage);
      pottedPlant(cx + 0.05, y + 0.07, cz + 2.0, 0.45, matCoral);
      box(0.5, 0.32, 0.42, matCard, cx + 0.05, y + 0.23, cz - 2.7);
      box(0.46, 0.05, 0.38, M(0xcfae80), cx + 0.05, y + 0.41, cz - 2.7);
      box(0.44, 0.3, 0.4, matCard, cx + 0.05, y + 0.22, cz + 1.6);
    })();

    // 左墙装饰画：原来挂在 z 1.6 / 2.9，正好在衣柜上方。
    // 衣柜加高到 4.48 之后画被顶没了，挪到后墙左边那段空墙上
    // （窗户从 x=-1.4 开始，x -5.5..-1.4 整面是空的）。
    // 后墙朝 +z，所以 rotY = 0。
    wallArt(-4.2, 3.3, -SIZE / 2 + 0.06, 1.1, 1.35, artTex('arch'), 0);
    wallArt(-2.5, 3.25, -SIZE / 2 + 0.06, 0.7, 0.9, artTex('leaf'), 0);

    /* ================================================================
       4. 床铺区（床头靠窗户那面墙，床身朝房间前方延伸）
    ================================================================= */
    // 床头对窗户（后墙那面）。左墙那面书柜落地到顶、贴着左墙排，
    // 床在它前面并排 —— 所以床的左边不能压到书柜那 0.95 米的进深，
    // x 从 -4.25 起（右边缘 -0.85，窗户从 -1.4 开始，只挡到一点边）。
    const bedX0 = -4.25, bedX1 = -0.85;   // 沿 X，3.4（床宽）
    const bedZ0 = -5.15, bedZ1 = -0.05;   // 沿 Z，5.1（床长）
    const bedCx = (bedX0 + bedX1) / 2, bedCz = (bedZ0 + bedZ1) / 2;
    const bedL = bedZ1 - bedZ0;           // 长边，沿 Z
    const bedW = bedX1 - bedX0;           // 短边，沿 X

    // 床头板（贴后墙），1.63 高 —— 再高会顶到书柜底板（1.95）
    box(bedW + 0.12, 1.55, 0.32, matWood, bedCx, 0.88, bedZ0 - 0.16);
    box(bedW + 0.2, 0.16, 0.42, matWoodTop, bedCx, 1.62, bedZ0 - 0.18);

    // ---- 平台床架：三个内凹抽屉面板 ----
    // 平台感来自四处，缺一样就看不出来是"带抽屉的床"：
    //   ① 床架明显高出地面，下面是内缩的底座（床是"浮"着的）
    //   ② 底座比床架窄一圈，形成阴影缝
    //   ③ 抽屉面板是独立板，四周留出可见的缝，不是画几条线
    //   ④ 面板上有金色圆拉手
    rbox(bedW, 0.52, bedL, 0.10, matWood, bedCx, 0.36, bedCz);
    rbox(bedW - 0.36, 0.22, bedL - 0.34, 0.04, matWoodDark, bedCx, 0.11, bedCz);
    [-1.55, 0, 1.55].forEach(o => {
      const dw = bedL / 3 - 0.22;
      const panel = rbox(0.06, 0.32, dw, 0.02, matWoodTop, bedX1 + 0.03, 0.36, bedCz + o);
      panel.castShadow = true;
      sph(0.068, matGold, bedX1 + 0.10, 0.36, bedCz + o);
    });
    // 床脚
    [[bedX0 + 0.3, bedZ0 + 0.3], [bedX1 - 0.3, bedZ0 + 0.3], [bedX0 + 0.3, bedZ1 - 0.3], [bedX1 - 0.3, bedZ1 - 0.3]]
      .forEach(p => cyl(0.09, 0.07, 0.1, matWoodDark, p[0], 0.05, p[1], 10));

    // 床垫
    rbox(bedW - 0.2, 0.5, bedL - 0.2, 0.14, matWhite, bedCx, 0.83, bedCz);
    // 绗缝被子（盖住床的前 2/3）
    rbox(bedW + 0.15, 0.3, bedL * 0.62, 0.12, matQuilt, bedCx, 1.2, bedZ1 - bedL * 0.31);
    // 床头翻折的被子卷：一根横放的圆筒，把床头和被面分开。
    // 没有它，床垫(近白) + 被子(近白) + 枕头(近白) 全糊成一块白板 ——
    // 这就是"模模糊糊"的一部分。
    const quiltRoll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, bedW - 0.45, 14), matQuilt);
    quiltRoll.rotation.z = Math.PI / 2;
    quiltRoll.position.set(bedCx, 1.4, bedZ0 + 1.2);
    quiltRoll.castShadow = true;
    roomGroup.add(quiltRoll);

    // 靠枕（斜倚床头板，倾角绕 X 轴）
    function pillow(xc, wdt, mat, lean) {
      const p = rbox(wdt, 0.75, 1.1, 0.22, mat, xc, 1.5, bedZ0 + 0.62);
      p.rotation.x = lean;
      return p;
    }
    pillow(-3.45, 1.55, matWhite, -0.2);
    pillow(-1.75, 1.55, matWhite, -0.2);
    const acc1 = rbox(0.3, 0.62, 0.66, 0.14, matLilac, -2.6, 1.55, bedZ0 + 0.72); acc1.rotation.x = -0.16;
    const acc2 = rbox(0.28, 0.58, 0.62, 0.14, matWhite, -1.7, 1.5, bedZ0 + 0.72); acc2.rotation.x = -0.14;
    const acc3 = rbox(0.28, 0.56, 0.6, 0.14, matSage, -1.2, 1.5, bedZ0 + 0.7); acc3.rotation.x = -0.18;

    // 抱心小熊
    (function teddy() {
      const g = new THREE.Group();
      const bm = M(0xf2a9a2, { roughness: 0.95, envMapIntensity: 0.15 });
      const mm = M(0xfbe2d9, { roughness: 0.95, envMapIntensity: 0.15 });
      const body = sph(0.32, bm, 0, 0.36, 0, g); body.scale.set(1, 1.1, 0.92);
      sph(0.3, bm, 0, 0.95, 0.02, g);
      const muz = sph(0.14, mm, 0, 0.88, 0.26, g); muz.scale.set(1, 0.8, 0.9);
      sph(0.12, bm, -0.23, 1.17, -0.02, g);
      sph(0.12, bm, 0.23, 1.17, -0.02, g);
      const armL = sph(0.13, bm, -0.3, 0.5, 0.08, g); armL.scale.set(1, 1.4, 1);
      const armR = sph(0.13, bm, 0.3, 0.5, 0.08, g); armR.scale.set(1, 1.4, 1);
      sph(0.14, bm, -0.17, 0.1, 0.14, g);
      sph(0.14, bm, 0.17, 0.1, 0.14, g);
      sph(0.035, matDark, -0.1, 1.0, 0.27, g);
      sph(0.035, matDark, 0.1, 1.0, 0.27, g);
      // 红心
      const hs = new THREE.Shape();
      hs.moveTo(0, 0.24);
      hs.bezierCurveTo(0.14, 0.44, 0.5, 0.4, 0.5, 0.1);
      hs.bezierCurveTo(0.5, -0.1, 0.26, -0.26, 0, -0.5);
      hs.bezierCurveTo(-0.26, -0.26, -0.5, -0.1, -0.5, 0.1);
      hs.bezierCurveTo(-0.5, 0.4, -0.14, 0.44, 0, 0.24);
      const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
      const heart = new THREE.Mesh(hg, M(0xcc4a4a, { roughness: 0.6 }));
      heart.scale.setScalar(0.62); heart.position.set(0, 0.42, 0.26);
      heart.castShadow = true; g.add(heart);
      g.position.set(-2.85, 1.12, -2.65); g.rotation.y = 0.95; g.scale.setScalar(0.92);
      roomGroup.add(g);
    })();

    // 床边铁艺花架
    (function wireBasket() {
      const g = new THREE.Group();
      const wm = M(0xd8cfc6, { roughness: 0.5, metalness: 0.4, wireframe: true });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.3, 0.5, 14, 3, true), wm);
      b.position.y = 0.32; b.castShadow = true; g.add(b);
      cyl(0.34, 0.34, 0.05, wm, 0, 0.07, 0, 14, g);
      g.position.set(-3.55, 0, 0.45);
      roomGroup.add(g);
      pottedPlant(-3.6, 0.5, 0.45, 0.85, matCard);
    })();

    /* ================================================================
       5. 暖气片 (左前方)
    ================================================================= */
    (function radiator() {
      const rx = -3.92, z0 = 1.0, z1 = 4.6;
      const n = 12;
      for (let i = 0; i < n; i++) {
        rbox(0.34, 1.45, 0.17, 0.07, matWhite, rx, 0.85, z0 + 0.12 + i * ((z1 - z0 - 0.24) / (n - 1)));
      }
      box(0.46, 0.12, z1 - z0, matWhite, rx, 1.62, (z0 + z1) / 2);
      box(0.3, 0.1, z1 - z0, matWhite, rx, 0.16, (z0 + z1) / 2);
      cyl(0.05, 0.05, 0.4, matMetal, rx, 0.1, z0 + 0.1, 10);
      cyl(0.05, 0.05, 0.4, matMetal, rx, 0.1, z1 - 0.1, 10);
      // 阀门
      sph(0.09, matMetal, rx, 1.62, z1 - 0.05);
    })();

    /* ================================================================
       6. 后墙右侧：落地灯、单人沙发、圆几、镜子、斗柜
    ================================================================= */
    // 落地灯
    (function floorLamp() {
      const g = new THREE.Group();
      cyl(0.22, 0.26, 0.08, matWoodDark, 0, 0.04, 0, 18, g);
      cyl(0.045, 0.045, 3.0, matWoodDark, 0, 1.5, 0, 10, g);
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 0.72, 20, 1, true),
        new THREE.MeshStandardMaterial({ color: 0xfff3d6, roughness: 1, side: THREE.DoubleSide,
          emissive: 0xffd9a0, emissiveIntensity: 0.55, envMapIntensity: 0.15 }));
      shade.position.y = 3.15; shade.castShadow = true; g.add(shade);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe6b8 }));
      bulb.position.y = 3.1; g.add(bulb);
      const pt = new THREE.PointLight(0xffd9a5, 0.85 * POINT_SCALE, 9, 2);
      api.lampLight = pt;
      pt.position.y = 3.0; g.add(pt);
      g.position.set(1.5, 0, -4.6);
      roomGroup.add(g);
    })();

    // 圆几 + 马克杯 + 书
    (function sideTable() {
      const g = new THREE.Group();
      cyl(0.62, 0.62, 0.09, matWoodTop, 0, 1.15, 0, 26, g);
      cyl(0.055, 0.055, 1.1, matWood, 0, 0.58, 0, 12, g);
      cyl(0.3, 0.34, 0.06, matWood, 0, 0.03, 0, 20, g);
      // 杯子
      cyl(0.1, 0.085, 0.17, matWhite, 0.18, 1.28, -0.1, 16, g);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16, Math.PI * 1.4), matWhite);
      handle.position.set(0.28, 1.29, -0.1); handle.rotation.y = Math.PI / 2; handle.castShadow = true; g.add(handle);
      // 摊开的书
      const b1 = box(0.3, 0.03, 0.42, bookMats[3], -0.2, 1.22, 0.1, g); b1.rotation.y = 0.25;
      const b2 = box(0.3, 0.03, 0.42, bookMats[3], 0.06, 1.24, 0.14, g); b2.rotation.y = -0.15;
      g.position.set(0.9, 0, -1.1);
      roomGroup.add(g);
    })();

    // 胖胖的单人沙发
    (function armchair() {
      const g = new THREE.Group();
      rbox(2.0, 0.55, 1.9, 0.22, matWhite, 0, 0.5, 0, g);            // 底座
      rbox(1.55, 0.28, 1.5, 0.14, matWhite, 0, 0.86, 0.1, g);         // 坐垫
      const back = rbox(2.0, 1.7, 0.5, 0.24, matWhite, 0, 1.55, -0.72, g);
      back.rotation.x = -0.06;
      rbox(0.42, 0.75, 1.75, 0.2, matWhite, -0.86, 1.1, 0.02, g);     // 扶手
      rbox(0.42, 0.75, 1.75, 0.2, matWhite, 0.86, 1.1, 0.02, g);
      const cushion = rbox(0.72, 0.66, 0.3, 0.14, matCoral, -0.1, 1.3, -0.4, g);
      cushion.rotation.x = -0.22; cushion.rotation.z = 0.08;
      // 木脚
      [[-0.8, -0.7], [0.8, -0.7], [-0.8, 0.75], [0.8, 0.75]].forEach(p => {
        cyl(0.07, 0.05, 0.24, matWoodDark, p[0], 0.12, p[1], 10, g);
      });
      g.position.set(2.2, 0, -2.6);
      g.rotation.y = -Math.PI / 4;
      roomGroup.add(g);
    })();

    // 地板上的书堆
    bookStack(2.75, 0, -0.75, 4, 0.5);
    bookStack(1.9, 0, 0.15, 3, -0.3);

    // 拱形穿衣镜 (斜靠后墙)
    (function mirror() {
      const w = 1.5, h = 4.1;
      function archShape(sw, sh) {
        const s = new THREE.Shape();
        s.moveTo(-sw / 2, -sh / 2);
        s.lineTo(sw / 2, -sh / 2);
        s.lineTo(sw / 2, sh / 2 - sw / 2);
        s.absarc(0, sh / 2 - sw / 2, sw / 2, 0, Math.PI, false);
        s.lineTo(-sw / 2, -sh / 2);
        return s;
      }
      const g = new THREE.Group();
      const fg = new THREE.ExtrudeGeometry(archShape(w, h),
        { depth: 0.12, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2, curveSegments: 14 });
      const frame = new THREE.Mesh(fg, matWood); frame.castShadow = true; g.add(frame);
      const gg = new THREE.ExtrudeGeometry(archShape(w - 0.24, h - 0.24),
        { depth: 0.03, bevelEnabled: false, curveSegments: 14 });
      const glassM = new THREE.Mesh(gg, matMirror);
      glassM.position.z = 0.13; g.add(glassM);
      g.position.set(3.3, 2.08, -5.02);
      g.rotation.set(-0.07, -0.14, 0);
      roomGroup.add(g);
    })();

    // 半高斗柜 + 台面小物
    (function sideboard() {
      // 参考图右边是沿边一整条长矮柜，上面摆植物和瓶子。
      // 原版是个 1.7 x 2.05 的高斗柜塞在右后角，高度和朝向都不对。
      // 改成：进深 1.15（X）、长 4.6（Z）、高 1.15 的矮柜，贴右边走。
      const cx = 4.75, cz = -1.5;
      const depth = 1.15, length = 4.6, height = 1.15;
      rbox(depth, height, length, 0.06, matWood, cx, 0.10 + height / 2, cz);
      rbox(depth + 0.16, 0.12, length + 0.16, 0.05, matWoodTop, cx, 0.10 + height + 0.06, cz);
      // 内缩底座，做出浮起来的阴影缝
      rbox(depth - 0.22, 0.12, length - 0.22, 0.03, matWoodDark, cx, 0.06, cz);
      // 柜门朝房间内侧（-x 面）：三扇门 + 金色圆把手
      [-1.5, 0, 1.5].forEach(o => {
        box(0.03, height - 0.2, length / 3 - 0.2, matWoodTop,
          cx - depth / 2 - 0.02, 0.10 + height / 2, cz + o);
        sph(0.055, matGold, cx - depth / 2 - 0.07, 0.10 + height / 2 + 0.18, cz + o - length / 6 + 0.26);
      });
      // 台面小物：香氛瓶、托盘、盆栽、书堆（沿 Z 排开）
      const topY = 0.10 + height + 0.12;
      const bottleCols = [0xe7c9d2, 0xcfdcc4, 0xe8dcc0];
      bottleCols.forEach((c, i) => {
        const bz = cz - 1.75 + i * 0.22;
        const bh = 0.30 + i * 0.05;
        cyl(0.06, 0.06, bh, M(c, { roughness: 0.2, metalness: 0.15, transparent: true, opacity: 0.85 }),
          cx + 0.24, topY + bh / 2, bz, 12);
        cyl(0.03, 0.03, 0.1, matGold, cx + 0.24, topY + bh, bz, 10);
      });
      box(0.42, 0.05, 0.62, matWoodDark, cx - 0.2, topY + 0.03, cz + 0.9);
      pottedPlant(cx + 0.1, topY, cz - 0.5, 0.65, matSage);
      pottedPlant(cx + 0.22, topY, cz + 1.85, 0.5, matCard);
      bookStack(cx - 0.05, topY, cz + 0.35, 3, 0.2);
    })();

    // 大叶绿植 (右后角，紧挨镜子)
    // 原来在 (4.65, -2.85)，正好落在新长矮柜的范围里（柜子 z 从 -3.8 到 0.8），
    // 挪到右后角，和镜子并排 —— 参考图里镜子右边就有一盆大叶绿植。
    (function bigPlant() {
      const g = new THREE.Group();
      cyl(0.44, 0.33, 0.75, matWhite, 0, 0.37, 0, 22, g);
      cyl(0.4, 0.4, 0.06, matDark, 0, 0.73, 0, 16, g);
      for (let i = 0; i < 9; i++) {
        const a = i * 0.85, hh = 1.1 + (i % 4) * 0.5;
        const stem = cyl(0.03, 0.035, hh, matLeafB, Math.sin(a) * 0.18, hh / 2 + 0.7, Math.cos(a) * 0.18, 8, g);
        stem.rotation.z = Math.sin(a) * 0.16; stem.rotation.x = Math.cos(a) * 0.16;
        const leaf = sph(0.32, pick([matLeafA, matLeafB]),
          Math.sin(a) * (0.42 + (i % 3) * 0.16), hh + 0.72, Math.cos(a) * (0.42 + (i % 3) * 0.16), g);
        leaf.scale.set(1.5, 0.24, 0.95);
        leaf.rotation.y = a; leaf.rotation.z = 0.25;
      }
      g.position.set(4.35, 0, -4.55);
      roomGroup.add(g);
    })();

    // 墙面小画 (斗柜上方 & 镜子上方)
    wallArt(4.3, 3.75, -SIZE / 2 + 0.05, 1.0, 1.3, artTex('dots'));
    wallArt(5.15, 3.5, -SIZE / 2 + 0.05, 0.62, 0.8, artTex('leaf'));
    wallArt(3.3, 5.25, -SIZE / 2 + 0.05, 0.6, 0.75, artTex('arch'));

    /* ================================================================
       7. 前景：地毯、蒲团、藤筐、圆几、奶筐
    ================================================================= */
    // 不规则粉地毯
    (function rug() {
      const pts = [];
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 20) {
        const r = 2.95 * (1 + 0.06 * Math.sin(a * 3 + 1) + 0.05 * Math.cos(a * 5));
        pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r * 0.76));
      }
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts),
        { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 4 });
      const m = new THREE.Mesh(g, matRug);
      m.rotation.x = -Math.PI / 2;
      m.position.set(1.0, 0.07, 1.4);
      m.receiveShadow = true;
      roomGroup.add(m);
    })();

    // 白色针织蒲团
    const pouf = sph(0.7, matKnit, -1.4, 0.44, 4.2);
    pouf.scale.set(1, 0.66, 1);
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.03, 8, 40), M(0xe6ddd2, { roughness: 1 }));
    seam.rotation.x = Math.PI / 2; seam.position.set(-1.4, 0.44, 4.2);
    roomGroup.add(seam);

    // 藤编收纳筐
    const basket = cyl(0.46, 0.38, 0.6, matWeave, -2.55, 0.3, 4.65, 20);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.05, 8, 26), matWeave);
    rim.rotation.x = Math.PI / 2; rim.position.set(-2.55, 0.6, 4.65); rim.castShadow = true;
    roomGroup.add(rim);

    // 白色小圆几 (右前) + 篮子
    (function frontTable() {
      const g = new THREE.Group();
      cyl(0.56, 0.56, 0.09, matWhite, 0, 1.06, 0, 26, g);
      cyl(0.05, 0.05, 1.02, matWhite, 0, 0.53, 0, 12, g);
      cyl(0.3, 0.34, 0.06, matWhite, 0, 0.03, 0, 20, g);
      // 篮子里的小物
      const bk = cyl(0.3, 0.26, 0.24, matWeave, 0, 1.2, 0, 16, g);
      box(0.34, 0.1, 0.26, bookMats[1], 0.02, 1.36, 0, g);
      box(0.3, 0.08, 0.24, bookMats[4], -0.03, 1.45, 0.03, g).rotation.y = 0.4;
      g.position.set(4.55, 0, 1.55);
      roomGroup.add(g);
    })();

    // 紫色镂空奶筐
    function latticePanel(w, h, th, mat) {
      const g = new THREE.Group();
      box(w, 0.1, th, mat, 0, h / 2 - 0.05, 0, g);
      box(w, 0.1, th, mat, 0, -h / 2 + 0.05, 0, g);
      box(0.1, h, th, mat, -w / 2 + 0.05, 0, 0, g);
      box(0.1, h, th, mat, w / 2 - 0.05, 0, 0, g);
      for (let i = 1; i < 3; i++) box(0.06, h - 0.2, th * 0.6, mat, -w / 2 + i * (w / 3), 0, 0, g);
      box(w - 0.2, 0.06, th * 0.6, mat, 0, -h / 6, 0, g);
      box(w - 0.2, 0.06, th * 0.6, mat, 0, h / 6, 0, g);
      return g;
    }
    (function crate() {
      const g = new THREE.Group();
      box(1.2, 0.1, 1.2, matPurple, 0, -0.45, 0, g);
      const p1 = latticePanel(1.2, 1.0, 0.1, matPurple); p1.position.set(0, 0, -0.55); g.add(p1);
      const p2 = latticePanel(1.2, 1.0, 0.1, matPurple); p2.position.set(0, 0, 0.55); g.add(p2);
      const p3 = latticePanel(1.2, 1.0, 0.1, matPurple); p3.position.set(-0.55, 0, 0); p3.rotation.y = Math.PI / 2; g.add(p3);
      const p4 = latticePanel(1.2, 1.0, 0.1, matPurple); p4.position.set(0.55, 0, 0); p4.rotation.y = Math.PI / 2; g.add(p4);
      g.children.forEach(c => { c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); });
      // 筐里露出的书
      box(0.5, 0.5, 0.3, bookMats[0], -0.1, 0.3, 0.1, g).rotation.z = 0.2;
      box(0.45, 0.44, 0.28, bookMats[5], 0.2, 0.26, -0.15, g).rotation.z = -0.15;
      g.position.set(3.6, 0.5, 4.4); g.rotation.y = -0.22;
      roomGroup.add(g);
    })();

    /* ================================================================
       渲染循环
    ================================================================= */
    scene.add(roomGroup);
    // ---- 交给场景层 ----
    api.roomGroup = roomGroup;
    api.lights = { hemi: hemi, ambient: ambient, sun: sun, fill: fill };
    // PMREM 的 render target 得手动释放，场景层销毁时用得上。
    api.envRenderTarget = envRT;
  }

  global.buildBedroomGeometry = buildBedroomGeometry;
})(window);