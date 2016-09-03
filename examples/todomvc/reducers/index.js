import { combineReducers } from 'redux';
import {reducer as toastr} from 'react-redux-toastr';
import todos from './todos';

const rootReducer = combineReducers({
  todos,
  toastr
});

export default rootReducer;
