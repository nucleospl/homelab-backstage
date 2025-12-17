import { createDevApp } from '@backstage/dev-utils';
import { artifactoryBrowserPlugin, ArtifactoryBrowserPage } from '../src/plugin';

createDevApp()
  .registerPlugin(artifactoryBrowserPlugin)
  .addPage({
    element: <ArtifactoryBrowserPage />,
    title: 'Root Page',
    path: '/artifactory-browser',
  })
  .render();
