import { configureStore } from '@reduxjs/toolkit';
import exampleReducer from './slice/exampleSlice';

export const store = configureStore({
  reducer: {
    example: exampleReducer,
  },
});

