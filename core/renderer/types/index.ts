import type { ReactNode } from 'react';

export * from '@devtoolbox/core';

export interface Module {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  icon?: ReactNode;
}

export interface Category {
  id: string;
  name: string;
  icon: ReactNode;
  modules: Module[];
}
