import { assign } from 'lodash';
import { PRELOAD_PENDING, PRELOAD_SUCCESS } from './mutationTypes';

export default {
  [PRELOAD_PENDING]: (state) => assign(state, { isLoading: true }),
  [PRELOAD_SUCCESS]: (state, payload) => assign(state, payload, { isLoading: false })
};