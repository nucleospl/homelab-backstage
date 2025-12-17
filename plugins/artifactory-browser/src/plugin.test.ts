import { artifactoryBrowserPlugin } from './plugin';

describe('artifactory-browser', () => {
  it('should export plugin', () => {
    expect(artifactoryBrowserPlugin).toBeDefined();
  });
});
