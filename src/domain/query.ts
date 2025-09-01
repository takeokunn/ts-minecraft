import type { ComponentName } from './components';

export type Query = {
  name: string;
  components: ComponentName[];
};
