import { stringify } from 'jsan';

function sender(data, sendTo) {
  try {
    fetch(sendTo, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(data)
    }).catch(function (err) {
      console.warn(err);
    });
  } catch (err) {
    console.warn(err);
  }
}

function prepare(data, options, action) {
  let preloadedState = options.preloadedState;
  if (typeof preloadedState !== 'undefined') preloadedState = stringify(options.preloadedState);
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
    payload: data && stringify(data),
    preloadedState,
    title: options.title,
    description: options.description,
    screenshot: options.screenshot,
    version: options.version,
    userAgent: options.userAgent,
    user: options.user,
    meta: options.version
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
  let data;
  const { onlyState, withState, sendOn } = options;
  const state = store.getState();
  if (onlyState) {
    options.preloadedState = state;
  } else if (withState) {
    data = { state, action };
  } else {
    data = action;
  }
  if (options.every) {
    options.sender(prepare(data, options), options.sendTo);
  } else {
    if (!onlyState) add(data, options, state);
    if (
      typeof sendOn === 'string' && sendOn === action.type ||
      typeof sendOn === 'object' && sendOn.indexOf(action.type) !== -1
    ) {
      options.sender(prepare(options.data, options, action.type), options.sendTo);
    }
  }
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

  return (createStore) => (reducer, preloadedState, enhancer) => {
    const store = createStore(reducer, preloadedState, enhancer);

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
