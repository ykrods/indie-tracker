import { assert } from 'tiny-esm-test-runner';
const { is, isNot, ok, ng } = assert;


test_makeBreadCrumbs.parameters = [
  [[{ name: 'Home' }], 'Home'],
  [
    [
      { name: 'wiki', link: '/wiki/' },
      { name: 'foo' },
    ],
    'foo',
  ],
  [
    [
      { name: 'wiki', link: '/wiki/' },
      { name: 'foo', link: '/wiki/foo/' },
      { name: 'bar' },
    ],
    'foo/bar',
  ],
];
export async function test_makeBreadCrumbs([expected, given]) {
  const target = (await import('../src/pages/wiki/makeBreadCrumbs.js')).default;
  is(expected, target(given));
}
