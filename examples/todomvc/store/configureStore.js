import React from 'react';
import { createStore } from 'redux';
import { toastr } from 'react-redux-toastr';
import devTools from 'redux-demotedev';
import rootReducer from '../reducers';

export default function configureStore(initialState) {
  const store = createStore(rootReducer, initialState, devTools({
    sendTo: 'http://localhost:8000',
    sendOn: 'REPORT',
    sendOnError: true,
    actionsBlacklist: ['@ReduxToastr'],
    beforeSending(report, send) {
      toastr.clean();
      if (report.error) toastr.error('An error occurred.');
      toastr.message('Submit a report', {
        component: (<div>
          <input
            className="reportMsg"
            type="text" id="dialogBox"
            placeholder="Please describe what happened"
          />
          <div className="report">
            <button
              type="button"
              onClick={() => {
                send({ ...report, title: document.getElementById('dialogBox').value });
              }}
            ><p>send</p></button>
            <button
              type="button"
              onClick={() => {
                toastr.clean();
                showReportButton();
              }}
            ><p>cancel</p></button>
          </div>
        </div>),
        removeOnHover: false,
        removeOnClick: false
      });
    },
    sendingStatus: {
      started(report) {
        console.log('Sending a report', report);
      },
      done(reportId) {
        toastr.clean();
        toastr.message(
          'The report sent',
          {
            component: (<div>
              <div className="report">
                <button
                  type="button"
                  onClick={() => {
                    window.open('http://localhost:3000/?remotedev_report=' + reportId);
                    toastr.clean();
                    showReportButton();
                  }}
                ><p>replicate in development</p></button>
                <button
                  type="button"
                  onClick={() => {
                    toastr.clean();
                    showReportButton();
                  }}
                ><p>close</p></button>
              </div>
            </div>),
          removeOnHover: false,
          removeOnClick: false
        });
      },
      failed(error) {
        toastr.error('Report cannot be sent', error);
      }
    }
  }));
  
  function showReportButton() {
    toastr.message('Submit a report', {
      onHideComplete: () => { store.dispatch({ type: 'REPORT' }); }
    });
  }
  setTimeout(() => { showReportButton(); }, 3000); 

  if (module.hot) {
    // Enable Webpack hot module replacement for reducers
    module.hot.accept('../reducers', () => {
      const nextReducer = require('../reducers').default;
      store.replaceReducer(nextReducer);
    });
  }

  return store;
}
