import {
  localStore,
  getRandomValue,
  getComputedStyle,
} from './utils';
import pkg from '../package.json';
import * as Bowser from 'bowser';

const {
  browser,
  os,
  engine,
} = Bowser.parse(window.navigator.userAgent);

// 默认设置
const defaultOptions = {
  // 数据源服务地址
  dsn: '',
  // 发送方式, beacon image
  send_type: 'beacon',
  // 是否开启自动收集点击事件
  auto_track_click: true,
  // 收集包含有元素 attribute 的点击
  track_attrs_click: [],
  // 收集包含有元素 className 的点击
  track_classes_click: [],
  // 是否开启收集所有点击事件
  track_all_click: false,
  // 单页面配置，默认开启
  auto_track_spa: true,
  // 单页应用的发布路径，默认为/
  spa_public_path: '/',
  // 开启调试
  debug: false,
};

// 状态信息
const state = Object.create(null);

// 挂载全局预置属性
state.preset = {
  $st: 'web',
  $sv: pkg.version,
  $lg: navigator.language,
  $pf: navigator.platform,
  $os: os.name,
  $ov: os.versionName,
  $br: browser.name,
  $bv: browser.version,
  $eg: engine.name,
  $ev: engine.version,
};

// 页面预置属性
const getPagePresetProps = () => ({
  $tt: document.title,
  $url: location.href,
  $path: location.pathname,
});

// 通过图片发送信息
// 协议必须一致
const sendImage = (params, callback) => {
  const img = document.createElement('img');
  img.onabort = img.onerror = img.onload = () => {
    img.onload = null;
    img.onerror = null;
    img.onabort = null;
    typeof callback === 'function' && callback();
  };
  img.width = 1;
  img.height = 1;
  const usp = new URLSearchParams(params).toString();
  img.src = `${state.options.dsn}?${usp}`;
};

// 通过 beacon 发送信息
const sendBeacon = (params, callback) => {
  const usp = new URLSearchParams(params).toString();
  navigator.sendBeacon(state.options.dsn, usp);
  setTimeout(() => {
    typeof callback === 'function' && callback();
  }, 0);
};

// 最终发送信息的方法
let sendMethod;

// 触发事件的方法
// event_name 事件，名称
// payload 载荷信息，必须为Object对象
// callback 回掉函数
const track = (ename, payload, callback) => {
  const info = {
    ename,
    ...state.preset,
    ...getPagePresetProps(),
    ...payload,
  };
  // debug
  if (state.options.debug) {
    console.log(info);
  }
  // 发送
  sendMethod(info, callback);
};

// 来源页面地址
let referrer = document.referrer;

// 自动收集spa应用页面浏览
const autoTrackSinglePage = () => {
  const historyPushState = window.history.pushState;
  const historyReplaceState = window.history.replaceState;

  window.history.pushState = (...rest) => {
    historyPushState.apply(window.history, rest);
    track('$pageview', {
      $ref: referrer,
    });
    referrer = location.href;
  };
  window.history.replaceState = (...rest) => {
    historyReplaceState.apply(window.history, rest);
    track('$pageview', {
      $ref: referrer,
    });
    referrer = location.href;
  };
  window.addEventListener('popstate', () => {
    // console.log(ev.state);
    track('$pageview', {
      $ref: referrer,
    });
    referrer = location.href;
  });
};

// 手动触发spa应用 pageview 事件
// payload 载荷信息，必须为 Object 对象
const trackSinglePage = (payload) => {
  track('$pageview', {
    $ref: referrer,
    ...payload,
  });
  referrer = location.href;
};

// 获取被收集元素
const getTrackedEl = (composedPath) => {
  let editEl = null;
  let elEl = null;
  let attrEl = null;
  let classEl = null;
  let pointerEl = null;
  let btnEl = null;
  for (let index = 0, len = composedPath.length; index < len; index++) {
    const el = composedPath[index];
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'body' || tagName === 'html') break;
    if (el.hasAttribute('contenteditable') && el.getAttribute('contenteditable') !== 'false') {
      if (editEl) break;
      editEl = { type: 'editable', el, index };
    } else if (tagName === 'a' || tagName === 'input' || tagName === 'textarea') {
      if (elEl) continue;
      elEl = { type: tagName, el, index };
    } else if (state.options.track_attrs_click.some(attr => el.hasAttribute(attr))) {
      if (attrEl) continue;
      attrEl = { type: 'attr', el, index };
    } else if (state.options.track_classes_click.some(cls => el.classList.contains(cls))) {
      if (classEl) continue;
      classEl = { type: 'class', el, index };
    } else if (getComputedStyle(el, 'cursor') === 'pointer') {
      if (pointerEl) continue;
      pointerEl = { type: 'pointer', el, index };
    } else if (tagName === 'button') {
      !btnEl && (btnEl = { type: 'button', el, index });
    }
  }
  if (editEl) return editEl;
  if (elEl) return elEl;
  if (attrEl) return attrEl;
  if (classEl) return classEl;
  if (pointerEl) return pointerEl;
  if (btnEl) return btnEl;
  if (state.options.track_all_click) {
    return { type: 'target', el: composedPath[0], index: 0 };
  }
};
// 获取选择器
const getSelectorFromPath = (path) => {
  const sels = [];
  for (const el of path) {
    if (el.id) {
      sels.unshift(`#${el.id}`);
      break;
    } else if (el.className) {
      sels.unshift(`.${el.classList[0]}`);
    } else {
      sels.unshift(el.tagName.toLowerCase());
    }
    if (el.tagName === 'BODY' || el.tagName === 'HTML') break;
  }
  return sels.join('>');
};
// 获取有效点击元素的信息
const getClickPayload = (el, path) => {
  const payload = {
    $el_tag: el.tagName.toLowerCase(),
  };
  if (el.id) {
    payload.$el_id = el.id;
  }
  if (el.name) {
    payload.$el_name = el.name;
  }
  if (el.className) {
    payload.$el_cls = el.className;
  }
  if (el.href) {
    payload.$el_href = el.href;
  }
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    if (el.value) {
      payload.$el_ct = el.value;
    }
  } else {
    const textContent = el.textContent.replace(/\s+/g, ' ').trim();
    if (textContent) {
      payload.$el_ct = textContent.substring(0, 255);
    }
  }
  payload.$el_sel = getSelectorFromPath(path);
  return payload;
};

// 自动收集点击事件
const autoTrackClick = () => {
  document.addEventListener('click', (ev) => {
    if (!ev || !ev.target) return false;
    const target = ev.target;
    if (target.nodeType !== 1) return;
    if (target.tagName === 'BODY' || target.tagName === 'HTML') return;
    // 点击处在页面中的定位
    const pagePosition = {
      $page_x: ev.pageX,
      $page_y: ev.pageY,
    };
    const composedPath = ev.composedPath ? ev.composedPath() : ev.path;
    // 获取被收集元素
    const trackedElInfo = getTrackedEl(composedPath.slice(0, 10));
    if (!trackedElInfo) return;
    const { el: trackedEL, index: trackedELIndex } = trackedElInfo;
    // 获取被收集元素的信息
    const trackedELPayload = getClickPayload(trackedEL, composedPath.slice(trackedELIndex));
    if (
      trackedEL.tagName === 'A' &&
      /^https?:\/\//.test(trackedEL.href) &&
      trackedEL.target !== '_blank' &&
      !trackedEL.download
    ) {
      // 在当前页面打开的a链接
      try {
        const trackedELURL = new URL(trackedEL.href);
        if (
          state.options.auto_track_spa &&
          trackedELURL.origin === location.origin &&
          trackedELURL.href.startsWith(`${location.origin}${state.options.spa_public_path}`)
        ) {
          // 单页应用路由点击
          // 单页应用中，默认所有的非blank相对链接都为单页应用路由路径
          track('$click', { ...pagePosition, ...trackedELPayload });
        } else {
          // 阻止链接跳转
          ev.preventDefault();
          // 是否已经触发过链接跳转
          let hasCalled = false;
          // 恢复原有链接跳转
          const jumpUrl = () => {
            if (!hasCalled) {
              hasCalled = true;
              location.href = trackedEL.href;
            }
          };
          // 最大时间后跳转，保证用户体验
          // 对于 image 发送方式，如果发送数据时间大于1000ms，则可能无法成功发送数据
          let timeout = setTimeout(jumpUrl, 1000);
          track('$click', { ...pagePosition, ...trackedELPayload }, () => {
            clearTimeout(timeout);
            jumpUrl();
          });
        }
      } catch (error) {
        console.warn(error);
      }
    } else {
      track('$click', { ...pagePosition, ...trackedELPayload });
    }
  }, true);
};

// 手动触发 click 点击事件
// ev 点击事件的事件对象
// payload 载荷信息，必须为 Object 对象
const trackClick = (ev, payload) => {
  const ct = ev.currentTarget;
  const pagePosition = {
    $page_x: ev.pageX,
    $page_y: ev.pageY,
  };
  const composedPath = ev.composedPath ? ev.composedPath() : ev.path;
  const trackedELIndex = composedPath.findIndex((el) => el === ct);
  track('$click', {
    ...pagePosition,
    ...getClickPayload(ct, composedPath.slice(trackedELIndex)),
    ...payload,
  });
};

// 初始化设备ID
const initVisitorId = () => {
  if (state.options.vid) {
    localStore.set('vid', state.options.vid);
  }
  let vid = localStore.get('vid');
  if (!vid) {
    vid = getRandomValue();
    localStore.set('vid', vid);
  }
  state.preset.vid = vid;
};

// 初始化方法
const init = (options) => {
  // 初始化并挂载选项
  state.options = options = Object.assign(defaultOptions, options);
  // 格式化配置项
  if (!options.spa_public_path.startsWith('/')) {
    options.spa_public_path = `/${options.spa_public_path}`;
  }
  state.options.track_attrs_click = state.options.track_attrs_click || [];
  state.options.track_classes_click = state.options.track_classes_click || [];

  // 初始化设备ID
  initVisitorId();

  // 设置发送方法
  sendMethod = options.send_type === 'beacon' ? sendBeacon : sendImage;

  // 初次加载触发pageview事件
  track('$pageview', {
    $ref: referrer,
  });

  // 设置收集单页应用浏览事件
  if (options.auto_track_spa) {
    autoTrackSinglePage();
  }

  // 设置收集元素点击事件
  if (options.auto_track_click) {
    autoTrackClick();
  }
};

export default {
  init,
  track,
  trackClick,
  trackSinglePage,
  // 添加全局预置属性
  appendPresetState(name, value) {
    state.preset[name] = value;
  },
  // 设置 唯一ID
  setVisitorId: (id) => {
    state.preset.vid = id;
    localStore.set('vid', id);
  },
};
