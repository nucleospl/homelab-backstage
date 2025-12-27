import { createDevApp } from '@backstage/dev-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';

import { harborPlugin, EntityHarborArtifactsTab } from '../src/plugin';

createDevApp()
  .registerPlugin(harborPlugin)
  .addPage({
    element: (
      <EntityProvider
        entity={{
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Component',
          metadata: {
            name: 'demo',
            annotations: {
              'harbor.maksonlee.com/repository': 'backstage/homelab-backstage',
            },
          },
          spec: { type: 'service', owner: 'team-a', lifecycle: 'production' },
        }}
      >
        <EntityHarborArtifactsTab />
      </EntityProvider>
    ),
    title: 'Harbor (Entity Tab)',
    path: '/harbor',
  })
  .render();
