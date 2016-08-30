export function remotedevEnhancer(options) {
  return (createStore) => (reducer, preloadedState, enhancer) => {
    const store = createStore(reducer, preloadedState, enhancer);

    const dispatch = (action) => {
      const r = store.dispatch(action);
      console.log(action, store.getState());
      return r;
    };

    return {
      ...store,
      dispatch
    };
  };
}
