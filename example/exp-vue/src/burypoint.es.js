// 类型判断
const typeis = obj => Object.prototype.toString.call(obj).slice(8, -1); // SNB 类型

const isSNBType = obj => {
  const type = typeis(obj);
  return type === 'String' || type === 'Number' || type === 'Boolean';
}; // 获取代理信息

const parseUserAgent = () => {
  if (navigator.userAgentData) {
    return navigator.userAgentData.brands[2];
  }

  const res = /\b(Chrome|Firefox|Safari)\/([\d.]+)\b/.exec(navigator.userAgent);

  if (res) {
    return {
      brand: res[1],
      version: res[2]
    };
  }
};
const localStore = {
  get: key => {
    let res = localStorage.getItem(key);

    try {
      res = JSON.parse(res) || '';
    } catch (error) {
      // console.warn(error);
      res = '';
    }

    return res;
  },
  set: (key, value) => {
    try {
      value = value || '';

      if (!isSNBType(value)) {
        value = JSON.stringify(value);
      }
    } catch (error) {
      // console.warn(error);
      value = '';
    }

    localStorage.setItem(key, value);
  },
  remove: key => {
    if (key) {
      localStorage.removeItem(key);
    } else {
      localStorage.clear();
    }
  }
}; // 获取随机值

const getRandomValue = () => {
  const array = new Uint32Array(3);
  window.crypto.getRandomValues(array);
  return array.join('-');
}; // 获取计算样式

const getComputedStyle = (el, name) => {
  if (el.computedStyleMap) {
    return el.computedStyleMap().get(name);
  }

  return window.getComputedStyle(el).getPropertyValue(name);
};

var name = "barypoint";
var version = "1.0.0";
var main = "index.js";
var author = "ct";
var license = "MIT";
var scripts = {
	watch: "rollup -c rollup.config.js -w",
	build: "rollup -c rollup.config.js"
};
var devDependencies = {
	"@babel/core": "^7.14.0",
	"@babel/preset-env": "^7.14.0",
	"@rollup/plugin-babel": "^4.4.0",
	"@rollup/plugin-commonjs": "^10.1.0",
	"@rollup/plugin-eslint": "^8.0.1",
	"@rollup/plugin-json": "^4.1.0",
	"@rollup/plugin-node-resolve": "^5.2.0",
	"@rollup/plugin-replace": "^2.4.2",
	chokidar: "^3.5.1",
	rollup: "^2.46.0",
	"rollup-plugin-terser": "^7.0.2a"
};
var dependencies = {
};
var pkg = {
	name: name,
	version: version,
	main: main,
	author: author,
	license: license,
	scripts: scripts,
	devDependencies: devDependencies,
	dependencies: dependencies
};

const defaultOptions = {
  dsn: '',
  // 数据源服务地址
  use_client_time: true,
  send_type: 'beacon',
  // 发送方式, beacon image
  // 是否开启自动追踪页面浏览事件
  track_page_view: true,
  // 是否开启自动追踪点击事件
  auto_track_click: true,
  // 追踪的元素属性
  track_attrs: [],
  // 追踪的元素 className
  track_class_name: [],
  // 单页面配置，默认开启
  auto_track_single_page: true,
  // 单页应用的发布路径，默认为/
  single_page_public_path: '/',
  // 开启调试
  debug: false
}; // 状态信息

const state = Object.create(null); // 挂载用户代理数据

state.userAgentData = parseUserAgent(); // 挂载全局预置属性

state.preset = {
  $sdk_version: pkg.version,
  $sdk_type: 'web',
  $user_agent: navigator.userAgent,
  $browser_brand: state.userAgentData.brand,
  $browser_version: state.userAgentData.version,
  $language: navigator.language,
  $platform: navigator.platform
}; // 通过图片发送信息
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
}; // 通过 beacon 发送信息


const sendBeacon = (params, callback) => {
  const usp = new URLSearchParams(params).toString();
  navigator.sendBeacon(state.options.dsn, usp);
  setTimeout(() => {
    typeof callback === 'function' && callback();
  }, 0);
}; // 最终发送信息的方法


let sendMethod; // 触发事件的方法
// $event_type 事件，名称
// payload 载荷信息，必须为Object对象
// callback 回掉函数

const track = ($event_type, payload, callback) => {
  const message = {
    $event_type,
    ...state.preset,
    ...payload
  }; // 使用本地发送时间

  if (state.options.use_client_time) {
    message.$timestamp = Date.now();
  } // 页面相关预置属性


  message.$title = document.title;
  message.$url = location.href;
  message.$url_path = location.pathname; // debug

  if (state.options.debug) {
    console.log(message);
  } // 发送


  sendMethod(message, callback);
}; // 来源页面地址


let referrer = document.referrer; // 自动追踪spa应用页面浏览

const autoTrackSinglePage = () => {
  const historyPushState = window.history.pushState;
  const historyReplaceState = window.history.replaceState;

  window.history.pushState = (...rest) => {
    historyPushState.apply(window.history, rest); // 设置是否自动追踪页面浏览事件

    if (state.options.track_page_view) {
      track('$pageview', {
        $referrer: referrer
      });
    }

    referrer = location.href;
  };

  window.history.replaceState = (...rest) => {
    historyReplaceState.apply(window.history, rest); // 设置是否自动追踪页面浏览事件

    if (state.options.track_page_view) {
      track('$pageview', {
        $referrer: referrer
      });
    }

    referrer = location.href;
  };

  window.addEventListener('popstate', () => {
    // console.log(ev, ev.state);
    // 设置是否自动追踪页面浏览事件
    if (state.options.track_page_view) {
      track('$pageview', {
        $referrer: referrer
      });
    }

    referrer = location.href;
  });
}; // 手动触发spa应用 pageview 事件
// payload 载荷信息，必须为 Object 对象


const trackSinglePage = payload => {
  track('$pageview', {
    $referrer: referrer,
    ...payload
  });
  referrer = location.href;
}; // 获取被追踪元素


const getTrackedEl = composedPath => {
  const aEls = [];
  const attrEls = [];
  const classEls = [];
  const buttonEls = [];
  const pointerEls = [];

  for (let index = 0, len = composedPath.length; index < len; index++) {
    const el = composedPath[index];
    if (el.tagName === 'BODY') break;

    if (el.tagName === 'A') {
      aEls.push({
        type: 'a',
        el,
        index
      });
    } else if (state.options.track_attrs.some(attr => el.hasAttribute(attr))) {
      attrEls.push({
        type: 'attrs',
        el,
        index
      });
    } else if (state.options.track_class_name.some(cls => el.classList.contains(cls))) {
      classEls.push({
        type: 'class',
        el,
        index
      });
    } else if (el.tagName === 'BUTTON') {
      buttonEls.push({
        type: 'button',
        el,
        index
      });
    } else if (getComputedStyle(el, 'cursor') === 'pointer') {
      pointerEls.push({
        type: 'pointer',
        el,
        index
      });
    }
  }

  if (aEls.length) return aEls[0];else if (attrEls.length) return attrEls[0];else if (classEls.length) return classEls[0];else if (buttonEls.length) return buttonEls[0];else if (pointerEls.length) return pointerEls[0];
  return {
    type: 'target',
    el: composedPath[0],
    index: 0
  };
}; // 获取选择器


const getSelectorFromPath = path => {
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

    if (el.tagName === 'BODY') break;
  }

  return sels.join('>');
}; // 获取有效点击元素的信息


const getClickPayload = (el, path) => {
  const payload = {
    $element_tag_name: el.tagName.toLowerCase()
  };

  if (el.id) {
    payload.$element_id = el.id;
  }

  if (el.name) {
    payload.$element_name = el.name;
  }

  if (el.className) {
    payload.$element_class_name = el.className;
  }

  if (el.href) {
    payload.$element_target_url = el.href;
  }

  if (el.textContent.trim()) {
    payload.$element_content = el.textContent.replace(/\s+/g, ' ').trim().substring(0, 255);
  }

  payload.$element_selector = getSelectorFromPath(path);
  return payload;
}; // 自动追踪点击事件


const autoTrackClick = () => {
  document.addEventListener('click', ev => {
    if (!ev || !ev.target) return false;
    const target = ev.target;
    if (target.nodeType !== 1) return;
    if (target.tagName === 'BODY' || target.tagName === 'HTML') return; // 点击处在页面中的定位

    const pagePosition = {
      $page_x: ev.pageX,
      $page_y: ev.pageY
    };
    const composedPath = ev.composedPath ? ev.composedPath() : ev.path; // 获取被追踪元素

    const {
      el: trackedEL,
      index: trackedELIndex
    } = getTrackedEl(composedPath); // 获取被追踪元素的信息

    const trackedELPayload = getClickPayload(trackedEL, composedPath.slice(trackedELIndex));

    if (trackedEL.tagName === 'A' && /^https?:\/\//.test(trackedEL.href) && trackedEL.target !== '_blank' && !trackedEL.download) {
      // 在当前页面打开的a链接
      try {
        const trackedELURL = new URL(trackedEL.href);

        if (state.options.auto_track_single_page && trackedELURL.origin === location.origin && trackedELURL.href.startsWith(`${location.origin}${state.options.single_page_public_path}`)) {
          // 单页应用路由点击
          track('$click', { ...pagePosition,
            ...trackedELPayload
          });
        } else {
          // 阻止链接跳转
          ev.preventDefault(); // 是否已经触发过链接跳转

          let hasCalled = false; // 恢复原有链接跳转

          const jumpUrl = () => {
            if (!hasCalled) {
              hasCalled = true;
              location.href = trackedEL.href;
            }
          }; // 最大时间后跳转，保证用户体验
          // 对于 image 发送方式，如果发送数据时间大于1000ms，则可能无法成功发送数据


          let timeout = setTimeout(jumpUrl, 1000);
          track('$click', { ...pagePosition,
            ...trackedELPayload
          }, () => {
            clearTimeout(timeout);
            jumpUrl();
          });
        }
      } catch (error) {
        console.warn(error);
      }
    } else {
      track('$click', { ...pagePosition,
        ...trackedELPayload
      });
    } // 追踪 a button 点击
    // const clickElIndex = composedPath.findIndex(el => el.tagName === 'A' || 'BUTTON');
    // if (clickElIndex !== -1) {
    //   const clickEl = composedPath[clickElIndex];
    //   const payload = getClickPayload(clickEl, composedPath.slice(clickElIndex));
    //   if (
    //     clickEl.tagName === 'A' &&
    //     /^https?:\/\//.test(clickEl.href) &&
    //     clickEl.target !== '_blank' &&
    //     !clickEl.download
    //   ) {
    //     // 有效可刷新链接
    //     try {
    //       const clickElURL = new URL(clickEl.href);
    //       if (
    //         state.options.auto_track_single_page &&
    //         clickElURL.origin === location.origin &&
    //         clickElURL.href.startsWith(`${location.origin}${state.options.single_page_public_path}`)
    //       ) {
    //         // 单页应用路由点击
    //         track('$click', { ...pagePosition, ...payload });
    //       } else {
    //         // 不满足单页应用路由的情况下恢复原有的链接跳转
    //         // 阻止默认
    //         ev.preventDefault();
    //         // 是否已经触发过跳转
    //         let hasCalled = false;
    //         // 对于 image 发送方式，如果发送数据时间大于1000ms，则可能无法成功发送数据
    //         const jumpUrl = () => {
    //           if (!hasCalled) {
    //             hasCalled = true;
    //             location.href = clickEl.href;
    //           }
    //         };
    //         // 最大时间后跳转，保证用户体验
    //         let timeout = setTimeout(jumpUrl, 1000);
    //         track('$click', { ...pagePosition, ...payload }, () => {
    //           clearTimeout(timeout);
    //           jumpUrl();
    //         });
    //       }
    //     } catch (error) {
    //       console.warn(error);
    //     }
    //   } else {
    //     track('$click', { ...pagePosition, ...payload });
    //   }
    // } else {
    //   track('$click', { ...pagePosition, ...getClickPayload(target, composedPath)});
    // }

  }, true);
}; // 手动触发 click 点击事件
// ev 点击事件的事件对象
// payload 载荷信息，必须为 Object 对象


const trackClick = (ev, payload) => {
  const ct = ev.currentTarget;
  const pagePosition = {
    $page_x: ev.pageX,
    $page_y: ev.pageY
  };
  const composedPath = ev.composedPath ? ev.composedPath() : ev.path;
  const trackedELIndex = composedPath.findIndex(el => el === ct);
  track('$click', { ...pagePosition,
    ...getClickPayload(ct, composedPath.slice(trackedELIndex)),
    ...payload
  });
}; // 初始化设备ID


const initDistinctId = () => {
  let distinct_id = localStore.get('distinct_id');

  if (!distinct_id) {
    distinct_id = getRandomValue();
    localStore.set('distinct_id', distinct_id);
  }

  state.preset.distinct_id = distinct_id;
}; // 初始化方法


const init = options => {
  // 初始化并挂载选项
  state.options = options = Object.assign(defaultOptions, options); // 格式化配置项

  if (!options.single_page_public_path.startsWith('/')) {
    options.single_page_public_path = `/${options.single_page_public_path}`;
  }

  state.options.track_attrs = state.options.track_attrs || [];
  state.options.track_class_name = state.options.track_class_name || []; // 初始化设备ID

  initDistinctId(); // 设置发送方法

  sendMethod = options.send_type === 'beacon' ? sendBeacon : sendImage; // 初次加载触发pv事件

  track('$pageview', {
    $referrer: referrer
  }); // 设置追踪单页应用

  if (options.auto_track_single_page) {
    autoTrackSinglePage();
  } // 设置追踪点击事件


  if (options.auto_track_click) {
    autoTrackClick();
  }
};

var index = {
  init,
  track,
  trackClick,
  trackSinglePage,

  // 添加全局预置属性
  appendPresetState(name, value) {
    state.preset[name] = value;
  },

  // 设置 唯一ID
  setDistinctId: id => {
    state.preset.distinct_id = id;
    localStore.set('distinct_id', id);
  }
};

export default index;
//# sourceMappingURL=burypoint.es.js.map