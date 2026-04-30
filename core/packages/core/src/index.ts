export interface Module {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  icon?: React.ReactNode;
}

export interface Category {
  id: string;
  name: string;
  icon: React.ReactNode;
  modules: Module[];
}

export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  component: React.ComponentType;
  icon?: React.ReactNode;
}
