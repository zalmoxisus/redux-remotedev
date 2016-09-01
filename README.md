# Redux Remote DevTools for Production
Receive logs/reports from production and get them replicated with [Redux DevTools extension](https://github.com/zalmoxisus/redux-devtools-extension) (or other [monitoring apps](https://github.com/zalmoxisus/remote-redux-devtools#monitoring)). Unlike other solutions (like [Remote Redux DevTools](https://github.com/zalmoxisus/remote-redux-devtools)), it aims to be optimized for production and suitable for different user cases (see [the options](#api)). Even though it's designed for using with [`remotedev-server`](https://github.com/zalmoxisus/remotedev-server), it can be easily integrated with any other server or serverless architectures.

## Installation

```
npm install --save redux-remotedev
```

## Usage

Just add the store enhancer to your Redux store:

```js
import remotedev from 'redux-remotedev';
createStore(reducer, remotedev({ sendTo: 'http://localhost:8000' }));
```

More detailed example:

```js
import { createStore, applyMiddleware, compose } from 'redux';
// import thunk from 'redux-thunk';
import remotedev from 'redux-remotedev';
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

See also [`remotedev-server`](https://github.com/zalmoxisus/remotedev-server) for integrating the server part.

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

##### `sender`
*function* - custom function used to post the data. Usually, you don't need to specify it. By default `fetch` function will be used, so make sure to include [the polyfill](https://github.com/github/fetch) in case you're not targeting for React Native only and want to support older browsers.

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
  userAgent: Platform.Version, // On React Native with: import { Platform } from 'react-native';
  // for browsers userAgent is detected automatically, so no need to specify it explicitely.
  user: {
    id: 'user_id',
    name: 'User Name',
    email: 'user@email',
    avatar: 'url or image blob' 
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

If you want to receive logs only from devs, not to affect the production performance, you can use [our helper](https://github.com/zalmoxisus/redux-remotedev/blob/master/src/developmentOnly.js) to have the module stripped when `process.env.NODE_ENV === 'production'`:

```js
import remotedev from 'redux-remotedev/developmentOnly'
```

## LICENSE

[MIT](LICENSE)

## Created By

If you like this, follow [@mdiordiev](https://twitter.com/mdiordiev) on twitter.
