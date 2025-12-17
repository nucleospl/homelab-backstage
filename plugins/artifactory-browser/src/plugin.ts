import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const artifactoryBrowserPlugin = createPlugin({
  id: 'artifactory-browser',
  routes: {
    root: rootRouteRef,
  },
});

export const ArtifactoryBrowserPage = artifactoryBrowserPlugin.provide(
  createRoutableExtension({
    name: 'ArtifactoryBrowserPage',
    component: () =>
      import('./components/ExampleComponent').then(m => m.ExampleComponent),
    mountPoint: rootRouteRef,
  }),
);
