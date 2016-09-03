import 'babel-polyfill';
import React from 'react';
import { render } from 'react-dom';
import { Provider } from 'react-redux';
import ReduxToastr from 'react-redux-toastr'
import App from './containers/App';
import configureStore from './store/configureStore';
import 'todomvc-app-css/index.css';

const store = configureStore();

render(
  <Provider store={store}>
    <div>
      <App />
      <ReduxToastr
        timeOut={60000}
        newestOnTop={false}
        position="bottom-right"
      />
    </div>
  </Provider>,
  document.getElementById('root')
);
