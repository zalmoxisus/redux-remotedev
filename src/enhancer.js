import { stringify } from 'jsan';
import catchErrors from 'remotedev-utils/lib/catchErrors';
import { arrToRegex, isFiltered } from 'remotedev-utils/lib/filters';

function sender(data, sendTo, headers, status, store) {
  if (status && status.started) status.started(data, store);
  try {
    const f = fetch(sendTo, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers
      },
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    if (status && (status.done || status.failed)) {
      f.then((response) => (
        response.json()
      )).then((r) => {
        if (r && r.id) {
          if (status.done) status.done(r.id, store);
        } else {
          if (status.failed) status.failed(r.error, store);
        }
      }).catch((err) => {
        if (status && status.failed) status.failed(err.message || err, store);
      });
    }
  } catch (err) {
    if (status && status.failed) status.failed(err.message || err, store);
    console.warn(err);
  }
}

function send(data, options, store) {
  if (!options.beforeSending) {
    options.sender(data, options.sendTo, options.headers, options.sendingStatus, store);
  } else {
    options.beforeSending(data, (aData) => {
      options.sender(aData || data, options.sendTo, options.headers, options.sendingStatus, store);
    }, options);
  }
}

function prepare(data, options, action, exception) {
  let preloadedState = options.preloadedState;
  if (typeof preloadedState !== 'undefined') {
    preloadedState = stringify(options.preloadedState, options.stringifyReplacer);
  }
  if (!options.userAgent) {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent) {
      options.userAgent = window.navigator.userAgent;
    } else {
      options.userAgent = 'non-browser';
    }
  }

  return {
    type: options.type,
    action,
    payload: data && stringify(data, options.stringifyReplacer),
    preloadedState,
    title: options.title ? options.title : undefined,
    description: options.description,
    screenshot: options.screenshot,
    version: options.version,
    appId: options.appId,
    instanceId: options.instanceId,
    userAgent: options.userAgent,
    user: options.user,
    meta: options.version,
    exception
  };
}

function add(data, options, state) {
  if (options.maxAge < options.data.length) {
    const sData = options.data.shift();
    if (sData) {
      if (options.withState) options.preloadedState = sData.state;
      else options.preloadedState = options.states.shift();
    }
  }
  if (!options.withState) options.states.push(state);
  options.data.push(data);
}

function preSend(action, store, options) {
  if (isFiltered(action, options.filters)) return;
  let data;
  const { onlyState, withState, sendOn } = options;
  let state = store.getState();

  if (options.actionSanitizer) action = options.actionSanitizer(action);
  if (options.stateSanitizer) state = options.stateSanitizer(state);

  if (onlyState) {
    options.preloadedState = state;
  } else if (withState) {
    data = { state, action };
  } else {
    data = action;
  }
  if (options.every) {
    send(prepare(data, options), options, store);
  } else {
    if (!onlyState) add(data, options, state);
    let shouldSend = false;
    if (
      options.sendOnCondition &&
      !options.sentOnCondition && options.sendOnCondition(state, action)
    ) {
      shouldSend = true;
      options.sentOnCondition = true;
    }
    if (
      shouldSend ||
      typeof sendOn === 'string' && sendOn === action.type ||
      typeof sendOn === 'object' && sendOn.indexOf(action.type) !== -1
    ) {
      send(prepare(options.data, options, action.type), options, store);
    }
  }
}

function watchExceptions(store, options) {
  catchErrors((errAction) => {
    let prevAction;
    if (options.data) {
      prevAction = options.data[options.data.length - 1];
      if (prevAction) {
        if (prevAction.action && prevAction.action.type) prevAction = prevAction.action;
        prevAction = prevAction.type;
      }
    }

    preSend(errAction, store, options);
    send(prepare(options.data, options, prevAction, errAction), options, store);
  });
}

export default function remotedevEnhancer(options) {
  if (!options || !options.sendTo && !options.sender) {
    throw new Error('Provide at least `sendTo` or `sender` option for remotedev enhancer.');
  }
  if (!options.sender) options.sender = sender;
  if (options.onlyState) {
    if (!options.type) options.type = 'STATE';
  } else if (options.every) {
    if (!options.type) options.type = 'ACTION';
  } else {
    if (!options.maxAge) options.maxAge = 30;
    if (!options.type) options.type = !options.withState ? 'ACTIONS' : 'STATES';
    options.data = [];
  }
  if (!options.withState && options.maxAge) options.states = [];
  if (options.actionsWhitelist) {
    options.filters = { whitelist: arrToRegex(options.actionsWhitelist) };
  } else if (options.actionsBlacklist) {
    options.filters = { blacklist: arrToRegex(options.actionsBlacklist) };
  }

  return (createStore) => (reducer, preloadedState, enhancer) => {
    const store = createStore(reducer, preloadedState, enhancer);
    if (options.sendOnError) watchExceptions(store, options);

    const dispatch = (action) => {
      if (
        typeof options.preloadedState === 'undefined' &&
        options.data && options.data.length === 0
      ) {
        options.preloadedState = store.getState();
      }
      const r = store.dispatch(action);
      preSend(action, store, options);
      return r;
    };

    return {
      ...store,
      dispatch
    };
  };
}
