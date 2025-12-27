import { createPlugin, createComponentExtension } from '@backstage/core-plugin-api';

export const harborPlugin = createPlugin({
  id: 'harbor',
});

export const EntityHarborArtifactsTab = harborPlugin.provide(
  createComponentExtension({
    name: 'EntityHarborArtifactsTab',
    component: {
      lazy: () => import('./components/EntityHarborArtifacts').then(m => m.EntityHarborArtifacts),
    },
  }),
);
