const assert = require('node:assert/strict');
const test = require('node:test');

const { FilterGraphBuilder } = require('../build/FilterGraph');

test('builds a labeled filterchain with named and positional options', () => {
  const graph = new FilterGraphBuilder().addChain({
    inputs: '0:v',
    filters: [
      { name: 'scale', options: { w: 1280, h: -2 } },
      { name: 'fps', options: [30] },
    ],
    outputs: 'video',
  });

  assert.equal(graph.build(), '[0:v]scale=w=1280:h=-2,fps=30[video]');
});

test('joins multiple chains and supports multiple link labels', () => {
  const graph = new FilterGraphBuilder()
    .addChain({
      inputs: '0:v',
      filters: { name: 'split', options: [2] },
      outputs: ['main', 'copy'],
    })
    .addChain({
      inputs: ['main', '1:v'],
      filters: {
        name: 'overlay',
        options: { x: 'W-w-10', y: 'H-h-10' },
      },
      outputs: 'composited',
    });

  assert.equal(
    graph.build(),
    '[0:v]split=2[main][copy];[main][1:v]overlay=x=W-w-10:y=H-h-10[composited]'
  );
});

test('escapes option values at the option and graph levels', () => {
  const graph = new FilterGraphBuilder().addChain({
    filters: {
      name: 'drawtext',
      options: { text: "a:b,c;d[e]'f\\g" },
    },
    outputs: 'out',
  });

  assert.equal(
    graph.build(),
    String.raw`drawtext=text=a\\:b\,c\;d\[e\]\\\'f\\\\g[out]`
  );
});

test('omits undefined named options and serializes booleans', () => {
  const graph = new FilterGraphBuilder().addChain({
    filters: {
      name: 'example',
      options: { enabled: true, disabled: false, unused: undefined },
    },
  });

  assert.equal(graph.build(), 'example=enabled=true:disabled=false');
});

test('appends raw chains without changing their syntax', () => {
  const graph = new FilterGraphBuilder()
    .addRawChain('  [0:v]custom=already\\:escaped[tmp]  ')
    .addChain({ inputs: 'tmp', filters: { name: 'null' }, outputs: 'out' });

  assert.equal(
    graph.build(),
    '[0:v]custom=already\\:escaped[tmp];[tmp]null[out]'
  );
});

test('buildArgs returns filter_complex and one graph argument', () => {
  const graph = new FilterGraphBuilder().addChain({
    filters: { name: 'null' },
  });

  assert.deepEqual(graph.buildArgs(), ['-filter_complex', 'null']);
});

test('rejects invalid graph structures and values', () => {
  assert.throws(
    () => new FilterGraphBuilder().build(),
    /empty filtergraph/
  );
  assert.throws(
    () => new FilterGraphBuilder().addChain({ filters: [] }),
    /at least one filter/
  );
  assert.throws(
    () =>
      new FilterGraphBuilder().addChain({
        filters: { name: 'scale', options: [Number.NaN] },
      }),
    /must be finite/
  );
  assert.throws(
    () =>
      new FilterGraphBuilder().addChain({
        inputs: '[0:v]',
        filters: { name: 'null' },
      }),
    /link label contains an FFmpeg delimiter/
  );
  assert.throws(
    () =>
      new FilterGraphBuilder().addChain({
        filters: { name: 'scale;null' },
      }),
    /Filter name contains an FFmpeg delimiter/
  );
  assert.throws(
    () => new FilterGraphBuilder().addRawChain('   '),
    /must not be empty/
  );
});
