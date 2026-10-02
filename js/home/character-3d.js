/* ============================================================
 * js/home/character-3d.js — 家园 · 3D 人物插槽
 * ============================================================
 *
 * 3D 房间（卧室 / 小厨房）专用的人物模块。目前是空插槽：接口已定好，
 * 但没有内置模型。以后要做人物模型时，只需要在下面替换 adapter 的实现，
 * 房间场景、家具互动、UI 都不用再动。
 *
 * 与 2D 人物完全分离
 * ------------------
 * 2D 房间（客厅 / 浴室 / 庭院）的人物是 DOM 覆盖层，见 character-2d.js。
 * 那边的数据是 state.home.char / mySize / rooms[*].personPos，纯百分比坐标。
 *
 * 这边是 WebGL 网格，数据是各自场景里的 THREE.Object3D，世界坐标。
 * 两边不共享任何代码，只通过下面的接口和房间层对话 ——
 * 所以你可以让 3D 房间用带骨骼的模型、3D 房间有独立动画，
 * 而 2D 房间继续用静态图，两者互不影响。
 *
 * 要实现一个 3D 人物，需要提供这 5 个方法：
 *
 *   mount(opts)
 *     把人物加进场景。opts = { THREE, scene, roomId }
 *     roomId 是 'bedroom' 或 'smallkitchen'，用来决定站位换算和默认朝向。
 *     必须是异步的（模型要下载）；返回 Promise。
 *
 *   setPosition(world)
 *     移动人物。world = { x, y, z }，THREE 世界坐标。
 *
 *   setPose(pose, opts)
 *     切姿势。pose ∈ 'stand' | 'walk' | 'sit' | 'sleep' | 'wave' | 'crouch'
 *     （和 character-2d.js 的 home-pose-* 类同一套取值，两边语义对齐）。
 *     opts = { moving, time, dt }，moving=true 表示正在位移。
 *
 *   setConfig(config)
 *     换外观。config = { height, glasses, hat, ... }，形态由你的模型决定。
 *
 *   dispose()
 *     从场景里摘掉并释放。切房间 / 退出家园时会被调用。
 *
 * 注意事项（以前踩过的坑）
 * ------------------------
 * 带骨骼的模型，geometry / material 是跨实例共享的。
 * 切房间重建时绝不能 dispose 掉它们，否则整个模型会废掉。
 * 只从场景 remove，不要 traverse + dispose。
 *
 * 参考：项目里曾经有过一份 KayKit Rogue（CC0, Kay Lousberg）实现，
 * 连带 js/kaykit-character.js 和 kaykit/*.glb 已于 3D 人物下线时删除。
 * 那份实现踩过的坑（异步加载竞态、模型就绪后没重新应用姿势与站位）
 * 都写在这个文件顶部的历史记录里，可以参考。
 * ============================================================ */
(function (global) {
  'use strict';

  // 当前挂载的人物适配器。默认没有 —— 这就是"空插槽"。
  var adapter = null;

  var Character3D = {

    /**
     * 注册一个 3D 人物实现。之后房间场景初始化时会调用 mount。
     * @param {object} impl 需实现 mount / setPosition / setPose / setConfig / dispose
     */
    register: function (impl) {
      if (!impl || typeof impl.mount !== 'function') {
        console.warn('[home/character-3d] register 需要一个带 mount() 的对象');
        return false;
      }
      ['setPosition', 'setPose', 'setConfig', 'dispose'].forEach(function (key) {
        if (typeof impl[key] !== 'function') {
          console.warn('[home/character-3d] 缺少方法：' + key + '，已补 no-op');
          impl[key] = function () {};
        }
      });
      adapter = impl;
      return true;
    },

    /** 是否已经有可用的人物模型了。房间层用它决定要不要显示 2D 兜底形象。 */
    has: function () {
      return !!adapter;
    },

    /** 取当前站位，房间层在算好世界坐标后调用。 */
    getPosition: function () {
      return { x: 0, y: 0, z: 0 };
    },

    /* ---- 以下都是薄封装，没注册 adapter 时静默降级，不抛错 ---- */

    mount: function (opts) {
      if (!adapter) return Promise.resolve(false);
      try {
        return Promise.resolve(adapter.mount(opts)).then(function (ok) {
          if (ok) console.info('[home/character-3d] 已挂载到房间：' + (opts && opts.roomId));
          return ok;
        });
      } catch (e) {
        console.warn('[home/character-3d] mount 失败', e);
        return Promise.resolve(false);
      }
    },

    setPosition: function (world) {
      if (adapter) adapter.setPosition(world);
    },

    /** 走过去（位移 + 走路动画）。adapter 没有 moveTo 就退回 setPosition。 */
    moveTo: function (world) {
      if (adapter) {
        if (typeof adapter.moveTo === 'function') adapter.moveTo(world);
        else if (typeof adapter.setPosition === 'function') adapter.setPosition(world);
      }
    },

    setPose: function (pose, opts) {
      if (adapter) adapter.setPose(pose, opts || {});
    },

    setConfig: function (config) {
      if (adapter) adapter.setConfig(config || {});
    },

    dispose: function () {
      if (adapter) {
        try { adapter.dispose(); } catch (e) { console.warn('[home/character-3d] dispose 失败', e); }
      }
    }
  };

  global.HomeCharacter3D = Character3D;
})(typeof window !== 'undefined' ? window : this);
