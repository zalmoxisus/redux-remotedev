# Redux Remote DevTools for Production
Receive logs/reports from production and get them replicated with [Redux DevTools extension](https://github.com/zalmoxisus/redux-devtools-extension) (or other [monitoring apps](https://github.com/zalmoxisus/remote-redux-devtools#monitoring)). Unlike other solutions (like [Remote Redux DevTools](https://github.com/zalmoxisus/remote-redux-devtools)), it aims to be optimized for production and suitable for different use cases (see [the options](#api)). Even though it's designed to be used together with [`remotedev-server`](https://github.com/zalmoxisus/remotedev-server), it can be easily integrated with any other server or serverless architectures.

## Installation

```
npm install --save redux-remotedev
```

Optionally, install [isomorphic fetch polyfill](https://github.com/matthew-andrews/isomorphic-fetch) for Node and [unsupported browsers](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API):

```
npm install --save isomorphic-fetch es6-promise
```

## Usage

Just add the store enhancer to your Redux store:

```js
import remotedev from 'redux-remotedev';
import 'isomorphic-fetch'; // include in the main script once
createStore(reducer, remotedev({ sendTo: 'http://localhost:8000' }));
```

More detailed example:

```js
import { createStore, applyMiddleware, compose } from 'redux';
// import thunk from 'redux-thunk';
import remotedev from 'redux-remotedev';
import 'isomorphic-fetch';
import reducer from '../reducers';

export default function configureStore(initialState) {
  const enhancer = compose(
    // applyMiddleware(thunk),
    remotedev({
      sendTo: 'http://localhost:8000',
      sendOn: 'SOME_ACTION',
      maxAge: 50
    })
  );
  const store = createStore(reducer, initialState, enhancer);
  return store;
}
```

See also [`remotedev-server`](https://github.com/zalmoxisus/remotedev-server/pull/20) for integrating the server part.

## API
### `remotedev(options)`

At least `sendTo` or `sender` option should be present.

#### Enhancer's options

##### `sendTo`
*string* - url of the remote server where logs will be posted.

Example:
```js
createStore(reducer, remotedev({ sendTo: 'http://localhost:8000' }))
```

##### `sendOn`
*string or array of strings* - action type(s) dispatching of which will trigger sending the history log. Useful for analytics or for triggering sending explicitly (for example, from a report form or when an exception is caught).

Example:
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  sendOn: 'SOME_ACTION_ERROR' // or array: ['FETCH_ERROR', 'TARGETED_ACTION']
}))
```

##### `sendOnCondition`
*function (state, action)* - when returns `true` (the condition is satisfied), the report will be sent. Unlike `sendOn`, here you can check not only the action type, but the whole action object and also the state object. Another difference is that by default the report will be sent only first time the condition is satisfied. If you want to send it multiple times, set `options.sentOnCondition` to `false` in `beforeSending` function.

Example:
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  sendOnCondition: (action, state) => state.counter.count === 5,
  // sendOnCondition: (action, state) => state.user.id !== undefined,
  // sendOnCondition: (action, state) => action.user.id !== undefined,
  // sendOnCondition: (action, state) => action.type === 'SOME_ACTION'
}))
```

##### `sendOnError`
*boolean* - when set to `true`, will listen for all exceptions from `console.error`, `window.onerror` and `ErrorUtils` (for React Native). When an exception occurs in the app, will send a report including all the details about the exception (also as a Redux action to see the exact failed point when debugging).

##### `sendingStatus`
*object of functions*
- `started(report, store)`: called when attempts to send a report. The report object is passed to the function. You can use it to show a loading indicator for your report dialog. 
- `done(reportId, store)`: called when server returned a success response. The stored report id is passed, so you can generate an url like `http://hostname/?remotedev_report=${id}` (where hostname can be your development or production domain) to replicate the reported issue. When opening this url on a site with the extension included, the exact history state will be applied to your Redux store.  
- `failed(error, store)`: called when server returned an error response or when `fetch` failed. The error message is passed.

Example:
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  sendingStatus: {
    started(report) {
      console.log('Sending a report', report);
    },
    done(reportId) {
      console.info(
        'The report sent. ' +
        'Open this url to replicate: ' +
        'http://localhost:3000/?remotedev_report=' + reportId
       );
    },
    failed(error, store) {
      console.warn('Report cannot be sent.', error);
      // store.dispatch({ type: 'REPORT_FAILED` });
    }
  }
}))
```

##### `beforeSending`
*function(report, sender, options)* - called before attempting to send a report, so you can show a dialog and append some data to the `report` object.

```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  beforeSending(report, send) {
    send({ ...report, title: prompt('Please describe what happened') });
  }
}))
```

##### `headers`
*object* - custom headers to inject into the sending request additionally to `{ 'content-type': 'application/json' }` (which can be overwritten).

Example:
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  headers: {
    'content-type': 'application/javascript', // to use JSON-P instead
    'grant_type': 'client_credentials', // some systems may require credentials
    'client123': 'secret123' // custom header `'<Client-Id>': '<Secret>'`
  }
}))
````

##### `sender`
*function* - custom function used to post the data. Usually, you don't need to specify it. By default `fetch` function will be used, so make sure to include [the polyfill](https://github.com/github/fetch) in case you're not targeting for React Native only and want to support all browsers (add `import 'isomorphic-fetch'` in the consuming code).

Example:
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  sender: (data, sendTo) => {
    fetch(sendTo, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(data)
    })
  }
}))
```

You can also just log the data instead of posting (for example when included a monitoring service):
```js
createStore(reducer, remotedev({
  sender: (data) => {
    console.warn(data);
  }
}))
```

##### `maxAge`
*number* - maximum allowed actions to be stored in the history tree, the oldest actions are removed once maxAge is reached. Default is `30`.

To restore the history tree, `preloadedState` will be added to the log, which represents the state for the committed (removed) action.

In case you want to send all actions from the beginning, set `maxAge` to `Infinity`, but it's not recommended as having lots of actions with large payloads can consume a lot of RAM and can cause CPU spikes when serializing the data.

##### `withState`
*boolean* - when set to `true`, will include also the current state for every action. It's not recommended as the state object can grow too large, and it's better to reconstruct states by recomputing actions.

##### `every`
*boolean* - when set to `true`, every dispatched action will be posted. It's not recommended as there will be lots of requests and serialization can affect the application's performance significantly.

##### `onlyState`
*boolean* - when set to `true`, will send only the current state (as `preloadedState`) without action list. Useful when only reproducing the state without time traveling would be enough. It's recommended for gaining the performance as nothing will be stored for feature posting.

##### `actionsBlacklist`
*string or array of strings as regex* - actions types to be omitted from sending.

Example:
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  actionsBlacklist: 'SOME_ACTION'
  // or actionsBlacklist: ['SOME_ACTION', 'SOME_OTHER_ACTION']
  // or just actionsBlacklist: 'SOME_' to omit both
}))
```

##### `actionsWhitelist`
*string or array of strings as regex* - only actions with indicated types will be sent. Use the same as in the example above. If specified, `actionsBlacklist` is ignored.

##### `actionSanitizer`
*function* which takes the action object and returns it back. Used to sanitize sensitive data (for example credit cards numbers containing in the payload). Also it's used to strip large payloads (like image blobs) in order to make serializing faster.

Example:
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  actionSanitizer: (action) => (
   action.type === 'FILE_DOWNLOAD_SUCCESS' && action.data ?
   { ...action, data: '<<LONG_BLOB>>' } : action
  )
}))
```

##### `stateSanitizer`
*function* which takes the state and returns it back. As well as `actionSanitizer`, it's used to sanitize sensitive data and to strip large payloads.

Example:
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  stateSanitizer: (state) => state.data ? { ...state, data: '<<LONG_BLOB>>' } : state
}))
```

Also you can specify alternative values right in the reducer (in the state object) by adding `toJSON` function:

In the example bellow it will always send `{ conter: 'sensitive' }`, regardless of the state value:
```js
function counter(state = { count: 0, toJSON: () => ({ conter: 'sensitive' }) }, action) {
  switch (action.type) {
    case 'INCREMENT': return { count: state.count + 1 };
    default: return state;
  }
}
```

You could also alter the value. In the example below when state is `{ count: 1 }`, we'll send `{ counter: 10 }` (notice we don't have an arrow function this time to use the object's `this`):  
```js
function counter(
  state = { count: 0, toJSON: function (){ return { conter: this.count * 10 }; } },
  action
) {
  // ...
}
```

In case you want to sanitize only specific values, use:
```js
function reducer(
  state = {
    v1: 1, v2: 2, v3: 3, v4: 4,
    toJSON: function (){
      return { ...this, v2: 'sanitized', v4: 'sanitized' };
      // Or return Object.assign({}, this, { v2: 'sanitized', v4: 'sanitized' })
    }
  },
  action
) {
  // ...
}
```

##### `stringifyReplacer`
*function or array* - a function that alters the behavior of the stringification process, or an array of String and Number objects that serve as a whitelist for selecting the properties of the value object to be included in the JSON string. As a function, it takes two parameters, the key and the value being stringified. Also useful if state is not plain object.

Example (for converting mori data structures):
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  stringifyReplacer: (key, value) => (
    value && mori.isMap(value) ? mori.toJs(value) : value
  )
}))
````

##### Info

Add these optional options for better analytics: `title`, `description`, `screenshot`, `version`, `userAgent`, `user`, `meta`.

Example:
```js
createStore(reducer, remotedev({
  sendTo: 'http://localhost:8000',
  sendOn: 'SOME_ACTION',
  title: 'Nothing works',
  description: 'It was supposed to be an useless report, but it\'s not ;)',
  screenshot: 'add here an image blob or an url of the stored screenshot',
  version: 'app version to git checkout that release tag',
  appId: 'id to identify the application',
  instanceId: 'id to identify the store in case there are multiple stores',
  userAgent: Platform.Version, // On React Native with: import { Platform } from 'react-native';
  // for browsers userAgent is detected automatically, so no need to specify it explicitely.
  user: {
    id: 'user_id',
    name: 'User Name',
    email: 'user@email',
    photo: 'url or image blob' 
  },
  // or just a string:
  // user: 'user id or user name to identify him',
  meta: 'everything else you want to send'
}))
```

## Exclude the enhancer from development builds

Usually you want to send logs only for production, so you should either use it under a flag excluding from development or you use [our helper](https://github.com/zalmoxisus/redux-remotedev/blob/master/src/productionOnly.js) to have no-op when `process.env.NODE_ENV !== 'production'`:

```js
import remotedev from 'redux-remotedev/productionOnly'
```

## Exclude the enhancer from production builds

If you want to receive logs only from devs, not to affect the performance in production, you can use [our helper](https://github.com/zalmoxisus/redux-remotedev/blob/master/src/developmentOnly.js) to have the module stripped when `process.env.NODE_ENV === 'production'`:

```js
import remotedev from 'redux-remotedev/developmentOnly'
```

## LICENSE

[MIT](LICENSE)

## Created By

If you like this, follow [@mdiordiev](https://twitter.com/mdiordiev) on twitter.
