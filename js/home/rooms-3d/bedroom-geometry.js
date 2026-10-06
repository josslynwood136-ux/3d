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

    // 沙发面料。
    // 原来沙发用的是 matWhite（纯色无贴图），渲出来是一块死白，
    // 和白墙、白床、白枕全糊在一起，沙发完全没有存在感。
    // 现在给一张细密织纹：底色 + 同色系稍深的经纬线，
    // 掠射光下有织物的质感，近看也经得起推。
    //
    // 试过在织纹上叠碎花（枝叶 / 波点 / 五瓣花三套花样），
    // 三个在这个等距视角下都不好看 —— 花朵只有几个像素，
    // 要么看不清是什么、要么成了零星脏点，还会和坐垫、地毯的花抢。
    // 所以退回纯色 + 织纹：远看是一块干净的藕粉布，近看有织物质感。
    // 真要加装饰，沙发上摆抱枕和搭毯比印花有效。
    function clothTex(base, line, rx, ry) {
      return makeTex(256, 256, (g, w, h) => {
        g.fillStyle = base; g.fillRect(0, 0, w, h);
        g.strokeStyle = line; g.lineWidth = 1;
        for (let y = 0; y < h; y += 4) {
          g.globalAlpha = 0.5; g.beginPath(); g.moveTo(0, y + .5); g.lineTo(w, y + .5); g.stroke();
        }
        for (let x = 0; x < w; x += 4) {
          g.globalAlpha = 0.35; g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, h); g.stroke();
        }
        g.globalAlpha = 1;
        // 纱线粗细不匀，避免像网格纸
        for (let i = 0; i < 500; i++) {
          g.fillStyle = Math.random() > .5 ? line : base;
          g.globalAlpha = 0.12;
          g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 1);
        }
        g.globalAlpha = 1;
      }, rx, ry);
    }

    // 沙发配色：藕粉。
    // 挑的时候顾着整屋的粉 + 绿 + 木色 —— 奶白会和白墙白床糊在一起，
    // 鼠尾草绿和左墙的绿木板撞，砂米和木地板太近，
    // 藕粉正好和地毯的粉、床上抱枕、地台暖调同一族。
    var SOFA_CLOTH = { cloth: '#e8c9c4', line: 'rgba(150,105,98,1)' };
    var SOFA_CUSHION = 0x8fa87f;   // 抱枕用绿，和面料反一点色

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

    // 窗外花园。
    //
    // 用 MeshBasicMaterial（不受光照影响），所以亮度全靠贴图本身给。
    // 之前这层偏暗，和室内的暗部糊在一起，窗户看着像个贴片而不是个洞 ——
    // 真实的窗永远是画面里最亮的地方，室内才显得被照亮。
    // 现在整体提亮并往上加暖（阳光从上方来），底下压一点绿，
    // 形成"上亮下深"的户外层次。
    const gardenTex = makeTex(1024, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#fffdf6');    // 天空/远处高光，最亮
      grd.addColorStop(.30, '#f6f6e4');
      grd.addColorStop(.62, '#dfe8c2');
      grd.addColorStop(1, '#bcd199');    // 近处草地，稍深
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      // 阳光下的亮斑
      for (let i = 0; i < 60; i++) {
        g.fillStyle = ['rgba(180,205,135,.40)', 'rgba(205,222,165,.34)', 'rgba(140,172,108,.28)'][i % 3];
        g.beginPath(); g.arc(Math.random() * w, h * 0.35 + Math.random() * h * 0.65, 20 + Math.random() * 60, 0, 7); g.fill();
      }
      // 高光点：多打一些，制造"户外很亮"的通透感
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(255,255,242,.62)';
        g.beginPath(); g.arc(Math.random() * w, Math.random() * h * 0.7, 6 + Math.random() * 20, 0, 7); g.fill();
      }
      // 顶部加一层暖白渐晕，模拟阳光从上方洒下来
      const warm = g.createLinearGradient(0, 0, 0, h * 0.5);
      warm.addColorStop(0, 'rgba(255,248,226,.55)');
      warm.addColorStop(1, 'rgba(255,248,226,0)');
      g.fillStyle = warm; g.fillRect(0, 0, w, h * 0.5);
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
        } else if (kind === 'dots') {
          g.fillStyle = '#e0a58e'; g.beginPath(); g.arc(96, 110, 52, 0, 7); g.fill();
          g.fillStyle = '#8f7fa6'; g.beginPath(); g.arc(166, 180, 40, 0, 7); g.fill();
          g.fillStyle = '#c9b184'; g.fillRect(52, 220, 150, 14);
          g.fillStyle = '#a9b894'; g.fillRect(52, 250, 100, 14);
        } else if (kind === 'wave') {
          // 抽象色块山峦：几层起伏的山，层数少、颜色近，
          // 是那种"北欧简约"挂画，远看是一片色，近看有层次
          const hills = [
            { y: 205, c: '#e8c9b6' }, { y: 235, c: '#d9a98f' },
            { y: 265, c: '#b58f7e' }, { y: 292, c: '#8fa08a' }
          ];
          hills.forEach((hl, i) => {
            g.fillStyle = hl.c;
            g.beginPath(); g.moveTo(0, h);
            for (let x = 0; x <= w; x += 8) {
              const t = x / w;
              const yy = hl.y - Math.sin(t * Math.PI * (1.4 + i * 0.5) + i) * (26 - i * 4);
              g.lineTo(x, yy);
            }
            g.lineTo(w, h); g.closePath(); g.fill();
          });
          // 顶上一个小圆，像月亮
          g.fillStyle = '#f0e2c8'; g.beginPath(); g.arc(196, 64, 26, 0, 7); g.fill();
        } else if (kind === 'botanic') {
          // 植物标本：压平的叶子，中间一根茎、两侧对称叶脉
          g.strokeStyle = '#6f8f5c'; g.lineWidth = 5; g.lineCap = 'round';
          g.beginPath(); g.moveTo(128, h - 46); g.lineTo(128, 52); g.stroke();
          for (let i = 0; i < 6; i++) {
            const y = 250 - i * 34;
            const len = 76 - i * 7;
            ['#7f9c68', '#93b07c', '#6f8f5c'].forEach((col, k) => {
              g.fillStyle = col;
              g.beginPath();
              g.ellipse(128 - len / 2, y, len / 2, 15, -0.45 + k * 0.06, 0, 7);
              g.fill();
              g.beginPath();
              g.ellipse(128 + len / 2, y, len / 2, 15, 0.45 - k * 0.06, 0, 7);
              g.fill();
            });
          }
          g.fillStyle = '#dfa891'; g.beginPath(); g.arc(128, 34, 13, 0, 7); g.fill();
        } else if (kind === 'stripe') {
          // 竖条纹：纯粹的线性构成，最省眼力，适合补空白墙
          const cols = ['#e8c9c4', '#cfd9c0', '#dfc49c', '#cfc7dd', '#f2e9dc'];
          for (let x = 0, i = 0; x < w; x += 32, i++) {
            g.fillStyle = cols[i % cols.length];
            g.fillRect(x, 24, 32, h - 48);
          }
          // 中间叠一条细的深色横带，打破纯竖条的呆板
          g.fillStyle = 'rgba(122,100,88,.55)';
          g.fillRect(24, 150, w - 48, 7);
        } else if (kind === 'arch2') {
          // 双拱：一个高一个矮，像门洞，是"arch"的变体但更耐看
          function archPath(cx, baseY, ww, hh) {
            g.beginPath();
            g.moveTo(cx - ww / 2, baseY);
            g.lineTo(cx - ww / 2, baseY - hh + ww / 2);
            g.arc(cx, baseY - hh + ww / 2, ww / 2, Math.PI, 0);
            g.lineTo(cx + ww / 2, baseY);
            g.closePath();
          }
          g.fillStyle = '#b58f7e'; archPath(96, 272, 96, 150); g.fill();
          g.fillStyle = '#9ab086'; archPath(172, 272, 68, 104); g.fill();
          g.fillStyle = '#f5efe6'; g.fillRect(80, 272, 32, 22);
          g.fillStyle = '#e0a58e'; g.beginPath(); g.arc(64, 92, 20, 0, 7); g.fill();
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

    // 半球光/环境光也在稀释暖调：天空色偏冷白，会把太阳的橙洗掉。
    // 天光改成暖白（0xfff2dc）、地面反光改成更暖的赭色，
    // 再把半球光压到 0.18 让太阳占比更高，暖感才立得住。
    var hemi = new THREE.HemisphereLight(0xfff2dc, 0xc9a68c, 0.18 * DIR_SCALE);
    scene.add(hemi);
    var ambient = new THREE.AmbientLight(0xffe8d0, 0.07);
    scene.add(ambient);

    // 阳光：从**窗外**（后墙外侧）斜射进来，穿过窗洞打在地板上。
    //
    // 这中间来回折腾过两轮，记一下免得又改回去：
    //
    //   A. sun 在后墙外侧远处 —— 物理上对，但房间太封闭，
    //      光几乎全被后墙挡掉，屋里只剩半球光这种平光照明，
    //      床和衣柜整天泡在阴影里（它们在窗户左边 x -5..-1）。
    //   B. 挪到相机这侧 (15,17,13) —— 屋里亮了，但方向反了：
    //      太阳从没有窗的那面墙进来，窗玻璃和窗外花园全是暗的，
    //      地板上只有家具影子、没有窗棂光斑，看着不像"阳光打进来"，
    //      而且正面全亮没有暗部，曝光一高就蒙白纱。
    //   C. 现在这样 —— 放在后墙外侧但**贴近**窗户、角度也压低，
    //      光线斜穿窗洞进屋：地板上出现真正的窗棂光斑（门窗的中梃
    //      投出格子影），床尾和地毯被扫到一块暖光，窗内亮、窗外更亮。
    //
    // 位置取 (6.2, 9.5, -17)：z 在后墙外，x 落在窗洞范围 (-2.2..3.4) 内偏右。
    //
    // 光斑落在地板哪，是"窗洞沿光线方向投影"的结果，不由 position 单独决定，
    // 而由 (position - target) 这个**方向**决定：方向越偏（横向斜率越大），
    // 高处窗沿射下来的光在地板上飘得越远，整块光斑就越往左移。
    //   斜率 = (position.x - target.x) / (position.y - target.y)
    //   原来 5.6 / 8.9 ≈ 0.63  → 光斑中心约落在 x -1.1
    //   现在 7.6 / 8.9 ≈ 0.85  → 光斑中心约落在 x -1.7，整体左移约 0.6
    // 左移之后光更多落在床上（床 x -4.25..-0.85，紧贴后墙），看着更自然。
    //
    // 强度说明：这些是绝对值，bedroom-scene 的「午后暖阳 / 夜晚」按钮
    // 会按 DAY 的比例缩放它们，所以 DAY 定的太高，切到夜晚也跟着过曝。
    // 曝光 0.30 → 0.62 之后光源收着给。
    // 暖感来自太阳的颜色，不是靠加大强度：0xffc478 明显偏黄但不发橙。
    const sun = new THREE.DirectionalLight(0xffc478, 1.6 * DIR_SCALE);
    sun.position.set(6.2, 9.5, -17);
    sun.target.position.set(-1.4, 0.6, 1.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
    sun.shadow.camera.near = 4; sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
    scene.add(sun); scene.add(sun.target);
    sun.shadow.camera.updateProjectionMatrix();

    // 正面补光（不投影）：阳光改成从窗外进来后，相机这侧全是背光面，
    // 不补的话床尾、衣柜正面、人物背影会黑成一片。这盏只管提亮暗面，
    // 不投影、不参与窗棂光斑，所以给得比原来（0.18）高一些。
    const fill = new THREE.DirectionalLight(0xf2e4d8, 0.22 * DIR_SCALE);
    fill.position.set(14, 11, 16);
    scene.add(fill);

    // 窗外反弹光：从花园方向往回打一点暖光，模拟地面/花丛把阳光反射进屋。
    // 没有它窗洞内侧会是一条死黑边，窗户看着像个贴片而不是个洞。
    const bounce = new THREE.DirectionalLight(0xffcf92, 0.3 * DIR_SCALE);
    bounce.position.set(-1, 2.5, -14);
    bounce.target.position.set(0.6, 3, 0);
    scene.add(bounce); scene.add(bounce.target);

    /* ================================================================
       材质库
    ================================================================= */
    // 描边总开关。地板/墙/地台这些大平面不描（描了会在边上露出难看的黑框），
    // 也不参与阴影 —— 外壳只是给个轮廓，投影还是本体投的。
    // 关掉了。描边在等距视角下会变成"粗黑框"：正交投影下物体轮廓
    // 长度大，BackSide 放大 2% 出来的线在屏幕上非常显眼，
    // 试过 1.012（太弱看不见）和 1.026（太雷霆，像卡通描边）。
    // 这条路走不通 —— 想要"结构感"得靠材质明暗和配色分层，不是加线。
    var OUTLINE_ON = false;
    // 描边色：深暖棕。0x8a7263 在亮画面里几乎看不出来（试过，太浅），
    // 压到 0x6b5344 才够。这一圈是唯一的高对比元素，
    // 它深一点不影响整体配色 —— 线是结构，不是色块。
    var OUTLINE_TINT = 0x6b5344;

    // 不描边的材质：大面积平面（地板、墙、地台、窗外背景）。
    // 这些描了会在房间里一圈黑框，比不描更难看。
    // 在材质库建完之后、建模之前填充。
    var NO_OUTLINE = {};

    // 家具"线条感"：给几何体描一圈深色边。
    //
    // 为什么需要：整个房间的材质都是 roughness 0.65~1.0 的高粗糙度哑光，
    // 暖光斜射上去几乎没有明暗过渡，所有家具都停在同一个亮度上 ——
    // 衣柜、搁板、沙发、地台全糊成一片，这就是"模糊淡淡"的来源。
    // 光影调亮只会更糊（亮部一顶就白）。这里走另一条路：
    // 用 BackSide 稍微放大的一层几何体当外壳，颜色取比本体深的同色系，
    // 只在物体轮廓处露出一圈，就有了插画/等距风格的那种结构线。
    //
    // 实现要点：
    //   - 必须用 BackSide，否则外壳会盖住本体
    //   - 放大要够小（默认 1.012），大了描边就粗得像泡泡
    //   - 只在二维正交视角下有效果，这是本项目的固定视角，正好适用
    function outlineMesh(mesh, scale, color) {
      if (!OUTLINE_ON) return null;
      if (mesh.material && NO_OUTLINE[mesh.material.uuid]) return null;
      if (mesh.userData.noOutline) return null;
      var g = new THREE.BufferGeometry();
      g.copy(mesh.geometry);
      var m = new THREE.MeshBasicMaterial({
        color: color, side: THREE.BackSide,
        toneMapped: false
      });
      var o = new THREE.Mesh(g, m);
      o.scale.setScalar(scale);
      o.renderOrder = (mesh.renderOrder || 0) - 1;
      o.frustumCulled = mesh.frustumCulled;
      mesh.add(o);
      return o;
    }

    function M(color, opts) {
      return new THREE.MeshStandardMaterial(Object.assign(
        { color: color, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.1 }, opts || {}));
    }
    const matWood      = M(0xd0a87e, { roughness: 0.72 });           // 浅橡木
    const matWoodDark  = M(0xb0886a, { roughness: 0.7 });
    const matWoodTop   = M(0xe0c4a4, { roughness: 0.65 });
    const matFloor     = M(0xffffff, { map: floorTex, roughness: 0.88 });
    const matPlankWall = M(0xffffff, { map: plankTex, roughness: 0.95 });
    // 墙体本来是 0xf7f1ea（接近纯白）。曝光提到 0.55 之后这个值会顶到高光，
    // 墙面和白色家具一起糊成一片、暖色调被冲淡。压深一档给高光留余量。
    const matWall      = M(0xf2e9dc, { roughness: 1.0 });
    const matBase      = M(0xf1e8df, { roughness: 1.0 });            // 踢脚线
    const matFrame     = M(0xdcb1a2, { roughness: 0.95 });           // 外壳粉框
    const matFrameDark = M(0xc79b8e, { roughness: 0.95 });
    const matWhite     = M(0xf7f0e4, { roughness: 0.95, envMapIntensity: 0.25 }); // 布艺白
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
    // 沙发面料 + 抱枕。
    const matSofaFabric = M(0xffffff, {
      map: clothTex(SOFA_CLOTH.cloth, SOFA_CLOTH.line, 3, 3),
      roughness: 0.98, envMapIntensity: 0.12
    });
    const matSofaCushion = M(SOFA_CUSHION, { roughness: 0.98, envMapIntensity: 0.12 });
    const matGlass     = new THREE.MeshStandardMaterial(
      { color: 0xdfeef2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, envMapIntensity: 1.2, depthWrite: false });
    // 玻璃和薄纱是透明层，描边会在窗格上套一圈黑框，破坏"阳光透进来"的通透感。
    NO_OUTLINE[matGlass.uuid] = true;
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
    // 材质库建完了，把大面积平面的材质登记进排除表
    [matFloor, matPlankWall, matWall, matFrame, matFrameDark].forEach(function (m) {
      NO_OUTLINE[m.uuid] = true;
    });

    function box(w, h, dep, mat, x, y, z, parent) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      (parent || roomGroup).add(m);
      if (OUTLINE_ON) outlineMesh(m, 1.022, OUTLINE_TINT);
      return m;
    }
    function cyl(rt, rb, h, mat, x, y, z, seg, parent) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat);
      m.position.set(x, y, z);
      m.castShadow = true; m.receiveShadow = true;
      (parent || roomGroup).add(m);
      if (OUTLINE_ON) outlineMesh(m, 1.02, OUTLINE_TINT);
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
      // 圆角盒是家具的主力（地台、柜子、沙发、床垫都是它），
      // 描边 1.014 比 box 稍大一点：圆角处放大同样的比例，
      // 描出来的线会比直角处细，不均匀。
      var _outlineScale = 1.026;
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
      if (OUTLINE_ON) outlineMesh(m, _outlineScale, OUTLINE_TINT);
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

    // 中间抽开的落地帘：一整幅布挂在杆上，抽开时往两侧收成两束。
    //
    // 顶点全部就地重算，不用 scale —— 缩放会把正弦褶皱一起拉宽压平，收拢处
    // 看着像被抻平的塑料布。开合改的是「投影宽度」，布的总长度感靠褶皱保持。
    //
    // 坐标约定（别搞反，之前就反过）：
    //   u ∈ [0,1]  u=0 是外缘（贴墙那侧，钉死不动），u=1 是内缘（窗心那侧，
    //              抽开时往墙边退，中间让出窗户）
    //   v ∈ [0,1]  v=0 是顶边（贴在杆上），v=1 是下摆
    //   t          0 = 合上（盖满整面窗），1 = 抽开（两侧各留一束）
    //
    // @param {number} t    见上
    // @param {number} sway 下摆的前后摆动（米）。动画时由场景层喂进来模拟
    //                      布料被拖动时的滞后，静止时传 0。
    function makeDrawCurtain(width, height, folds, gathered, cx, topY, z) {
      const group = new THREE.Group();
      const SEG_X = folds * 10, SEG_Y = 12;
      const halfW = width / 2;

      function buildHalf(sign) {
        const g = new THREE.PlaneGeometry(1, height, SEG_X, SEG_Y);
        const mesh = new THREE.Mesh(g, matCurtain);
        mesh.castShadow = true; mesh.receiveShadow = true;
        group.add(mesh);
        return { mesh: mesh, sign: sign, base: g.attributes.position.array.slice() };
      }
      const halves = [buildHalf(-1), buildHalf(1)];

      function shape(t, sway, lift, drag) {
        function clamp01(x) { return x > 1 ? 1 : (x < 0 ? 0 : x); }
        lift = lift || 0;
        drag = drag || 0;
        // t / sway 允许传数组做左右错峰：[左, 右]。老调用 shape(0) 照样能用。
        var tL, tR, sL, sR;
        if (t && t.length !== undefined && typeof t !== 'number') { tL = clamp01(t[0]); tR = clamp01(t[1]); }
        else { tL = tR = clamp01(typeof t === 'number' ? t : 0); }
        if (sway && sway.length !== undefined && typeof sway !== 'number') { sL = sway[0] || 0; sR = sway[1] || 0; }
        else { sL = sR = sway || 0; }
        // motion 0→1→0：行程中段布挤在一起，褶加深、束变厚，落定后归零
        var motion = Math.min(1, Math.abs(lift) / 0.09);
        if (!isFinite(motion)) motion = 0;

        // 内缘退到哪：合上时在 x=0（两幅在窗心相接），抽开时退到
        // halfW - gathered，于是整幅塌成一条 gathered 宽的束子、贴在墙边。
        var ampBaseL = 0.11 + tL * 0.10 + motion * 0.03;
        var ampBaseR = 0.11 + tR * 0.10 + motion * 0.03;
        const freq = folds;               // 折数不随 t 变：x 线性压缩本身就会
                                          // 把褶皱挤密，再改 freq 会叠加成毛刺

        halves.forEach(function (h) {
          var tt = (h.sign < 0 ? tL : tR);
          var sHay = (h.sign < 0 ? sL : sR);
          var ampB = (h.sign < 0 ? ampBaseL : ampBaseR);
          const pos = h.mesh.geometry.attributes.position;
          const arr = pos.array;
          for (let i = 0; i < pos.count; i++) {
            const baseX = h.base[i * 3];
            const baseY = h.base[i * 3 + 1];

            const u = baseX + 0.5;                       // 0 = 外缘, 1 = 内缘
            const v = (height / 2 - baseY) / height;     // 0 = 顶边, 1 = 下摆

            // 底部滞后：行程中段下摆比顶边慢半拍，ttEff 只影响横向位置，
            // 褶深/厚度仍用 tt，避免底部褶皱跟着变平。
            var ttEff = tt - drag * v * v;
            ttEff = ttEff > 1 ? 1 : (ttEff < 0 ? 0 : ttEff);
            const inner = ttEff * (halfW - gathered);

            // 横向：外缘钉死在 ±halfW，内缘随 t 往墙边收
            const x = h.sign * ((1 - u) * halfW + u * inner);

            // 纵向：顶边贴杆（baseY - h/2），下摆随褶皱微微起伏成荷叶边，
            // 行程中 lift 把下摆轻轻提起（v^2 加权），落定后归零。
            const y = baseY - height / 2 + Math.sin(u * Math.PI * freq) * 0.05 * v * v + lift * v * v;

            // 顶边被杆上的挂钩拽平，往下才放开褶子。
            // 0.07 这个起始值让顶边永远保持扁平，否则布会戳穿前面的帘杆。
            const profile = Math.max(0, Math.min(1, (v - 0.07) / 0.13));
            const wave = Math.sin(u * Math.PI * 2 * freq * 0.5) * ampB * profile;
            // 抽开后内缘（朝窗心那一侧）鼓出来一道，束子才有厚度；
            // 行程中段再额外鼓一点，布被拽过去时的挤压感。
            const bulge = (u * u * tt * 0.14 + motion * 0.05 * u * u) * profile;
            const zz = wave + bulge + sHay * v * v;

            arr[i * 3] = x;
            arr[i * 3 + 1] = y;
            arr[i * 3 + 2] = zz;
          }
          pos.needsUpdate = true;
          h.mesh.geometry.computeVertexNormals();
        });
      }

      group.position.set(cx, topY, z);
      roomGroup.add(group);
      shape(0);   // 初始闭合，调用方按需再 setOpen

      return {
        group: group,
        panelL: halves[0].mesh,
        panelR: halves[1].mesh,
        setOpen: function (t, sway, lift, drag) { shape(t, sway, lift, drag); }
      };
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
    const winX0 = -2.2, winX1 = 3.4, winTop = 5.35;
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
    // 窗框：只留外框（左右立柱 + 上下横梁 + 内侧压条）。
    //
    // 这里原来还焊了一圈固定的中梃和横档（双竖梃 + 两根横档），
    // 看着像传统格子窗，但它是**死的** —— 推拉窗扇在这圈格子后面滑，
    // 开窗时中间那道竖线一动不动，结果就是"哪扇是窗户"完全看不出来，
    // 关上开着一个样。
    //
    // 现在把固定格条全去掉：窗洞里唯一的分隔是窗扇自己的边框，
    // 开窗时两扇滑到两侧叠在外框边上，中间露出一个完整通透的大洞，
    // 一眼就知道窗被推开了。格子的感觉交给窗扇自己的中竖梃和横档。
    box(0.2, winTop, 0.58, matWood, winX0, winTop / 2, wz + 0.04);
    box(0.2, winTop, 0.58, matWood, winX1, winTop / 2, wz + 0.04);
    box(winX1 - winX0 + 0.36, 0.22, 0.58, matWood, (winX0 + winX1) / 2, winTop, wz + 0.04);
    box(winX1 - winX0 + 0.36, 0.18, 0.54, matWood, (winX0 + winX1) / 2, 0.09, wz + 0.04);
    // 内侧压条：比外框窄一圈、稍微靠室内，勾出窗洞的层次
    box(0.09, winTop - 0.2, 0.12, matWoodTop, winX0 + 0.16, winTop / 2, wz + 0.2);
    box(0.09, winTop - 0.2, 0.12, matWoodTop, winX1 - 0.16, winTop / 2, wz + 0.2);
    // 窗台板：往外挑一点，坐在窗洞底部
    box(winX1 - winX0 + 0.5, 0.1, 0.72, matWoodTop, (winX0 + winX1) / 2, 0.2, wz + 0.16);

    // === 推拉窗扇（左右滑动）===
    // 两扇并排，前后轨道错开 0.07m，开关时各自沿 X 滑出。
    //
    // 关键：每扇必须自己有完整的边框 + 玻璃 + 把手，
    // 拉开时它滑到外框边上、压在框前，轮廓和窗洞里剩下的那个洞一起
    // 把"这是能推拉的窗扇"讲清楚。之前窗洞里另有固定格条，
    // 中间那道竖线永远不动，开不开窗长得一样，就是这个毛病。
    function buildSlidingSash(width, height, x, zOff) {
      const sg = new THREE.Group();
      const F = 0.14;                 // 边框厚度，加粗才有存在感
      const FD = 0.13;                // 边框进深
      // 上下左右四条边框
      box(F, height, FD, matWoodTop, -width / 2 + F / 2, -height / 2, 0, sg);
      box(F, height, FD, matWoodTop,  width / 2 - F / 2, -height / 2, 0, sg);
      box(width, F, FD, matWoodTop, 0, -F / 2, 0, sg);
      box(width, F, FD, matWoodTop, 0, -height + F / 2, 0, sg);
      // 中竖梃：把每扇分成上下两格，古典推拉窗的样子
      box(0.09, height - F * 2, 0.1, matWoodTop, 0, -height / 2, 0, sg);
      // 中横档：四格，比只一根竖梃更有家具感
      box(width - F * 2, 0.09, 0.1, matWoodTop, 0, -height * 0.5, 0, sg);
      // 玻璃（上下两块，中间让格条挡着）
      const gw = width - F * 2, gh = (height - F * 2) / 2 - 0.045;
      [[-F - gh / 2, 0], [-height + F + gh / 2, 0]].forEach(function (gl) {
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), matGlass);
        gm.position.set(0, gl[0], 0.012);
        sg.add(gm);
      });
      // 边框内侧一条深色线：布出"框有厚度"的层次
      box(width - F * 2 + 0.02, 0.03, 0.05, matWoodDark, 0, -F + 0.015, 0.04, sg);
      // 把手：金色竖长条 + 两个固定座，形状要能一眼认出是拉手
      const hx = -width / 2 + F + 0.2;
      box(0.055, 0.42, 0.055, matGold, hx, -height * 0.42, 0.1, sg);
      box(0.07, 0.06, 0.11, matGold, hx, -height * 0.42 + 0.19, 0.06, sg);
      box(0.07, 0.06, 0.11, matGold, hx, -height * 0.42 - 0.19, 0.06, sg);
      sg.position.set(x, winTop - 0.1, wz + 0.07 + zOff);
      roomGroup.add(sg);
      return sg;
    }
    const sashW = (winX1 - winX0) / 2 - 0.04;
    const sashH = winTop - 0.22;
    const sashL = buildSlidingSash(sashW, sashH, winX0 + sashW / 2 + 0.02, 0);
    const sashR = buildSlidingSash(sashW, sashH, winX1 - sashW / 2 - 0.02, 0.07);
    // 关着时两扇并排正好盖住窗洞；打开时各滑到两头，中间让出通路。
    // 扇宽要暴露给场景层 —— 滑到位要往回收 sashW/2，不给宽度就不知道收多少。
    api.sashL = sashL;
    api.sashR = sashR;
    api.sashW = sashW;
    // 窗洞范围也一起给出去，滑到位要压在窗洞边缘内侧而不是滑出墙外
    api.winX0 = winX0;
    api.winX1 = winX1;

    // 窗外的柔光花园 (只贴在门窗洞后方，不超出房子轮廓)
    const garden = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 6.8),
      new THREE.MeshBasicMaterial({ map: gardenTex }));
    garden.position.set(0.6, 3.4, -6.7);
    garden.userData.noOutline = true;   // 窗外背景不能描，否则窗洞一圈黑框
    roomGroup.add(garden);

    // === 窗帘：中间对开落地帘 ===
    const rod = cyl(0.055, 0.055, 7.6, matWoodDark, 0.6, 5.62, -SIZE / 2 + 0.42, 12);
    rod.rotation.z = Math.PI / 2;
    sph(0.1, matWoodDark, -3.3, 5.62, -SIZE / 2 + 0.42);
    sph(0.1, matWoodDark, 4.5, 5.62, -SIZE / 2 + 0.42);

    // ---- 中间抽开的落地帘 ----
    // 一整幅帘子，从中间往两侧抽开，收拢时褶皱在两侧挤成一束。
    // 关键：开合时改变的是「投影宽度」，褶皱频率跟着等比变密 ——
    // 布的总长度不变，只是折得更密。这样收拢处才有"抽成一束"的质感，
    // 而不是把帘子拉宽（那样褶皱会被压平）。
    var curtain = makeDrawCurtain(
      6.2,                          // 窗洞 5.6 + 两侧各压 0.3 墙：合上盖严，开了束子刚好落在窗外
      5.42,                       // 帘高：顶边 5.52 贴杆，下摆 0.10 拖到地面上方
      12,                         // 闭合时的褶皱数
      0.32,                       // 完全抽开时每侧留下的束宽：收到窗外，不挡光
      0.6,                        // 水平中心 = 杆中心，和窗洞中心同为 0.6
      5.52,                       // 顶边贴在杆下沿（杆心 5.62、半径 0.055）
      -SIZE / 2 + 0.34
    );
    api.curtain = curtain;

    // 薄纱：挂在窗洞内侧，比窗扇再靠室内一点，
    // 下沿抬到新加的窗台板（y 0.2~0.25）之上，不然会插进窗台里。
    const sheer = new THREE.Mesh(new THREE.PlaneGeometry(winX1 - winX0 - 0.34, winTop - 0.5),
      new THREE.MeshStandardMaterial({ color: 0xfff9f0, transparent: true, opacity: 0.28,
        roughness: 1, side: THREE.DoubleSide, depthWrite: false }));
    sheer.position.set((winX0 + winX1) / 2, 0.34 + (winTop - 0.5) / 2, -SIZE / 2 + 0.26);
    sheer.userData.noOutline = true;
    roomGroup.add(sheer);

    // 暴露给场景层，HUD 按钮要用
    api.sashL = sashL;
    api.sashR = sashR;
    api.sheer = sheer;

    // 悬挂绿植：挪到窗左外的墙上，别挂窗心 —— 帘合上时正好盖住它，开合还会扫到叶子
    cyl(0.015, 0.015, 1.3, matDark, -2.85, 6.0, -SIZE / 2 + 0.5, 6);
    trailingPlant(-2.85, 5.3, -SIZE / 2 + 0.5, 5, 1.9);

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
      const depth = 1.1, width = 2.6, height = 4.9;
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

    // ---- 悬空搁板（左墙，和衣柜做成一体）----
    // 深度、进深、中心 x 都和衣柜一致（cx -4.78 / depth 1.1），
    // 正面 x=-4.23 齐平，z 从 -4.6 一直伸到 1.0（衣柜起始面），
    // 顶板和衣柜顶齐平，看起来是一整条沿墙的通长柜子。
    // 只保留远端（-z）那块侧板，靠衣柜那头不要侧板，否则接缝处会看到一条挡板。
    (function wallShelf() {
      const cx = -4.78, cz = -2.25;
      // y 再压一点，稳稳卡在衣柜顶板（外挑一圈）底沿之下，不留穿插
      const depth = 1.1, length = 6.5, y = 4.26;
      const SHELF_H = 0.72;
      // 底板 + 顶板
      box(depth, 0.07, length, matWood, cx, y, cz);
      box(depth, 0.07, length, matWood, cx, y + SHELF_H, cz);
      // 背板（贴墙，东西不会往后掉）
      box(0.05, SHELF_H, length, matWoodDark, cx - depth / 2 + 0.025, y + SHELF_H / 2, cz);
      // 两端封板：靠衣柜那头不做（要无缝接上），-z 那头顶到后墙
      box(depth, SHELF_H, 0.07, matWood, cx, y + SHELF_H / 2, cz - length / 2 + 0.035);
      box(depth, SHELF_H, 0.07, matWood, cx, y + SHELF_H / 2, cz + length / 2 - 0.035);

      // ---- 竖向隔断：把这条通长柜分成 5 个格子，像隔断柜那样 ----
      const DIV_N = 4;
      for (let i = 1; i <= DIV_N; i++) {
        const dz = cz - length / 2 + (length / (DIV_N + 1)) * i;
        box(depth, SHELF_H, 0.06, matWoodTop, cx, y + SHELF_H / 2, dz);
      }

      // ---- 格子里的东西 ----
      const cellZ = i => cz - length / 2 + (length / (DIV_N + 1)) * (i - 0.5);
      const SHELF_Y = y + 0.07;    // 格子底板上表面

      // 格 1：收纳箱 + 藤筐
      box(0.62, 0.42, 0.72, matCard, cx + 0.05, SHELF_Y + 0.21, cellZ(1));
      box(0.58, 0.05, 0.68, M(0xcfae80), cx + 0.05, SHELF_Y + 0.44, cellZ(1));
      pottedPlant(cx + 0.02, SHELF_Y, cellZ(1) + 0.82, 0.5, matSage);

      // 格 2：书堆 + 竖插书
      bookStack(cx + 0.05, SHELF_Y, cellZ(2), 4, -0.18);
      pottedPlant(cx + 0.05, SHELF_Y, cellZ(2) + 0.8, 0.42, matCoral);

      // 格 3：小柜/藤编篮
      rbox(0.66, 0.46, 0.8, 0.05, matWood, cx + 0.05, SHELF_Y + 0.23, cellZ(3));
      box(0.7, 0.06, 0.84, matWoodTop, cx + 0.05, SHELF_Y + 0.49, cellZ(3));

      // 格 4：书堆 + 植物
      bookStack(cx + 0.05, SHELF_Y, cellZ(4), 3, 0.22);
      pottedPlant(cx + 0.05, SHELF_Y, cellZ(4) + 0.82, 0.48, matCard);

      // 格 5（靠衣柜那头）：藤筐 + 竖插书
      rbox(0.6, 0.4, 0.72, 0.05, M(0xb08a5c), cx + 0.05, SHELF_Y + 0.2, cellZ(5));
      bookStack(cx + 0.05, SHELF_Y, cellZ(5) + 0.85, 3, 0.1);
    })();

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
      const fab = matSofaFabric;
      rbox(2.0, 0.55, 1.9, 0.22, fab, 0, 0.5, 0, g);              // 底座
      rbox(1.55, 0.28, 1.5, 0.14, fab, 0, 0.86, 0.1, g);           // 坐垫
      const back = rbox(2.0, 1.7, 0.5, 0.24, fab, 0, 1.55, -0.72, g);
      back.rotation.x = -0.06;
      rbox(0.42, 0.75, 1.75, 0.2, fab, -0.86, 1.1, 0.02, g);      // 扶手
      rbox(0.42, 0.75, 1.75, 0.2, fab, 0.86, 1.1, 0.02, g);
      const cushion = rbox(0.72, 0.66, 0.3, 0.14, matSofaCushion, -0.1, 1.3, -0.4, g);
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
      g.position.set(4.35, 2.08, -5.02);
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
      g.position.set(4.3, 0, -3.85);
      roomGroup.add(g);
    })();

    // 墙面小画 (斗柜上方 & 窗上方：帘顶 5.52，画必须让出帘布带)
    wallArt(4.3, 3.75, -SIZE / 2 + 0.05, 1.0, 1.3, artTex('dots'));
    wallArt(5.15, 3.5, -SIZE / 2 + 0.05, 0.62, 0.8, artTex('leaf'));
    wallArt(0.6, 5.95, -SIZE / 2 + 0.05, 0.6, 0.6, artTex('arch'));

    // 左墙的画：挂成搁板上方的横排。
    //
    // 先说为什么不挂低一点 —— 那面墙下半截全被东西占了：
    // 悬空搁板 z -5.5..1.0 / y 4.26..4.98，衣柜 z 1.0..3.6 / 高 4.9，
    // 暖气片 z 1.0..4.6。所以唯一空出来的是搁板顶（4.98）到墙顶（6.5）
    // 这条 1.5 高的带子，画就排在这里，一眼看过去也整齐。
    //
    // wallArt 的 w/h 是画框自身的宽高：框建在局部 XY 平面，
    // 绕 Y 转 90° 后局部 +Z（画面朝向）变成世界 +X 朝房间，
    // 局部 +X（宽）变成世界 -Z —— 所以**宽是沿着墙走的**，别给反，
    // 给反会变成一条竖细缝。
    // x 取 -SIZE/2 + 0.05：左墙内表面在 -5.5，往房间里挪一点免得陷进墙里。
    var LW = -SIZE / 2 + 0.05;
    wallArt(LW, 5.72, -3.55, 1.05, 0.82, artTex('wave'), Math.PI / 2);
    wallArt(LW, 5.66, -2.30, 0.78, 0.94, artTex('botanic'), Math.PI / 2);
    wallArt(LW, 5.74, -1.05, 1.02, 0.78, artTex('stripe'), Math.PI / 2);
    wallArt(LW, 5.62, 0.25, 0.74, 0.92, artTex('arch2'), Math.PI / 2);
    wallArt(LW, 5.78, 2.30, 0.92, 0.70, artTex('leaf'), Math.PI / 2);

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