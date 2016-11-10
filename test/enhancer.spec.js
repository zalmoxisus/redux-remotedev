import expect, { spyOn } from 'expect';
import { createStore } from 'redux';
import remotedev from '../src/enhancer';

function counter(state = 0, action) {
  switch (action.type) {
    case 'INCREMENT': return state + 1;
    case 'DECREMENT': return state - 1;
    case 'FILTERED': return state - 1;
    default: return state;
  }
}

describe('enhancer', () => {
  it('throws if there are no arguments', () => {
    expect(() => {
      createStore(counter, remotedev());
    }).toThrow(
      'Provide at least `sendTo` or `sender` option for remotedev enhancer.'
    );
  });

  it('should send every action (`every: true`)', () => {
    const options = {
      every: true,
      sender: () => {}
    };
    const spy = spyOn(options, 'sender');
    const store = createStore(counter, remotedev(options));
    expect(spy.calls.length).toEqual(0);
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(1);
    expect(spy.calls.length).toEqual(1);
    expect(spy.calls[0].arguments[0].type).toBe('ACTION');
    expect(spy.calls[0].arguments[0].payload).toBe('{"type":"INCREMENT"}');
    expect(spy.calls[0].arguments[4].getState()).toBe(1);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(2);
    expect(spy.calls.length).toEqual(2);
    expect(spy.calls[1].arguments[0].type).toBe('ACTION');
    expect(spy.calls[1].arguments[0].payload).toBe('{"type":"INCREMENT"}');
  });

  it('should warn that fetch is not defined', () => {
    const options = {
      sendTo: '-',
      every: true
    };
    const spy = spyOn(console, 'warn');
    const store = createStore(counter, remotedev(options));
    expect(spy.calls.length).toEqual(0);
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(1);
    expect(spy.calls.length).toEqual(1);
    expect(spy.calls[0].arguments[0].toString()).toBe('ReferenceError: fetch is not defined');
  });

  it('should send batched actions for `sendOn` action', () => {
    const options = {
      sendOn: 'DECREMENT',
      sender: () => {}
    };
    const spy = spyOn(options, 'sender');
    const store = createStore(counter, remotedev(options));
    expect(spy.calls.length).toEqual(0);
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(1);
    expect(spy.calls.length).toEqual(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(2);
    expect(spy.calls.length).toEqual(0);
    store.dispatch({ type: 'DECREMENT' });
    expect(store.getState()).toBe(1);
    expect(spy.calls.length).toEqual(1);
    expect(spy.calls[0].arguments[0].type).toBe('ACTIONS');
    expect(spy.calls[0].arguments[0].payload).toBe(
      '[{"type":"INCREMENT"},{"type":"INCREMENT"},{"type":"DECREMENT"}]'
    );
    expect(spy.calls[0].arguments[0].preloadedState).toBe('0');
    store.dispatch({ type: 'DECREMENT' });
    expect(store.getState()).toBe(0);
    expect(spy.calls.length).toEqual(2);
  });

  it('should send for `sendOnCondition`', () => {
    const options = {
      sendOnCondition: (state, action) => action.type === 'DECREMENT',
      sender: () => {}
    };
    const spy = spyOn(options, 'sender');
    const store = createStore(counter, remotedev(options));
    expect(spy.calls.length).toEqual(0);
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(1);
    expect(spy.calls.length).toEqual(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(2);
    expect(spy.calls.length).toEqual(0);
    store.dispatch({ type: 'DECREMENT' });
    expect(store.getState()).toBe(1);
    expect(spy.calls.length).toEqual(1);
    expect(spy.calls[0].arguments[0].type).toBe('ACTIONS');
    expect(spy.calls[0].arguments[0].payload).toBe(
      '[{"type":"INCREMENT"},{"type":"INCREMENT"},{"type":"DECREMENT"}]'
    );
    expect(spy.calls[0].arguments[0].preloadedState).toBe('0');
    store.dispatch({ type: 'DECREMENT' });
    expect(store.getState()).toBe(0);
    expect(spy.calls.length).toEqual(1);
  });

  it('should commit state for maxAge', () => {
    const options = {
      sendOn: 'DECREMENT',
      maxAge: 1,
      sender: () => {}
    };
    const spy = spyOn(options, 'sender');
    const store = createStore(counter, remotedev(options));
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(1);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(2);
    expect(spy.calls.length).toEqual(0);
    store.dispatch({ type: 'DECREMENT' });
    expect(store.getState()).toBe(1);
    expect(spy.calls.length).toEqual(1);
    expect(spy.calls[0].arguments[0].type).toBe('ACTIONS');
    expect(spy.calls[0].arguments[0].payload).toBe(
      '[{"type":"INCREMENT"},{"type":"DECREMENT"}]'
    );
    expect(spy.calls[0].arguments[0].preloadedState).toBe('1');
  });

  it('should send actions and the state', () => {
    const options = {
      sendOn: 'DECREMENT',
      withState: true,
      sender: () => {}
    };
    const spy = spyOn(options, 'sender');
    const store = createStore(counter, remotedev(options));
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(1);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(2);
    expect(spy.calls.length).toEqual(0);
    store.dispatch({ type: 'DECREMENT' });
    expect(store.getState()).toBe(1);
    expect(spy.calls.length).toEqual(1);
    expect(spy.calls[0].arguments[0].type).toBe('STATES');
    expect(spy.calls[0].arguments[0].payload).toBe(
      '[{"state":1,"action":{"type":"INCREMENT"}},' +
      '{"state":2,"action":{"type":"INCREMENT"}},' +
      '{"state":1,"action":{"type":"DECREMENT"}}]'
    );
  });

  it('should send only the state', () => {
    const options = {
      sendOn: 'DECREMENT',
      onlyState: true,
      sender: () => {}
    };
    const spy = spyOn(options, 'sender');
    const store = createStore(counter, remotedev(options));
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(1);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(2);
    expect(spy.calls.length).toEqual(0);
    store.dispatch({ type: 'DECREMENT' });
    expect(store.getState()).toBe(1);
    expect(spy.calls.length).toEqual(1);
    expect(spy.calls[0].arguments[0].type).toBe('STATE');
    expect(spy.calls[0].arguments[0].preloadedState).toBe('1');
    expect(spy.calls[0].arguments[0].payload).toBe(undefined);
  });

  it('should filter actions', () => {
    const options = {
      actionsBlacklist: 'FILTERED',
      sendOn: 'DECREMENT',
      sender: () => {}
    };
    const spy = spyOn(options, 'sender');
    const store = createStore(counter, remotedev(options));
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(1);
    store.dispatch({ type: 'FILTERED' });
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'DECREMENT' });
    expect(store.getState()).toBe(-1);
    expect(spy.calls.length).toEqual(1);
    expect(spy.calls[0].arguments[0].type).toBe('ACTIONS');
    expect(spy.calls[0].arguments[0].payload).toBe(
      '[{"type":"INCREMENT"},{"type":"DECREMENT"}]'
    );
    expect(spy.calls[0].arguments[0].preloadedState).toBe('0');
  });

  it('should sanitize actions', () => {
    const options = {
      actionSanitizer: (action) => (
        action.type === 'INCREMENT' ? { type: 'COUNTER_INCREMENT', sanitized: true } : action
      ),
      sendOn: 'DECREMENT',
      sender: () => {}
    };
    const spy = spyOn(options, 'sender');
    const store = createStore(counter, remotedev(options));
    expect(store.getState()).toBe(0);
    store.dispatch({ type: 'INCREMENT' });
    expect(store.getState()).toBe(1);
    store.dispatch({ type: 'DECREMENT' });
    expect(store.getState()).toBe(0);
    expect(spy.calls.length).toEqual(1);
    expect(spy.calls[0].arguments[0].type).toBe('ACTIONS');
    expect(spy.calls[0].arguments[0].payload).toBe(
      '[{"type":"COUNTER_INCREMENT","sanitized":true},{"type":"DECREMENT"}]'
    );
    expect(spy.calls[0].arguments[0].preloadedState).toBe('0');
  });
});
