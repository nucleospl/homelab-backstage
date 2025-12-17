import { createDevApp } from '@backstage/dev-utils';
import { EntityProvider } from '@backstage/plugin-catalog-react';

import { artifactoryBrowserPlugin } from '../src/plugin';
import { EntityArtifactoryBrowserContent } from '../src/components/EntityArtifactoryBrowserContent/EntityArtifactoryBrowserContent';

createDevApp()
  .registerPlugin(artifactoryBrowserPlugin)
  .addPage({
    element: (
      <EntityProvider
        entity={
          {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: 'dev',
              annotations: {
                'jfrog.io/artifactory-repo': 'android-snapshots',
                'jfrog.io/artifactory-path': 'com/maksonlee/beepbeep',
              },
            },
            spec: {},
          } as any
        }
      >
        <EntityArtifactoryBrowserContent />
      </EntityProvider>
    ),
    title: 'Artifactory Browser (Dev)',
    path: '/artifactory-browser',
  })
  .render();
