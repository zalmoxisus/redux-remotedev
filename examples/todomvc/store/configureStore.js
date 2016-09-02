import { createStore } from 'redux';
import devTools from 'redux-demotedev';
import rootReducer from '../reducers';

export default function configureStore(initialState) {
  const store = createStore(rootReducer, initialState, devTools({
    sendTo: 'http://localhost:8000',
    sendOn: 'COMPLETE_TODO',
    sendOnError: true,
    beforeSending(report, send) {
      send({ ...report, title: prompt('Please describe what happened') });
    },
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
      failed(error) {
        console.warn('Report cannot be sent', error);
      }
    }
  }));

  if (module.hot) {
    // Enable Webpack hot module replacement for reducers
    module.hot.accept('../reducers', () => {
      const nextReducer = require('../reducers').default;
      store.replaceReducer(nextReducer);
    });
  }

  return store;
}
