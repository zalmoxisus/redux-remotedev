import { stringify } from 'jsan';
import catchErrors from 'remotedev-utils/lib/catchErrors';
import { arrToRegex, isFiltered } from 'remotedev-utils/lib/filters';

function sender(data, sendTo, status) {
  if (status && status.started) status.started(data);
  try {
    const f = fetch(sendTo, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (status && (status.done || status.failed)) {
      f.then((response) => (
        response.json()
      )).then((r) => {
        if (r && r.id) {
          if (status.done) status.done(r.id);
        } else {
          if (status.failed) status.failed(r.error);
        }
      }).catch((err) => {
        if (status && status.failed) status.failed(err.message || err);
      });
    }
  } catch (err) {
    if (status && status.failed) status.failed(err.message || err);
    console.warn(err);
  }
}

function prepare(data, options, action, error) {
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
    userAgent: options.userAgent,
    user: options.user,
    meta: options.version,
    error
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
    options.sender(prepare(data, options), options.sendTo, options.sendingStatus);
  } else {
    if (!onlyState) add(data, options, state);
    if (
      typeof sendOn === 'string' && sendOn === action.type ||
      typeof sendOn === 'object' && sendOn.indexOf(action.type) !== -1
    ) {
      options.sender(
        prepare(options.data, options, action.type),
        options.sendTo, options.sendingStatus
      );
    }
  }
}

function watchExceptions(store, options) {
  catchErrors((errAction) => {
    let prevAction;
    if (options.data) {
      prevAction = options.data[options.data.length - 1];
      if (prevAction.action && prevAction.action.type) prevAction = prevAction.action;
      prevAction = prevAction.type;
    }

    preSend(errAction, store, options);
    options.sender(
      prepare(options.data, options, prevAction, errAction),
      options.sendTo, options.sendingStatus
    );
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
